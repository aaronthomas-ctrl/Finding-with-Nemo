import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Brain, Loader2, RefreshCw, ShieldCheck, ShieldAlert, ExternalLink, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch, getActiveOrgId } from '../lib/api';
import { onMemoriesUsed } from '../lib/memoryBus';
import { useAuth } from '../auth/AuthProvider';
import { AgentPanel } from './AgentPanel';

interface Mem { id: string; kind: string; content: string; color: string | null; x: number | null; y: number | null; z: number | null; verified: boolean; source_id: string | null; client_id: string | null; created_at: string }
interface Src { id: string; url: string | null; title: string | null }

const KIND_LABEL: Record<string, string> = {
  fact: 'Fact', interaction: 'Interaction', voice: 'Voice note', profile: 'Profile', project: 'Project', prediction: 'Prediction', web: 'Web', chat: 'Chat',
};

export function MemoryView() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const host = useRef<HTMLDivElement>(null);
  const graph = useRef<any>(null);
  const lit = useRef<Set<string>>(new Set());
  const pulse = useRef(false);

  const [mems, setMems] = useState<Mem[]>([]);
  const [sources, setSources] = useState<Record<string, Src>>({});
  const [clients, setClients] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Mem | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ from_id: string; to_id: string; relation: string }>>([]);

  const load = useCallback(async () => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    const [m, l] = await Promise.all([
      supabase.from('memories').select('id,kind,content,color,x,y,z,verified,source_id,client_id,created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(3000),
      supabase.from('memory_links').select('from_id,to_id,relation').eq('org_id', orgId).limit(6000),
    ]);
    const rows = (m.data as Mem[]) ?? [];
    setMems(rows);
    setLinks(l.data ?? []);
    const srcIds = [...new Set(rows.map((r) => r.source_id).filter(Boolean))] as string[];
    const cliIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
    const srcMap: Record<string, Src> = {};
    for (let i = 0; i < srcIds.length; i += 150) {
      const { data } = await supabase.from('sources').select('id,url,title').in('id', srcIds.slice(i, i + 150));
      (data ?? []).forEach((s: Src) => { srcMap[s.id] = s; });
    }
    setSources(srcMap);
    const cliMap: Record<string, string> = {};
    for (let i = 0; i < cliIds.length; i += 150) {
      const { data } = await supabase.from('clients').select('id,name').in('id', cliIds.slice(i, i + 150));
      (data ?? []).forEach((c: any) => { cliMap[c.id] = c.name; });
    }
    setClients(cliMap);
  }, []);
  useEffect(() => { load(); }, [load]);

  const arrange = useCallback(async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await apiFetch('/api/memory/layout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Layout failed');
      setMsg(`Arranged ${data.positioned} memories.`);
      await load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }, [load]);

  // Lay out automatically when some memories have no position yet.
  useEffect(() => { if (canWrite && mems.length && mems.some((m) => m.x == null) && !busy) arrange(); }, [mems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => mems.filter((m) => m.x != null && !hidden.has(m.kind)), [mems, hidden]);

  // Build the graph once: glowing points in space.
  useEffect(() => {
    if (!host.current) return;
    const el = host.current;

    // One soft white glow, tinted per node and added on top of the dark background so overlapping points shine.
    const glow = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.16, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.42, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();

    const g = (ForceGraph3D as any)({ controlType: 'orbit' })(el)
      .backgroundColor('#03040b')
      .showNavInfo(false)
      .cooldownTicks(0)
      .linkColor(() => 'rgba(140,170,255,0.55)')
      .linkOpacity(0.35)
      .linkWidth(0.3)
      .linkDirectionalParticles(1)
      .linkDirectionalParticleWidth(1.4)
      .linkDirectionalParticleSpeed(0.0035)
      .linkDirectionalParticleColor(() => '#bcd0ff')
      .nodeThreeObjectExtend(false)
      .nodeThreeObject((n: any) => {
        const mat = new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(n.color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: n.verified ? 1 : 0.5 });
        const sp = new THREE.Sprite(mat);
        const base = n.verified ? 12 : 8;
        sp.scale.set(base, base, 1);
        sp.userData = { base, phase: Math.random() * Math.PI * 2 };
        return sp;
      })
      .nodeLabel((n: any) => `<div style="max-width:260px;font:12px sans-serif;padding:6px 8px;border-radius:8px;background:rgba(8,10,24,.92);border:1px solid rgba(140,170,255,.35)"><b style="color:${n.color}">${KIND_LABEL[n.kind] ?? n.kind}</b>${n.verified ? ' ✓' : ' (unverified)'}<br/>${String(n.content).replace(/</g, '&lt;').slice(0, 220)}${n.srcLabel ? `<br/><i style="opacity:.7">${n.srcLabel}</i>` : ''}</div>`)
      .onNodeClick((n: any) => setSelected(n.mem));
    graph.current = g;
    if (import.meta.env.DEV) (window as any).__graph = g;

    // A faint starfield far behind the memories.
    const starCount = 2600;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 900 + Math.random() * 900, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t); pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t); pos[i * 3 + 2] = r * Math.cos(p);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 3.4, map: glow, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
    g.scene().add(stars);
    // Opaque deep-space background (the CSS behind the canvas must not show through the bloom), and a few faint nebula clouds.
    g.scene().background = new THREE.Color(0x02030a);
    for (const [x, y, z, hex, size] of [[-520, 220, -700, 0x5b3cc4, 1500], [560, -260, -760, 0x1f6fb5, 1700], [60, 380, -900, 0x9b2d8f, 1300]] as Array<[number, number, number, number, number]>) {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: hex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }));
      cloud.position.set(x, y, z); cloud.scale.set(size, size, 1);
      g.scene().add(cloud);
    }

    // Bloom makes the bright points bleed light, which is what makes them look like they shine.
    try {
      const bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth || 800, el.clientHeight || 600), 0.9, 0.7, 0.08);
      g.postProcessingComposer().addPass(bloom);
    } catch (e) { console.warn('[memory view] bloom unavailable:', e); }

    // Slow drift so the space feels alive; it pauses while the user is dragging.
    const controls = g.controls();
    if (controls) { controls.autoRotate = true; controls.autoRotateSpeed = 0.45; controls.enableDamping = true; controls.dampingFactor = 0.08; }

    const resize = () => el && g.width(el.clientWidth).height(el.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Twinkle, and pulse the memories the chat just used. Scales are set directly, so nothing is rebuilt each frame.
    let raf = 0;
    const tick = (t: number) => {
      stars.rotation.y += 0.00008;
      for (const n of g.graphData().nodes as any[]) {
        const o = n.__threeObj as any;
        if (!o) continue;
        const { base, phase } = o.userData;
        const isLit = lit.current.has(n.id);
        const s = isLit ? base * (2.1 + 0.9 * Math.sin(t / 220)) : base * (1 + 0.08 * Math.sin(t / 900 + phase));
        o.scale.set(s, s, 1);
        o.material.opacity = isLit ? 1 : n.verified ? 0.95 : 0.5;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); g._destructor?.(); graph.current = null; };
  }, []);

  // Feed data. Positions are fixed, so the layout is the UMAP result and nothing drifts.
  useEffect(() => {
    const g = graph.current;
    if (!g) return;
    const ids = new Set(visible.map((m) => m.id));
    const nodes = visible.map((m) => {
      const s = m.source_id ? sources[m.source_id] : undefined;
      return { id: m.id, kind: m.kind, content: m.content, verified: m.verified, color: m.color || '#94a3b8', x: m.x, y: m.y, z: m.z, fx: m.x, fy: m.y, fz: m.z, mem: m,
        srcLabel: s ? (s.url ? new URL(s.url).hostname : s.title || '') : '' };
    });
    g.graphData({ nodes, links: links.filter((l) => ids.has(l.from_id) && ids.has(l.to_id)).map((l) => ({ source: l.from_id, target: l.to_id })) });
    if (nodes.length) {
      // Orbit around the middle of the memories, not the origin, so the rotation keeps them centred.
      const mid = (k: 'x' | 'y' | 'z') => nodes.reduce((a, n: any) => a + (n[k] ?? 0), 0) / nodes.length;
      const cx = mid('x'), cy = mid('y'), cz = mid('z');
      g.controls()?.target?.set(cx, cy, cz);
      // Frame the cloud from its own spread (the built-in zoom-to-fit cannot measure glowing sprites).
      const radius = Math.max(60, ...nodes.map((n: any) => Math.hypot((n.x ?? 0) - cx, (n.y ?? 0) - cy, (n.z ?? 0) - cz)));
      const dist = radius * 2.4;
      setTimeout(() => g.cameraPosition({ x: cx + dist * 0.35, y: cy + dist * 0.2, z: cz + dist }, { x: cx, y: cy, z: cz }, 900), 150);
    }
  }, [visible, links, sources]);

  // Memories the chat just used light up.
  useEffect(() => onMemoriesUsed((ids) => {
    lit.current = new Set(ids);
    const first = visible.find((m) => ids.includes(m.id));
    if (first && graph.current) graph.current.cameraPosition({ x: (first.x ?? 0) * 1.4, y: (first.y ?? 0) * 1.4, z: (first.z ?? 0) * 1.4 + 160 }, { x: first.x ?? 0, y: first.y ?? 0, z: first.z ?? 0 }, 900);
    setTimeout(() => { lit.current = new Set(); }, 12000);
  }), [visible]);

  const addNote = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await apiFetch('/api/memory/ingest', { method: 'POST', body: JSON.stringify({ text: note, title: 'Pasted note' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add');
      setMsg(`Remembered ${data.stored} facts: ${data.verified} verified by quote, ${data.unverified} unverified${data.dropped ? `, ${data.dropped} dropped as instructions` : ''}.`);
      setNote('');
      await load();
      await arrange();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const counts = useMemo(() => mems.reduce<Record<string, number>>((a, m) => ({ ...a, [m.kind]: (a[m.kind] ?? 0) + 1 }), {}), [mems]);
  const sel = selected ? { src: selected.source_id ? sources[selected.source_id] : undefined, client: selected.client_id ? clients[selected.client_id] : undefined } : null;

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0">
      <div className="relative flex-1 min-h-[320px]">
        <div ref={host} className="absolute inset-0" style={{ background: '#02030a' }} />
        {mems.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-slate-500 p-6 pointer-events-none">
            <div><Brain className="w-10 h-10 mx-auto mb-3 text-slate-600" />No memories yet. Chat with the agent, research a company, or paste a note.</div>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[80%]">
          {Object.entries(KIND_LABEL).filter(([k]) => counts[k]).map(([k, label]) => {
            const color = mems.find((m) => m.kind === k)?.color || '#94a3b8';
            const off = hidden.has(k);
            return (
              <button key={k} onClick={() => setHidden((h) => { const n = new Set(h); off ? n.delete(k) : n.add(k); return n; })}
                className={`px-2 py-1 rounded-full text-[11px] border flex items-center gap-1.5 ${off ? 'opacity-40' : ''} border-slate-700 bg-[#12151a]/90 text-slate-300`}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />{label} {counts[k]}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 bg-[#12151a] p-4 space-y-4 overflow-y-auto max-h-[45vh] md:max-h-none">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Brain className="w-4 h-4 text-blue-400" />Memory</h2>
          {canWrite && <button onClick={arrange} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />Arrange</button>}
        </div>
        <p className="text-xs text-slate-400">Each dot is something the team knows. Colour shows the type; dim dots have no confirmed source. Dots light up when the chat uses them.</p>

        {selected ? (
          <div className="rounded-xl border border-slate-700 p-3 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              {selected.verified ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />}
              {KIND_LABEL[selected.kind] ?? selected.kind}, {selected.verified ? 'verified by a source quote' : 'unverified'}
            </div>
            <p className="text-slate-200 leading-relaxed">{selected.content}</p>
            {sel?.src?.url && (
              <a href={sel.src.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline break-all"><ExternalLink className="w-3 h-3 shrink-0" />{new URL(sel.src.url).hostname}</a>
            )}
            {sel?.src && !sel.src.url && <div className="text-slate-500">Source: {sel.src.title || 'your note'}</div>}
            {sel?.client && <button onClick={() => navigate(`/pipeline/${selected.client_id}`)} className="text-blue-400 hover:underline">Open client: {sel.client}</button>}
            <div className="text-slate-500">{new Date(selected.created_at).toLocaleString()}</div>
          </div>
        ) : <p className="text-xs text-slate-500">Click a dot to see where it came from.</p>}

        {canWrite && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-300">Add a note</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Paste meeting notes or an article. Facts are kept only if their quote is found in the text."
              className="w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-xs outline-none focus:border-blue-500" />
            <button disabled={busy || note.trim().length < 20} onClick={addNote} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs flex items-center gap-1.5">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Remember
            </button>
          </div>
        )}
        {msg && <p className="text-xs text-slate-400">{msg}</p>}
      </aside>
      <AgentPanel onRefreshDB={load} />
    </div>
  );
}
