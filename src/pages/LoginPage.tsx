import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Compass, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export function LoginPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  if (!loading && session) return <Navigate to="/" replace />;

  const magicLink = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setMsg(error ? { kind: 'err', text: error.message } : { kind: 'ok', text: 'Check your inbox for the sign-in link.' });
    setBusy(false);
  };
  const withPassword = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg({ kind: 'err', text: error.message });
    setBusy(false);
  };
  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setMsg({ kind: 'err', text: error.message });
  };

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#12151a] border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"><Compass className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Finding with Nemo</h1>
            <p className="text-xs text-slate-400">Agentic prospecting CRM</p>
          </div>
        </div>

        <button onClick={google} className="w-full py-2.5 rounded-lg bg-white text-slate-900 text-sm font-medium hover:bg-slate-200 transition-colors">
          Continue with Google
        </button>
        <div className="flex items-center gap-3 my-4 text-xs text-slate-500"><div className="flex-1 h-px bg-slate-800" />or<div className="flex-1 h-px bg-slate-800" /></div>

        <label className="block text-xs text-slate-400 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
          className="w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm focus:border-blue-500 outline-none" />
        {usePassword && (
          <>
            <label className="block text-xs text-slate-400 mt-3 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
              onKeyDown={(e) => e.key === 'Enter' && withPassword()}
              className="w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm focus:border-blue-500 outline-none" />
          </>
        )}
        <button disabled={busy || !email} onClick={usePassword ? withPassword : magicLink}
          className="mt-4 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2">
          <Mail className="w-4 h-4" /> {usePassword ? 'Sign in' : 'Email me a sign-in link'}
        </button>
        <button onClick={() => setUsePassword(!usePassword)} className="mt-3 w-full text-xs text-slate-400 hover:text-slate-200">
          {usePassword ? 'Use a magic link instead' : 'Judge or demo account? Sign in with a password'}
        </button>
        {msg && <p className={`mt-4 text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
