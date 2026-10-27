/**
 * Spreadsheet formula injection defence. A cell that starts with =, +, - or @ can run as a formula when the file
 * is opened (for example =HYPERLINK that sends data out). Such text gets a leading apostrophe so it stays text.
 * Phone numbers (+971 50 123 4567) and plain negative numbers (-5) are left alone.
 */
const LOOKS_NUMERIC = /^[+-]?[\d\s().-]+$/;

export function safeCell<T>(v: T): T | string {
  if (typeof v !== 'string' || v.length === 0) return v;
  if (/^[=@]/.test(v)) return `'${v}`;
  if (/^[+-]/.test(v) && !LOOKS_NUMERIC.test(v)) return `'${v}`;
  return v;
}

/** Apply safeCell to every string value in a row object. */
export function safeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = safeCell(v);
  return out as T;
}
