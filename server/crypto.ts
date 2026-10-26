import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** AES-256-GCM for phone, email and transcripts. Key lives in PII_ENCRYPTION_KEY only. */
function key(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) throw new Error('Missing required environment variable PII_ENCRYPTION_KEY');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('PII_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  return buf;
}

export function seal(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [v, iv, tag, ct] = sealed.split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognised ciphertext format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
}
