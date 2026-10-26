// Fails the build if industry- or country-specific words creep back into src/ or server/.
import fs from 'node:fs';
import path from 'node:path';

const BANNED = /\b(esab|weld\w*|emirate\w*|fabricat\w*|lincoln|ewm|callington|musaffah|mussafah|jebel ali|u\.?a\.?e\b)/i;
const SKIP = /guard-industry-terms/;
const hits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
    if (!/\.(ts|tsx|css|html)$/.test(e.name) || SKIP.test(p)) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => { if (BANNED.test(line)) hits.push(`${p}:${i + 1}: ${line.trim().slice(0, 110)}`); });
  }
};
['src', 'server', 'server.ts'].forEach((t) => fs.existsSync(t) && (fs.statSync(t).isDirectory() ? walk(t) : fs.readFileSync(t, 'utf8').split('\n').forEach((l, i) => BANNED.test(l) && hits.push(`${t}:${i + 1}: ${l.trim()}`))));
if (hits.length) { console.error(`Industry-specific terms found (${hits.length}):\n` + hits.join('\n')); process.exit(1); }
console.log('guard: no industry-specific terms in src/ or server/');
