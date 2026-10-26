import { cleanText } from './security/untrusted';

/** Lower-case, strip accents and punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return cleanText(text)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Evidence Gate: a fact is verified only if its quote appears in the source text.
 * Quotes shorter than 12 characters are too weak to count.
 */
export function verifyQuote(sourceText: string, quote: string): boolean {
  const q = normalize(quote);
  if (q.length < 12) return false;
  return normalize(sourceText).includes(q);
}

export interface Fact { claim: string; quote: string }
export interface GatedFact extends Fact { verified: boolean }

export function gateFacts(sourceText: string, facts: Fact[]): GatedFact[] {
  return facts.map((f) => ({ ...f, verified: verifyQuote(sourceText, f.quote) }));
}
