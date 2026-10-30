import OpenAI from 'openai';
import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { config } from './config';

/** Which Nemotron does the job. Names come from env, never from code. */
export type ModelRole = 'ultra' | 'super' | 'nano';

export interface UsageSink {
  (usage: { role: ModelRole | 'embed'; tokensIn: number; tokensOut: number }): void | Promise<void>;
}

export interface ChatOptions {
  role: ModelRole;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  /** Nemotron reasoning. Default off for speed; Ultra jobs turn it on. */
  thinking?: boolean;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onUsage?: UsageSink;
}

let client: OpenAI | null = null;
function api(): OpenAI {
  client ??= new OpenAI({
    apiKey: config.nebius.apiKey,
    baseURL: config.nebius.baseURL,
    timeout: 90_000,
    maxRetries: 2,
  });
  return client;
}

/** Models the provider has announced as obsolete may disappear. If a configured model is gone, use its successor. */
const FALLBACK: Record<ModelRole, string> = {
  ultra: process.env.MODEL_ULTRA_FALLBACK || 'nvidia/Nemotron-3.5-Super-VL',
  super: process.env.MODEL_SUPER_FALLBACK || 'nvidia/Nemotron-3.5-Super-VL',
  nano: process.env.MODEL_NANO_FALLBACK || 'nvidia/Nemotron-3_5-Lightning',
};
const retired = new Set<ModelRole>();
const isGone = (e: any) => e?.status === 404 || e?.status === 410 || /model.*(not found|does not exist|deprecat|retired|obsolete|unavailable)/i.test(String(e?.message ?? ''));
const modelFor = (role: ModelRole) => (retired.has(role) ? FALLBACK[role] : config.models[role]);

function body(opts: ChatOptions) {
  return {
    model: modelFor(opts.role),
    messages: opts.messages,
    tools: opts.tools?.length ? opts.tools : undefined,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.2,
    response_format: opts.json ? ({ type: 'json_object' } as const) : undefined,
    // Nemotron 3 reasoning switch (verified on Token Factory for Super and Nano).
    chat_template_kwargs: { enable_thinking: opts.thinking ?? false },
  } as any;
}

export async function chat(opts: ChatOptions): Promise<ChatCompletion> {
  let res: ChatCompletion;
  try {
    res = (await api().chat.completions.create(body(opts), { signal: opts.signal })) as ChatCompletion;
  } catch (e) {
    if (!isGone(e) || retired.has(opts.role) || FALLBACK[opts.role] === config.models[opts.role]) throw e;
    console.warn(`[llm] ${config.models[opts.role]} is not available; switching ${opts.role} to ${FALLBACK[opts.role]}`);
    retired.add(opts.role);
    res = (await api().chat.completions.create(body(opts), { signal: opts.signal })) as ChatCompletion;
  }
  if (res.usage && opts.onUsage) {
    await opts.onUsage({ role: opts.role, tokensIn: res.usage.prompt_tokens, tokensOut: res.usage.completion_tokens });
  }
  return res;
}

export async function chatText(opts: ChatOptions): Promise<string> {
  const res = await chat(opts);
  return res.choices[0]?.message?.content?.trim() ?? '';
}

/** Parse a JSON object out of a model reply, tolerating code fences and stray prose. */
export function parseJson<T = any>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.search(/[\[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('Model did not return valid JSON');
}

export async function chatJson<T = any>(opts: Omit<ChatOptions, 'json'>): Promise<T> {
  return parseJson<T>(await chatText({ ...opts, json: true }));
}

/** Streaming completion. Yields text deltas and tool-call fragments; reports usage at the end. */
export async function* chatStream(opts: ChatOptions) {
  const open = () => api().chat.completions.create(
    { ...body(opts), stream: true, stream_options: { include_usage: true } },
    { signal: opts.signal },
  );
  let stream;
  try {
    stream = await open();
  } catch (e) {
    if (!isGone(e) || retired.has(opts.role) || FALLBACK[opts.role] === config.models[opts.role]) throw e;
    console.warn(`[llm] ${config.models[opts.role]} is not available; switching ${opts.role} to ${FALLBACK[opts.role]}`);
    retired.add(opts.role);
    stream = await open();
  }
  // Token Factory may attach a running total to every chunk, not just the last. Keep the latest and report it once,
  // otherwise a 7-chunk answer is billed as seven answers and the daily cap fills up for nothing.
  let last: { prompt_tokens: number; completion_tokens: number } | null = null;
  try {
    for await (const chunk of stream as any) {
      if (chunk.usage) last = chunk.usage;
      const delta = chunk.choices?.[0]?.delta;
      if (delta) yield delta as { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> };
    }
  } finally {
    if (last && opts.onUsage) await opts.onUsage({ role: opts.role, tokensIn: last.prompt_tokens, tokensOut: last.completion_tokens });
  }
}

export async function embed(texts: string[], onUsage?: UsageSink): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await api().embeddings.create({
    model: config.models.embed,
    input: texts,
    dimensions: config.embedDimensions,
  } as any);
  if (res.usage && onUsage) await onUsage({ role: 'embed', tokensIn: res.usage.prompt_tokens, tokensOut: 0 });
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding as unknown as number[]);
}
