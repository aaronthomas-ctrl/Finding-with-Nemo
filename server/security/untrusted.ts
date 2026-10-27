/**
 * Prompt-injection defences for text that did not come from the signed-in user:
 * web pages, Tavily results, Places data, uploads, transcripts, watcher pages.
 * Rule: this text is data, never instructions.
 */

// Unicode tag characters, zero-width, bidi controls, BOM.
const INVISIBLE = /[\u{E0000}-\u{E007F}​-‍⁠﻿‪-‮⁦-⁩]/gu;

export function stripInvisible(text: string): string {
  return text.normalize('NFKC').replace(INVISIBLE, '');
}

/** Drops HTML comments and hidden elements, then returns plain text. */
export function stripHiddenHtml(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<([a-z0-9]+)\b[^>]*(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0|aria-hidden=["']true["']|\bhidden\b)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}

/** Decoded after tags are gone, so escaped text like &lt;/system&gt; is seen the way a reader would see it. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

export function cleanText(text: string): string {
  return stripInvisible(text);
}

export interface InjectionPattern { pattern: string; description: string }

/** Built-in rules. The shared injection_patterns table adds to these (see refreshPatterns). */
export const DEFAULT_PATTERNS: InjectionPattern[] = [
  // String.raw keeps every backslash exactly as written. After HTML is flattened to one line there is no newline,
  // so a role label may follow any sentence break.
  { pattern: String.raw`ignore (all |any )?(previous|prior|above) (instructions|rules|prompts)`, description: 'direct override' },
  { pattern: String.raw`(^|[\n.!?:>]\s*)(system|assistant|developer)\s*:`, description: 'fake role line' },
  { pattern: String.raw`</?(system|tool_result|instructions|untrusted)>`, description: 'fake tags' },
  { pattern: String.raw`you are now|new instructions|act as (an? )?(admin|developer|system)`, description: 'role change' },
  { pattern: String.raw`!\[[^\]]*\]\(https?://`, description: 'markdown image link' },
  { pattern: String.raw`(decode|base64|rot13).{0,40}(follow|execute|run)`, description: 'encoded payload' },
  { pattern: String.raw`(send|email|post|upload).{0,40}(client list|contacts|api key|password)`, description: 'data exfiltration ask' },
  { pattern: String.raw`remember (that|this)|save (this|that) (to|in) memory`, description: 'memory poisoning' },
  { pattern: String.raw`\b(call|invoke|run|execute|use)\s+(update_client|save_companies|save_search_zone|set_follow_up|log_interaction|add_lead|apply_search_tags|auto_tag_batch|plan_route|create_watcher|add_project|extract_projects|delete_\w+)\b`, description: 'order to call an internal tool' },
  { pattern: String.raw`\b(when|if) you (call|use|run|invoke) [a-z_]{4,}.{0,80}(also|must|should)`, description: 'fake tool rule' },
  { pattern: String.raw`(from|by) the (system )?(administrator|admin|developers?)|security audit.{0,120}(email|send|call|unlock)`, description: 'fake authority' },
  { pattern: String.raw`copy .{0,60}(private|confidential|client records?).{0,80}(public|external|shared)`, description: 'exfiltration by copying' },
];

let learned: InjectionPattern[] = [];
let learnedAt = 0;

/** Pull the shared pattern table (readable by any signed-in user). Cached for ten minutes. */
export async function refreshPatterns(sb: { from: (t: string) => any }) {
  if (Date.now() - learnedAt < 10 * 60_000) return;
  learnedAt = Date.now();
  const { data } = await sb.from('injection_patterns').select('pattern,description');
  if (Array.isArray(data)) learned = data;
}

export interface Screening { suspicious: boolean; reasons: string[] }

export function screenWithPatterns(text: string, patterns: InjectionPattern[] = [...DEFAULT_PATTERNS, ...learned]): Screening {
  const reasons: string[] = [];
  for (const p of patterns) {
    try {
      if (new RegExp(p.pattern, 'i').test(text)) reasons.push(p.description);
    } catch { /* ignore a bad pattern row */ }
  }
  return { suspicious: reasons.length > 0, reasons };
}

/** Fence fetched text so the model can tell it apart from instructions. */
export function fence(text: string, source: string, suspicious = false): string {
  const safe = cleanText(text).replace(/<\/?untrusted[^>]*>/gi, '[tag removed]');
  const src = source.replace(/["<>]/g, '');
  return `<untrusted source="${src}"${suspicious ? ' suspicious="true"' : ''}>\n${safe}\n</untrusted>`;
}

export { safeCell, safeRow } from '../../src/lib/safeCell';

/** Show a URL as plain text with its domain, so replies never carry live links the model invented. */
export function defang(url: string): string {
  try { return `${new URL(url).hostname} (${url.replace(/^https?:\/\//, '')})`; } catch { return url; }
}
