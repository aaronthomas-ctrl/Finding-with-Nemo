import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload, Loader2, WifiOff, CheckCircle2, ShieldAlert, Check, Ban, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { apiFetch, getActiveOrgId } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { enqueueNote, flushQueue, listQueued, submitNote, removeQueued, type QueuedNote, type SubmitResult } from '../lib/voiceQueue';

const LANGS: Array<{ code: string; label: string; bcp47: string }> = [
  { code: 'auto', label: 'Detect language', bcp47: '' },
  { code: 'en', label: 'English', bcp47: 'en-US' },
  { code: 'ar', label: 'Arabic', bcp47: 'ar-SA' },
  { code: 'hi', label: 'Hindi', bcp47: 'hi-IN' },
  { code: 'ml', label: 'Malayalam', bcp47: 'ml-IN' },
  { code: 'ur', label: 'Urdu', bcp47: 'ur-PK' },
  { code: 'tl', label: 'Tagalog', bcp47: 'fil-PH' },
];
const LOW_CONFIDENCE = ['ml', 'ur'];
const field = 'w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm outline-none focus:border-blue-500';

interface Row { id: string; client_id: string | null; language: string | null; duration_s: number | null; status: string; error: string | null; created_at: string; transcript_enc: string | null; translation_enc: string | null }
interface Pending { id: string; proposal: { summary: string } }

