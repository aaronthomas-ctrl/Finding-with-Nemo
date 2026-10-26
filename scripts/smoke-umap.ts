import { UMAP } from 'umap-js';
const n = 300, d = 1024;
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// three loose clusters
const data = Array.from({ length: n }, (_, i) => { const c = i % 3; return Array.from({ length: d }, (_, k) => (k % 3 === c ? 1 : 0) + (rnd() - 0.5) * 0.4); });
const t = Date.now();
const out = new UMAP({ nComponents: 3, nNeighbors: 15, minDist: 0.3, random: rnd }).fit(data);
console.log(`umap ${n}x${d} -> ${out[0].length}D in ${Date.now() - t}ms; sample`, out[0].map((v) => v.toFixed(2)));
