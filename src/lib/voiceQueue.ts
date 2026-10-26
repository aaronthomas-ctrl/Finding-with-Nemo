import { supabase } from './supabase';
import { apiFetch } from './api';

/**
 * Voice notes recorded offline wait in IndexedDB and upload when the connection returns.
 * Every step is safe to repeat (same id, upsert), so a half-finished upload just resumes.
 */
export interface QueuedNote {
  id: string;
  orgId: string;
  userId: string;
  clientId: string | null;
  language: string;
  durationS: number;
  deviceTranscript: string;
  mime: string;
  blob: Blob;
  createdAt: number;
}

const DB = 'voice-queue';
const STORE = 'notes';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const enqueueNote = (n: QueuedNote) => tx('readwrite', (s) => s.put(n));
export const removeQueued = (id: string) => tx('readwrite', (s) => s.delete(id));
export const listQueued = () => tx<QueuedNote[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedNote[]>);

const extFor = (mime: string) => (mime.includes('mp4') ? 'm4a' : mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'webm');

export interface SubmitResult { english: string; language: string; lowConfidence: boolean; facts: Array<{ claim: string; verified: boolean }>; proposals: number; asr: string }

/** Upload, record the row, and run the server pipeline. Throws on any failure so the caller can keep the note queued. */
export async function submitNote(n: QueuedNote): Promise<SubmitResult> {
  const path = `${n.orgId}/${n.id}.${extFor(n.mime)}`;
  const up = await supabase.storage.from('voice-notes').upload(path, n.blob, { contentType: n.mime, upsert: true });
  if (up.error) throw new Error(up.error.message);

  let transcriptEnc: string | null = null;
  if (n.deviceTranscript.trim()) {
    const res = await apiFetch('/api/pii/seal', { method: 'POST', body: JSON.stringify({ values: { t: n.deviceTranscript } }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not encrypt the transcript');
    transcriptEnc = data.sealed.t;
  }
  const row = await supabase.from('voice_notes').upsert({
    id: n.id, org_id: n.orgId, client_id: n.clientId, user_id: n.userId, storage_path: path, language: n.language === 'auto' ? null : n.language,
    duration_s: Math.round(n.durationS), transcript_enc: transcriptEnc, status: 'queued', error: null,
  });
  if (row.error) throw new Error(row.error.message);

  const res = await apiFetch(`/api/voice/${n.id}/process`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Processing failed');
  return data;
}

let flushing = false;
/** Try every queued note. Notes that fail stay queued; returns how many went through. */
export async function flushQueue(onDone?: (n: QueuedNote, r: SubmitResult) => void): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let ok = 0;
  try {
    for (const n of await listQueued()) {
      try { const r = await submitNote(n); await removeQueued(n.id); ok++; onDone?.(n, r); }
      catch (e) { console.warn('[voice queue] will retry', n.id, e); }
    }
  } finally { flushing = false; }
  return ok;
}

/** Call once at app start: uploads waiting notes whenever the browser comes back online. */
export function startVoiceSync() {
  const run = () => { flushQueue(); };
  window.addEventListener('online', run);
  run();
  return () => window.removeEventListener('online', run);
}