export function VoiceNotesView() {
  const { session, activeOrg, canWrite } = useAuth();
  const orgId = activeOrg?.org_id ?? getActiveOrgId();

  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [serverAsr, setServerAsr] = useState<boolean | null>(null);

  const [clientId, setClientId] = useState('');
  const [language, setLanguage] = useState('auto');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState<{ blob: Blob; mime: string; durationS: number } | null>(null);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [last, setLast] = useState<SubmitResult | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, { original: string; english: string }>>({});

  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const speech = useRef<any>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [v, a, c] = await Promise.all([
      supabase.from('voice_notes').select('id,client_id,language,duration_s,status,error,created_at,transcript_enc,translation_enc').eq('org_id', orgId).order('created_at', { ascending: false }).limit(30),
      supabase.from('approvals').select('id,proposal').eq('org_id', orgId).eq('status', 'pending').eq('tool', 'set_follow_up').order('created_at', { ascending: false }).limit(10),
      supabase.from('clients').select('id,name').eq('org_id', orgId).order('name').limit(500),
    ]);
    setRows((v.data as Row[]) ?? []);
    setPending((a.data as Pending[]) ?? []);
    setClients(c.data ?? []);
    setQueued((await listQueued()).length);
  }, [orgId]);

  useEffect(() => {
    load();
    apiFetch('/api/voice/capabilities').then((r) => r.json()).then((d) => setServerAsr(!!d.serverAsr)).catch(() => setServerAsr(false));
    const on = () => { setOnline(true); flushQueue().then(load); };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load]);

  const start = async () => {
    setMsg(null); setLast(null); setDraft(null); setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || mime || 'audio/webm';
        setDraft({ blob: new Blob(chunks.current, { type }), mime: type, durationS: (Date.now() - startedAt.current) / 1000 });
      };
      mr.start();
      rec.current = mr;

      // The browser's own speech recognition is the fallback transcript when no server ASR is configured.
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const s = new SR();
        s.continuous = true; s.interimResults = false;
        s.lang = LANGS.find((l) => l.code === language)?.bcp47 || navigator.language;
        s.onresult = (e: any) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + ' '; if (t) setTranscript((p) => (p + t).trim()); };
        s.onerror = () => {};
        s.onend = () => { if (speech.current === s && rec.current?.state === 'recording') { try { s.start(); } catch { /* ignore */ } } };
        try { s.start(); speech.current = s; } catch { /* ignore */ }
      }
      startedAt.current = Date.now(); setSeconds(0); setRecording(true);
      timer.current = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.name === 'NotAllowedError' ? 'Microphone access was blocked.' : e.message });
    }
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    const s = speech.current; speech.current = null; try { s?.stop(); } catch { /* ignore */ }
    rec.current?.stop();
    setRecording(false);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setMsg(null); setLast(null); setTranscript('');
    const a = new Audio(URL.createObjectURL(f));
    a.onloadedmetadata = () => setDraft({ blob: f, mime: f.type || 'audio/webm', durationS: isFinite(a.duration) ? a.duration : 0 });
    a.onerror = () => setDraft({ blob: f, mime: f.type || 'audio/webm', durationS: 0 });
  };

  const save = async () => {
    if (!draft || !orgId || !session) return;
    setBusy(true); setMsg(null);
    const note: QueuedNote = { id: uuidv4(), orgId, userId: session.user.id, clientId: clientId || null, language, durationS: draft.durationS, deviceTranscript: transcript, mime: draft.mime, blob: draft.blob, createdAt: Date.now() };
    try {
      await enqueueNote(note); // saved on this device first, so nothing is lost if the connection drops
      if (!navigator.onLine) { setMsg({ kind: 'ok', text: 'Saved on this device. It will upload when you are back online.' }); setDraft(null); await load(); return; }
      const r = await submitNote(note);
      await removeQueued(note.id);
      setLast(r); setDraft(null); setTranscript('');
      setMsg({ kind: 'ok', text: `Done. ${r.facts.length} facts remembered${r.proposals ? `, ${r.proposals} follow-up proposed` : ''}.` });
    } catch (e: any) {
      setMsg({ kind: 'err', text: `${e.message}. The note is kept on this device and will retry.` });
    } finally { setBusy(false); await load(); }
  };

  const toggle = async (r: Row) => {
    if (open === r.id) { setOpen(null); return; }
    setOpen(r.id);
    if (opened[r.id] || (!r.transcript_enc && !r.translation_enc)) return;
    const res = await apiFetch('/api/pii/open', { method: 'POST', body: JSON.stringify({ items: [r.transcript_enc, r.translation_enc] }) });
    const d = await res.json();
    setOpened((o) => ({ ...o, [r.id]: { original: d.opened?.[0] ?? '', english: d.opened?.[1] ?? '' } }));
  };

  const retry = async (r: Row) => {
    setBusy(true);
    const res = await apiFetch(`/api/voice/${r.id}/process`, { method: 'POST' });
    const d = await res.json();
    setMsg(res.ok ? { kind: 'ok', text: 'Processed.' } : { kind: 'err', text: d.error });
    setBusy(false); load();
  };

  const decide = async (p: Pending, decision: 'approve' | 'reject') => {
    const res = await apiFetch(`/api/agent/approvals/${p.id}/decide`, { method: 'POST', body: JSON.stringify({ decision }) });
    if (!res.ok) setMsg({ kind: 'err', text: (await res.json()).error }); else load();
  };

  const name = (id: string | null) => clients.find((c) => c.id === id)?.name ?? 'No client';
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-3xl w-full mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2"><Mic className="w-5 h-5 text-amber-400" />Voice notes</h2>
        <p className="text-sm text-slate-400">Record after a meeting in any language. It is transcribed, translated to English, and its facts are remembered with their quotes.</p>
      </div>

      {!online && <div className="text-xs text-amber-400 flex items-center gap-1.5"><WifiOff className="w-3.5 h-3.5" />Offline. New notes are saved here and upload later.</div>}
      {queued > 0 && (
        <div className="text-xs text-amber-300 flex items-center gap-2">
          {queued} note{queued > 1 ? 's' : ''} waiting to upload
          <button onClick={() => flushQueue().then(load)} className="underline flex items-center gap-1"><RefreshCw className="w-3 h-3" />Sync now</button>
        </div>
      )}
      {serverAsr === false && <p className="text-xs text-slate-500">Speech-to-text runs in your browser (Chrome works best, and it may send audio to the browser vendor). Your admin can connect a server speech model instead.</p>}

      {canWrite && (
        <section className="bg-[#12151a] border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <select className={field} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">About which client? (optional)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={field} value={language} onChange={(e) => setLanguage(e.target.value)} disabled={recording}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {!recording
              ? <button onClick={start} disabled={busy} className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 flex items-center justify-center" aria-label="Start recording"><Mic className="w-6 h-6 text-white" /></button>
              : <button onClick={stop} className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center animate-pulse" aria-label="Stop recording"><Square className="w-6 h-6 text-red-400" /></button>}
            <div className="text-sm text-slate-300">{recording ? <span className="text-red-400">Recording {fmt(seconds)}</span> : draft ? `Recorded ${fmt(Math.round(draft.durationS))}` : 'Tap to record'}</div>
            <label className="ml-auto text-xs text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1.5">
              <Upload className="w-4 h-4" />Upload audio
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </div>

          {draft && (
            <div className="space-y-2">
              <audio controls src={URL.createObjectURL(draft.blob)} className="w-full" />
              <textarea className={`${field} h-24`} value={transcript} onChange={(e) => setTranscript(e.target.value)}
                placeholder={serverAsr ? 'Optional: the server will transcribe the audio.' : 'Transcript from your browser. Fix any mistakes before saving.'} />
              <button onClick={save} disabled={busy} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm flex items-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Transcribing, translating, extracting' : 'Save voice note'}
              </button>
            </div>
          )}
          {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}

          {last && (
            <div className="border border-slate-700 rounded-xl p-3 space-y-2 text-xs">
              <div className="text-slate-400">English ({last.language}{last.asr === 'device' ? ', browser transcript' : ''})</div>
              <p className="text-slate-200">{last.english}</p>
              {last.lowConfidence && <p className="text-amber-400 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" />Translation from this language can be less accurate. Check it against the original below.</p>}
              <ul className="space-y-1">
                {last.facts.map((f, i) => <li key={i} className="flex gap-1.5 text-slate-300"><CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${f.verified ? 'text-emerald-400' : 'text-slate-600'}`} />{f.claim}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {pending.length > 0 && (
        <section className="border border-blue-500/30 bg-blue-500/5 rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-medium text-slate-200">Follow-ups waiting for your OK</h3>
          {pending.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-300">{p.proposal.summary}</span>
              {canWrite && <span className="flex gap-1.5 shrink-0">
                <button onClick={() => decide(p, 'approve')} className="px-2.5 py-1 rounded bg-emerald-600 text-white flex items-center gap-1"><Check className="w-3 h-3" />OK</button>
                <button onClick={() => decide(p, 'reject')} className="px-2.5 py-1 rounded bg-slate-700 text-slate-200 flex items-center gap-1"><Ban className="w-3 h-3" /></button>
              </span>}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-slate-300">Recent notes</h3>
        {rows.length === 0 && <p className="text-xs text-slate-500">No voice notes yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="bg-[#12151a] border border-slate-800 rounded-xl">
            <button onClick={() => toggle(r)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
              <div className="min-w-0">
                <div className="text-sm text-slate-200 truncate">{name(r.client_id)}</div>
                <div className="text-[11px] text-slate-500">{new Date(r.created_at).toLocaleString()}{r.duration_s ? `, ${fmt(r.duration_s)}` : ''}{r.language ? `, ${r.language}` : ''}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${r.status === 'extracted' ? 'border-emerald-500/40 text-emerald-300' : r.status === 'failed' ? 'border-red-500/40 text-red-300' : 'border-slate-600 text-slate-400'}`}>{r.status}</span>
                {open === r.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </button>
            {open === r.id && (
              <div className="px-3 pb-3 space-y-2 text-xs">
                {r.error && <p className="text-red-400">{r.error}</p>}
                {opened[r.id]?.english && <div><div className="text-slate-500">English</div><p className="text-slate-200 whitespace-pre-wrap">{opened[r.id].english}</p></div>}
                {opened[r.id]?.original && r.language !== 'en' && <div><div className="text-slate-500">Original ({r.language ?? '?'})</div><p dir="auto" className="text-slate-300 whitespace-pre-wrap">{opened[r.id].original}</p></div>}
                {r.language && LOW_CONFIDENCE.includes(r.language) && <p className="text-amber-400">Translation from this language can be less accurate.</p>}
                {(r.status === 'failed' || r.status === 'queued') && canWrite && <button onClick={() => retry(r)} disabled={busy} className="px-3 py-1.5 rounded bg-slate-700 text-slate-200">Try again</button>}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
