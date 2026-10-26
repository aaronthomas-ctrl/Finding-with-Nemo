import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') ||
    v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

/** Throws unless the URL is plain http(s) and resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new Error('Invalid URL'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('Only http(s) URLs are allowed');
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('That address is not allowed');
  return url;
}

/** Fetches a public web page as text: size-capped, time-capped, redirects re-checked. */
export async function fetchPublicText(raw: string, opts: { timeoutMs?: number; maxBytes?: number } = {}): Promise<{ url: string; html: string }> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxBytes = opts.maxBytes ?? 1_500_000;
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        signal: ctl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProspectingAgent/1.0)', Accept: 'text/html,text/plain' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString());
        continue;
      }
      if (!res.ok) throw new Error(`Website returned ${res.status}`);
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { await reader.cancel(); break; }
        chunks.push(value);
      }
      return { url: url.toString(), html: Buffer.concat(chunks).toString('utf8') };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many redirects');
}
