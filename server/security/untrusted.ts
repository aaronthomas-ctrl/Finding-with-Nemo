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
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<([a-z0-9]+)\b[^>]*(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0|aria-hidden=["']true["']|\bhidden\b)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanText(text: string): string {
  return stripInvisible(text);
}

export interface InjectionPattern { pattern: string; description: string }

/** Built-in copy of the seeded rules, used when the table cannot be read. */
export const DEFAULT_PATTERNS: InjectionPattern[] = [
  { pattern: 'ignore (all |any )?(previous|prior|above) (instructions|rules|prompts)', description: 'direct override' },
  { pattern: '(^|\\n)\\s*(system|assistant|developer)\\s*:', description: 'fake role line' },
  { pattern: '</?(system|tool_result|instructions|untrusted)>', description: 'fake tags' },
  { pattern: 'you are now|new instructions|act as (an? )?(admin|developer|system)', description: 'role change' },
  { pattern: '!\\[[^\\]]*\\]\\(https?://', description: 'markdown image link' },
  { pattern: '(decode|base64|rot13).{0,40}(follow|execute|run)', description: 'encoded payload' },
  { pattern: '(send|email|post|upload).{0,40}(client list|contacts|api key|password)', description: 'data exfiltration ask' },
  { pattern: 'remember (that|this)|save (this|that) (to|in) memory', description: 'memory poisoning' },
];

export interface Screening { suspicious: boolean; reasons: string[] }

export function screenWithPatterns(text: string, patterns: InjectionPattern[] = DEFAULT_PATTERNS): Screening {
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

/** Prefix spreadsheet cells that start with a formula character (import and export). */
export function safeCell<T>(v: T): T | string {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v;
}

/** Show a URL as plain text with its domain, so replies never carry live links the model invented. */
export function defang(url: string): string {
  try { return `${new URL(url).hostname} (${url.replace(/^https?:\/\//, '')})`; } catch { return url; }
}
