import { useCallback, useEffect, useState } from 'react';
import { Megaphone, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveOrgId } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';

interface Push { id: string; channel: string | null; note: string | null; pushed_at: string; campaign_id: string | null; metadata: any }

const COLLISION_DAYS = 30;

/** Outreach log for one client. Warns when the same offer was pushed recently, so two people do not pitch the same thing. */
export function ClientPushes({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { canWrite, session } = useAuth();
  const [rows, setRows] = useState<Push[]>([]);
  const [channel, setChannel] = useState('message');
  const [note, setNote] = useState('');
  const [offer, setOffer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('push_logs').select('*').eq('org_id', getActiveOrgId()!).eq('client_id', clientId).order('pushed_at', { ascending: false });
    setRows((data as Push[]) ?? []);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const recent = offer.trim()
    ? rows.find((r) => r.metadata?.offer?.toLowerCase() === offer.trim().toLowerCase() && Date.now() - new Date(r.pushed_at).getTime() < COLLISION_DAYS * 864e5)
    : undefined;

  const log = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('push_logs').insert({
      org_id: getActiveOrgId(), client_id: clientId, user_id: session?.user.id, channel, note: note.trim() || null,
      metadata: offer.trim() ? { offer: offer.trim() } : {},
    });
    if (err) setError(err.message); else { setNote(''); setOffer(''); await load(); }
    setBusy(false);
  };

  return (
    <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-blue-400" /> Outreach log for {clientName}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Every offer or pitch sent to this account, across the whole team.</p>
      </div>

      {canWrite && (
        <div className="grid sm:grid-cols-4 gap-2">
          <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Offer or topic"
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm outline-none focus:border-blue-500" />
          <select value={channel} onChange={(e) => setChannel(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm">
            {['message', 'email', 'call', 'visit'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <button disabled={busy || !offer.trim()} onClick={log}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium">Log push</button>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
            className="sm:col-span-4 px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm outline-none focus:border-blue-500" />
        </div>
      )}
      {recent && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> This offer was already pushed on {new Date(recent.pushed_at).toLocaleDateString()}.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">Nothing has been pushed to this client yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {rows.map((r) => (
            <li key={r.id} className="py-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-200">{r.metadata?.offer || 'Outreach'} <span className="text-slate-500">via {r.channel}</span></span>
                <span className="text-xs text-slate-500">{new Date(r.pushed_at).toLocaleDateString()}</span>
              </div>
              {r.note && <p className="text-xs text-slate-400 italic">"{r.note}"</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
