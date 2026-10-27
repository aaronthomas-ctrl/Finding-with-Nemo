// Writes a minimal package.json for the production image: only what dist/server.cjs requires at runtime.
// Usage: node scripts/runtime-package.mjs <source package.json> <target package.json>
import fs from 'node:fs';

const RUNTIME = ['@supabase/supabase-js', 'cheerio', 'dotenv', 'express', 'openai', 'umap-js'];
const [src = 'package.json', out = 'package.runtime.json'] = process.argv.slice(2);
const full = JSON.parse(fs.readFileSync(src, 'utf8'));
const dependencies = Object.fromEntries(RUNTIME.map((n) => {
  if (!full.dependencies[n]) throw new Error(`${n} is not in dependencies`);
  return [n, full.dependencies[n]];
}));
fs.writeFileSync(out, JSON.stringify({ name: 'nemo-runtime', private: true, version: '1.0.0', dependencies }, null, 2));
console.log(`runtime dependencies: ${RUNTIME.join(', ')}`);
