import { Router } from 'express';
import { canWrite, type AuthedRequest } from '../auth';
import { assertWithinQuota } from '../usage';
import { asrConfigured } from '../asr';
import { processVoiceNote, LOW_CONFIDENCE_LANGS } from '../voice';

export const voice = Router();

/** Tells the recorder whether server-side speech-to-text is set up or the browser transcript will be used. */
voice.get('/voice/capabilities', (_req, res) => res.json({ serverAsr: asrConfigured(), lowConfidence: LOW_CONFIDENCE_LANGS }));

voice.post('/voice/:id/process', async (req, res) => {
  const r = req as unknown as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role is read-only' });
  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    res.json(await processVoiceNote(r, req.params.id));
  } catch (e: any) {
    console.error('[voice]', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});
