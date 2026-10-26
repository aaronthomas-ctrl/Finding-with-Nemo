import fs from 'node:fs';
const wav = fs.readFileSync(process.env.TEMP + '/silence.wav').toString('base64');
for (const model of ['nvidia/Nemotron-3.5-Super-VL', 'nvidia/Nemotron-3_5-Lightning']) {
  const r = await fetch(`${process.env.NEBIUS_BASE_URL}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.NEBIUS_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 60, messages: [{ role: 'user', content: [{ type: 'text', text: 'Transcribe this audio.' }, { type: 'input_audio', input_audio: { data: wav, format: 'wav' } }] }] }),
  });
  console.log(model, r.status, (await r.text()).slice(0, 260));
}
