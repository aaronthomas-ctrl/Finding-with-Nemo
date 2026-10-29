import type { SupabaseClient } from '@supabase/supabase-js';
import type { UsageSink } from './llm';

interface Limits { tokens_per_day: number; tavily_per_day: number; google_per_day: number }
const FALLBACK: Limits = { tokens_per_day: 2_000_000, tavily_per_day: 100, google_per_day: 500 };

/** Adds to today's counters through the add_usage RPC (positive values only). */
export async function addUsage(
  sb: SupabaseClient,
  orgId: string,
  delta: { tokensIn?: number; tokensOut?: number; tavily?: number; google?: number },
) {
  const { error } = await sb.rpc('add_usage', {
    p_org: orgId,
    p_tokens_in: Math.max(0, Math.round(delta.tokensIn ?? 0)),
    p_tokens_out: Math.max(0, Math.round(delta.tokensOut ?? 0)),
    p_tavily: Math.max(0, Math.round(delta.tavily ?? 0)),
    p_google: Math.max(0, Math.round(delta.google ?? 0)),
  });
  if (error) console.warn('[usage] add_usage failed:', error.message);
}

/** Usage sink for llm.ts calls made on behalf of one org. */
export function tokenSink(sb: SupabaseClient, orgId: string): UsageSink {
  return ({ tokensIn, tokensOut }) => addUsage(sb, orgId, { tokensIn, tokensOut });
}

/** Free access is capped per person, not per org: AI_CALLS_PER_USER requests in total (default 40, 0 = unlimited). */
export const AI_CALLS_PER_USER = Number(process.env.AI_CALLS_PER_USER ?? 40);

async function consumeUserAiCall(sb: SupabaseClient) {
  if (AI_CALLS_PER_USER <= 0) return;
  const { error } = await sb.rpc('consume_ai_call', { p_limit: AI_CALLS_PER_USER });
  if (error) {
    const err: any = new Error(/ai_limit_reached/.test(error.message)
      ? `You have used all ${AI_CALLS_PER_USER} free AI requests for this demo. Thank you for trying it.`
      : `Could not check the AI request limit: ${error.message}`);
    err.status = 429;
    throw err;
  }
}

export type Meter ='tokens' | 'tavily' | 'google';

/** Throws when the org has hit its hard daily cap for the given meter. */
export async function assertWithinQuota(sb: SupabaseClient, orgId: string, meter: Meter) {
  if (meter === 'tokens') await consumeUserAiCall(sb);
  const [{ data: org }, { data: today }] = await Promise.all([
    sb.from('organizations').select('plan_limits').eq('id', orgId).maybeSingle(),
    sb.from('usage_quota').select('*').eq('org_id', orgId).eq('day', new Date().toISOString().slice(0, 10)).maybeSingle(),
  ]);
  const limits: Limits = { ...FALLBACK, ...(org?.plan_limits ?? {}) };
  const used = {
    tokens: Number(today?.tokens_in ?? 0) + Number(today?.tokens_out ?? 0),
    tavily: Number(today?.tavily_credits ?? 0),
    google: Number(today?.google_calls ?? 0),
  };
  const cap = { tokens: limits.tokens_per_day, tavily: limits.tavily_per_day, google: limits.google_per_day }[meter];
  if (used[meter] >= cap) {
    const err: any = new Error(`Daily ${meter} limit reached (${cap}). It resets tomorrow.`);
    err.status = 429;
    throw err;
  }
}
