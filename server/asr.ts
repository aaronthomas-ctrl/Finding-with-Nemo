/**
 * Speech-to-text. Token Factory has no audio endpoint, so ASR is a separate, OpenAI-compatible service:
 * NVIDIA NIM (Nemotron / Parakeet / Canary ASR) or a self-hosted NIM. Without it the app falls back to the
 * transcript the browser produced while recording.
 *
 *   ASR_BASE_URL  e.g. https://integrate.api.nvidia.com/v1 or your own NIM
 *   ASR_API_KEY   (or NVIDIA_NIM_API_KEY)
 *   MODEL_ASR     model name
 */
export const asrConfigured = () => !!(process.env.MODEL_ASR && process.env.ASR_BASE_URL && (process.env.ASR_API_KEY || process.env.NVIDIA_NIM_API_KEY));

export async function transcribe(audio: Buffer, mime: string, language?: string | null): Promise<{ text: string; language?: string }> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), `note.${mime.includes('mp4') ? 'm4a' : mime.includes('wav') ? 'wav' : 'webm'}`);
  form.append('model', process.env.MODEL_ASR!);
  if (language && language !== 'auto') form.append('language', language);
  const res = await fetch(`${process.env.ASR_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ASR_API_KEY || process.env.NVIDIA_NIM_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Speech-to-text failed (${res.status})`);
  const data: any = await res.json();
  return { text: String(data.text ?? '').trim(), language: data.language };
}
