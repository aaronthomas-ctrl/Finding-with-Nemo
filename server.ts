import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireUser } from './server/auth';
import { places } from './server/routes/places';
import { route } from './server/routes/route';
import { enrich } from './server/routes/enrich';
import { pitch } from './server/routes/pitch';
import { pii } from './server/routes/pii';
import { onboarding } from './server/routes/onboarding';
import { agent } from './server/routes/agent';
import { memory } from './server/routes/memory';
import { voice } from './server/routes/voice';
import { watchers } from './server/routes/watchers';
import { insight } from './server/routes/insight';

const app = express();
app.use(express.json({ limit: '2mb' }));

// Strict CSP: images only from this site, data: URIs and Google Maps. Never an image URL the model wrote.
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com" + (process.env.NODE_ENV !== 'production' ? ' ws://localhost:*' : ''),
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; '));
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Every other API route runs as the signed-in user, so Supabase RLS applies.
app.use('/api', requireUser, places, route, enrich, pitch, pii, onboarding, agent, memory, voice, watchers, insight);

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(port, '0.0.0.0', () => console.log(`Server running on http://localhost:${port}`));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
