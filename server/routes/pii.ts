import { Router } from 'express';
import type { AuthedRequest } from '../auth';
import { canWrite } from '../auth';
import { open, seal } from '../crypto';

/**
 * The browser never holds the encryption key. Phone, email and transcripts are
 * sealed here before they are written, and opened here when shown.
 */
export const pii = Router();

pii.post('/pii/seal', (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Read-only role' });
  const values = req.body?.values;
  if (!values || typeof values !== 'object') return res.status(400).json({ error: 'values required' });
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(values)) out[k] = typeof v === 'string' ? seal(v) : null;
  res.json({ sealed: out });
});

pii.post('/pii/open', (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length > 500) return res.status(400).json({ error: 'items required (max 500)' });
  // Ciphertext is only openable with the server key; rows reach here only if RLS let the caller read them.
  res.json({ opened: items.map((s: unknown) => { try { return typeof s === 'string' ? open(s) : null; } catch { return null; } }) });
});
