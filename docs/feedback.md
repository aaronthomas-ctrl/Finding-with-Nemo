# Feedback for Nebius and NVIDIA (draft for the submission form)

Written from what actually happened while building Finding with Nemo in one week. Edit freely, and add your own
impressions. Specific beats polite.

## Nebius Token Factory

**What worked well**
- **OpenAI-compatible API.** The `openai` SDK worked with only a new `baseURL`. Tool calling, streaming and `stream_options.include_usage` all behaved as documented. Moving from Gemini took about an hour of code change.
- **`chat_template_kwargs: { enable_thinking: false }`** turns reasoning off on Nemotron 3 Super and Nano. That one switch is what made the agent loop fast enough to use. It is easy to miss; a line about it on each Nemotron model page would save people time.
- **Embeddings `dimensions` parameter.** `Qwen/Qwen3-Embedding-8B` returned 4096 dimensions by default and 1024 on request, which fit pgvector's HNSW limit with no extra work.
- **Latency.** Ultra with thinking off answered short JSON tasks in roughly 0.5 to 1.5 s, which made "Ultra for reasoning" practical in the request path, not just in batch jobs.

**What got in the way**
- **No speech-to-text, and no audio input on any chat model.** `/audio/transcriptions` returns 404 and the multimodal models reject `input_audio`. A voice-note feature (a natural fit for Nemotron ASR) needed a second provider. Even one hosted multilingual ASR model would change what people can build here.
- **No Nemotron embedding model and no Nemotron safety model** in the catalogue. We used Qwen3-Embedding and rule-based screening instead, which weakens the "all NVIDIA" story.
- **Reasoning is on by default and eats the token budget.** Nano with `max_tokens: 200` returned `content: null` and `finish_reason: length` because all tokens went to hidden reasoning. A response field or header saying "reasoning consumed N of your tokens" would help.
- **Model ids are inconsistent** (`nvidia/nemotron-3-super-120b-a12b` lower case, `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` mixed case, `nvidia/Nemotron-3_5-Lightning` with an underscore). Easy to mistype and no alias list.
- **Endpoint documentation.** The `nebius ai endpoint create` reference lists no health-check or probe option and no autoscaling flags, and the jobs reference shows no schedule option. We could not tell whether a scheduled job is possible without an external cron.

**Suggestions**
- A "recipes" page: an agent with tool calling and streaming on Nemotron, with the reasoning switch and token accounting shown.
- Per-key usage and latency in the console so a hackathon team can see where tokens went.

## NVIDIA (Nemotron 3)

**What worked well**
- **Tool calling on Super is reliable.** With 22 tools in one request, tool selection was correct on every probe we ran, including multi-step chains such as draw an area, then search it, then propose saving.
- **Resistance to prompt injection.** On 13 attack styles (hidden text, fake roles, encoded payloads, spoken commands and others), Super and Nano ignored the injected instructions almost every time, even with our defences switched off: 3 of 66 attacks succeeded on Super and 0 of 66 on Nano. That is a real strength, and worth saying in the model cards.
- **Nano as a worker.** Parallel tagging, change checks and a reply verifier ran fast and cheaply at Nano size.
- **Ultra's quote discipline.** Asked to copy exact words as evidence, Ultra's quotes matched the source text in the large majority of cases, which is what makes a "verified by quote" feature possible.

**What was weaker**
- **Low-resource language translation.** Super mistranslated "oat milk" in Malayalam ("Otis Milk") and Urdu ("out-of-state shipping"); Ultra was no better in our test. Arabic, Hindi and Tagalog were fine. A documented list of languages tested per model would help.
- **Instruction to "copy exactly" is not always followed:** quotes that joined two sentences failed our exact-match check, so we kept the check in code instead of trusting the model.
- **The reasoning-trace field name differs** between models (`reasoning` vs `reasoning_content`), which broke naive parsing until we handled both.

**What we would build next if these existed**
- Nemotron ASR on Token Factory, so voice notes stay entirely on Nebius.
- A hosted Nemotron safety model for screening untrusted web text before an agent sees it.
