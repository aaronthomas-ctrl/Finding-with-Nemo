import { cleanText } from '../../security/untrusted';
import type { ToolDef } from '../types';

export const createWatcher: ToolDef = {
  name: 'create_watcher',
  write: true,
  description: 'Propose watching a client website, a public LinkedIn company or Instagram page, news about a company, or "upcoming projects in X". The user is notified in the app when something meaningful changes.',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['website', 'social', 'news', 'projects'] },
      target: { type: 'string', description: 'A URL for website and social, a search phrase for news and projects' },
      client_id: { type: 'string' },
      every: { type: 'string', enum: ['daily', 'weekly'] },
    },
    required: ['kind', 'target'],
  },
  async run(args, ctx) {
    const target = cleanText(String(args.target)).trim().slice(0, 300);
    if (target.length < 3) return { data: { error: 'Give a URL or a phrase to watch.' } };
    return {
      data: { proposed: true },
      proposal: { summary: `Watch (${args.kind}, ${args.every === 'weekly' ? 'weekly' : 'daily'}): ${target}`, payload: { kind: args.kind, target, client_id: args.client_id ?? null, every: args.every === 'weekly' ? 'weekly' : 'daily' } },
    };
  },
  async apply(payload, { req }) {
    const { error } = await req.sb.from('watchers').insert({ org_id: req.orgId, created_by: req.user.id, client_id: payload.client_id, kind: payload.kind, target: payload.target, every: payload.every });
    if (error) throw new Error(error.message);
    return { message: 'Watcher added. Use Run now on the Watchers page for a first check.' };
  },
};
