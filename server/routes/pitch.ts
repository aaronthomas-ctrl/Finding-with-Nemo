import { Router } from 'express';
import type { AuthedRequest } from '../auth';
import { chatJson } from '../llm';
import { tokenSink, assertWithinQuota } from '../usage';
import { loadOrgContext } from '../org';
import { pitchSystemPrompt } from '../prompts/pitch';
import { fence } from '../security/untrusted';

export const pitch = Router();

pitch.post('/generate-campaign-pitch', async (req, res) => {
  const r = req as AuthedRequest;
  const b = req.body;
  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    const org = await loadOrgContext(r.sb, r.orgId);
    const out = await chatJson({
      role: 'super',
      maxTokens: 1200,
      temperature: 0.5,
      onUsage: tokenSink(r.sb, r.orgId),
      messages: [
        { role: 'system', content: `${pitchSystemPrompt(org)}\nReturn JSON with keys whatsApp, email, emailSubject, callScript, targetHook. Use the placeholders {contact_name}, {company} and {salesman_name}. The call script must handle the objection "we already have a supplier".` },
        { role: 'user', content: `Offer: ${b.brandName ?? ''} ${b.productName ?? ''} (ref ${b.sku ?? '-'}), category ${b.category ?? '-'}.\nList price ${b.regularPrice ?? '-'}, offer price ${b.offerPrice ?? '-'} (${b.discountPercent ?? 0}% off), minimum order ${b.moq ?? '-'}.\nTarget segments: ${(b.targetCategories || []).join(', ') || 'general'}.` },
      ],
    });
    res.json(out);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'Pitch generation failed' });
  }
});

pitch.post('/personalize-pitch', async (req, res) => {
  const r = req as AuthedRequest;
  const { contactName, company, salesmanName, baseWhatsApp, baseEmail, enquiryHistory } = req.body;
  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    const org = await loadOrgContext(r.sb, r.orgId);
    const history = Array.isArray(enquiryHistory) && enquiryHistory.length
      ? `Documented history from the CRM:\n${enquiryHistory.map((e: any) => `- ${e.date}: ${e.productLine} (qty ${e.quantity}, outcome ${e.outcome})`).join('\n')}\nReference only these facts to build rapport. Invent nothing else.`
      : 'There is no history for this client. Do not mention any past purchase. Just fill in the variables and polish the tone.';
    const out = await chatJson<{ whatsApp?: string; email?: string; contextUsed?: string }>({
      role: 'super',
      maxTokens: 900,
      temperature: 0.5,
      onUsage: tokenSink(r.sb, r.orgId),
      messages: [
        { role: 'system', content: `${pitchSystemPrompt(org)}\nReturn JSON with keys whatsApp, email, contextUsed.` },
        { role: 'user', content: `Personalise for ${contactName} at ${company}, from ${salesmanName}.\n${history}\nBase WhatsApp template:\n${fence(String(baseWhatsApp ?? ''), 'template')}\nBase email template:\n${fence(String(baseEmail ?? ''), 'template')}` },
      ],
    });
    if (!out.whatsApp) throw new Error('Invalid output format');
    res.json(out);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: 'Personalization failed' });
  }
});
