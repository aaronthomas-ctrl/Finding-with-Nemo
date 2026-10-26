// Applies supabase/schema.sql to the database in DATABASE_URL (TLS verified).
// Usage: node --env-file=.env scripts/apply-schema.mjs [file.sql]
// If the server certificate is not in the system store, set PGSSLROOTCERT to the Supabase CA file.
import fs from 'node:fs';
import pg from 'pg';

const file = process.argv[2] || 'supabase/schema.sql';
const ssl = process.env.PGSSLROOTCERT ? { ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8') } : true;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl });
await client.connect();
try {
  await client.query('begin');
  await client.query(fs.readFileSync(file, 'utf8'));
  await client.query('commit');
  const t = await client.query("select count(*)::int as n from information_schema.tables where table_schema='public'");
  const p = await client.query("select count(*)::int as n from pg_policies where schemaname='public'");
  console.log(`applied ${file}: ${t.rows[0].n} tables, ${p.rows[0].n} policies`);
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error('FAILED:', e.message, e.position ? `(position ${e.position})` : '');
  process.exitCode = 1;
} finally {
  await client.end();
}
