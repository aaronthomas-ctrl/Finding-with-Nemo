import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { canWrite, type AuthedRequest } from '../auth';
import { chatStream } from '../llm';
import { loadOrgContext } from '../org';
import { agentSystemPrompt } from '../prompts/agent';
import { assertWithinQuota, tokenSink } from '../usage';
import { fence, screenWithPatterns } from '../security/untrusted';
import { config } from '../config';
import { byName, toolSpecs } from './registry';
import type { AgentEvent, RunState, UiContext } from './types';

const MAX_STEPS = 8;
const HISTORY = 20;

interface Body { message: string; threadId?: string; ui?: UiContext }

/** Super with tool calling, up to MAX_STEPS rounds, streamed to the browser. Writes become proposals. */
export async function runAgent(req: AuthedRequest, body: Body, emit: (e: AgentEvent) => void, signal: AbortSignal) {
  const { sb, orgId, user } = req;
  await assertWithinQuota(sb, orgId, 'tokens');
  const org = await loadOrgContext(sb, orgId);
  const message = String(body.message || '').slice(0, 4000).trim();
  if (!message) throw new Error('Say something first');

  // Thread and history: this is the chat memory.
  let threadId = body.threadId;
  if (!threadId) {
    const t = await sb.from('chat_threads').insert({ org_id: orgId, user_id: user.id, title: message.slice(0, 60) }).select('id').single();
    if (t.error) throw new Error(t.error.message);
    threadId = t.data.id as string;
  }
  const { data: past } = await sb.from('chat_messages').select('role,content').eq('thread_id', threadId).in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false }).limit(HISTORY);
  await sb.from('chat_messages').insert({ org_id: orgId, thread_id: threadId, role: 'user', content: message });

  const run = await sb.from('agent_runs').insert({ org_id: orgId, thread_id: threadId, user_id: user.id, model: config.models.super }).select('id').single();
  if (run.error) throw new Error(run.error.message);
  const state: RunState = { runId: run.data.id, results: new Map(), tainted: false, userMessage: message, lastArea: body.ui?.polygon ?? undefined };
  const ui: UiContext = body.ui ?? {};

  let tokensIn = 0, tokensOut = 0;
  const sink = tokenSink(sb, orgId);
  const onUsage = async (u: Parameters<typeof sink>[0]) => { tokensIn += u.tokensIn; tokensOut += u.tokensOut; await sink(u); };

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: agentSystemPrompt({ orgName: org.name, kind: org.kind, summary: org.summary, lookingFor: org.lookingFor, tags: org.tags.map((t) => t.name), today: new Date().toISOString().slice(0, 10) }) },
    ...(past ?? []).reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: message },
  ];

  const trace = { toolCalls: [] as any[], proposals: [] as any[], ui: [] as any[] };
  let finalText = '';
  let failed: string | null = null;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      let text = '';
      const calls = new Map<number, { id: string; name: string; args: string }>();
      for await (const d of chatStream({ role: 'super', messages, tools: toolSpecs, thinking: false, maxTokens: 1800, temperature: 0.2, signal, onUsage })) {
        if (d.content) { text += d.content; emit({ type: 'text', delta: d.content }); }
        for (const tc of d.tool_calls ?? []) {
          const cur = calls.get(tc.index) ?? { id: '', name: '', args: '' };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          calls.set(tc.index, cur);
        }
      }
      finalText += text;
      if (calls.size === 0) break;

      const list = [...calls.values()].map((c, i) => ({ ...c, id: c.id || `call_${step}_${i}` }));
      messages.push({ role: 'assistant', content: text || null, tool_calls: list.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args || '{}' } })) });

      for (const c of list) {
        let args: any = {};
        try { args = c.args ? JSON.parse(c.args) : {}; } catch { /* handled below */ }
        const tool = byName.get(c.name);
        let content: string;
        let blocked = false;
        let approvalId: string | null = null;
        let isWrite = !!tool?.write;

        if (!tool) {
          content = JSON.stringify({ error: `Unknown tool ${c.name}` });
        } else if (tool.write && !canWrite(req.role)) {
          blocked = true;
          content = JSON.stringify({ error: 'This role is read-only, so changes cannot be proposed.' });
        } else if (tool.write && state.tainted) {
          blocked = true;
          content = JSON.stringify({ error: 'Text fetched earlier in this run looked like it contained instructions, so only read tools are allowed now. Tell the user.' });
        } else {
          emit({ type: 'tool', id: c.id, name: c.name, status: 'running' });
          try {
            const res = await tool.run(args, { req, org, ui, state, emit });
            for (const a of res.ui ?? []) { emit({ type: 'ui', action: a }); trace.ui.push(a); }
            if (res.proposal) {
              const ins = await sb.from('approvals').insert({
                org_id: orgId, run_id: state.runId, tool: tool.name, requested_by: user.id,
                proposal: { summary: res.proposal.summary, payload: res.proposal.payload, bulk: !!res.proposal.bulk },
              }).select('id').single();
              if (ins.error) throw new Error(ins.error.message);
              approvalId = ins.data.id;
              const ev = { id: approvalId!, tool: tool.name, summary: res.proposal.summary, payload: res.proposal.payload, bulk: !!res.proposal.bulk };
              emit({ type: 'proposal', approval: ev });
              trace.proposals.push({ id: approvalId, tool: tool.name, summary: res.proposal.summary });
              (res.data as any) = { ...(res.data as object), status: 'Proposal shown to the user. Nothing has changed yet; they must approve it.' };
            }
            const json = JSON.stringify(res.data);
            if (res.untrusted) {
              const screen = screenWithPatterns(json);
              if (screen.suspicious) state.tainted = true;
              content = fence(json.slice(0, 12_000), `tool:${c.name}`, screen.suspicious);
            } else content = json.slice(0, 12_000);
            emit({ type: 'tool', id: c.id, name: c.name, status: 'done', summary: res.proposal?.summary });
          } catch (e: any) {
            content = JSON.stringify({ error: String(e?.message || e).slice(0, 300) });
            emit({ type: 'tool', id: c.id, name: c.name, status: 'error', summary: String(e?.message || e).slice(0, 160) });
          }
        }
        if (blocked) emit({ type: 'tool', id: c.id, name: c.name, status: 'blocked' });
        trace.toolCalls.push({ name: c.name, args, blocked });
        await sb.from('agent_tool_calls').insert({ org_id: orgId, run_id: state.runId, tool: c.name, args, result: { preview: content.slice(0, 500) }, is_write: isWrite, approval_id: approvalId, blocked });
        messages.push({ role: 'tool', tool_call_id: c.id, content });
      }
      if (step === MAX_STEPS - 1) {
        const note = '\n\n(I stopped after several steps. Ask me to continue if needed.)';
        finalText += note; emit({ type: 'text', delta: note });
      }
    }
  } catch (e: any) {
    if (signal.aborted) failed = 'stopped';
    else { failed = String(e?.message || e); emit({ type: 'error', message: failed }); }
  }

  const saved = await sb.from('chat_messages').insert({
    org_id: orgId, thread_id: threadId, role: 'assistant', content: finalText.trim() || (failed ? `(${failed})` : '(no reply)'), metadata: trace,
  }).select('id').single();
  await sb.from('agent_runs').update({
    status: failed ? (failed === 'stopped' ? 'stopped' : 'failed') : 'done', tokens_in: tokensIn, tokens_out: tokensOut, ended_at: new Date().toISOString(),
  }).eq('id', state.runId).eq('org_id', orgId);
  emit({ type: 'done', threadId: threadId!, messageId: saved.data?.id ?? '' });
}
