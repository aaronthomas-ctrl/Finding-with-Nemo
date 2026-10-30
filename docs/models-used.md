# Which model does what (all on Nebius Token Factory)

Taken from the code (`role:` in `server/`), not from memory. Names come from environment variables, never hardcoded.

| Model | Role | Why this one |
| --- | --- | --- |
| **NVIDIA Nemotron 3 Ultra** (`nvidia/Nemotron-3-Ultra-550b-a55b`) | Careful reasoning and fact extraction | Largest model, used where a wrong answer costs trust |
| **NVIDIA Nemotron 3.5 Super-VL** (`nvidia/Nemotron-3.5-Super-VL`, replaces Nemotron 3 Super, which Nebius is retiring) | The agent and writing | Good tool calling at a speed a chat can use |
| **NVIDIA Nemotron 3.5 Lightning** (`nvidia/Nemotron-3_5-Lightning`, replaces Nemotron 3 Nano, which Nebius is retiring) | Fast, cheap checks and picks | Small jobs that run many times |
| **Qwen3-Embedding-8B** (1024 dims) | Memory search | Token Factory has no NVIDIA embedding model |

Everything runs through one OpenAI-compatible API on **Nebius Token Factory**.

## Feature to model

| Feature (where you see it) | Model | File |
| --- | --- | --- |
| Agent chat: understands the screen, calls tools (search, save, route, research), writes the answer | **Super** | `server/agent/loop.ts` |
| Checks the agent's answer and marks sentences with no supporting source "not verified" | **Nano** | `server/agent/verify.ts` |
| Suggests search tags for a goal | **Nano** | `server/agent/tools/tags.ts` |
| Picks the stops for a route (Google orders them) | **Nano** | `server/agent/tools/routing.ts` |
| Tags businesses automatically when saved | **Nano** | `server/routes/enrich.ts` |
| Client web research brief with citations (Tavily results to cited findings) | **Super** | `server/routes/enrich.ts` |
| Company insight summary | **Super** | `server/routes/enrich.ts` |
| Pitch and message drafts | **Super** | `server/routes/pitch.ts` |
| Voice note: translation to English | **Super** | `server/voice.ts` |
| Voice note: facts pulled from the transcript (Evidence Gate) | **Ultra** | `server/memory.ts` |
| Voice note: dated next steps proposed as follow-ups | **Ultra** | `server/voice.ts` |
| Onboarding: profile, tags and search areas from your description and website | **Ultra** | `server/routes/onboarding.ts` |
| Learning facts from web pages and notes, quote-checked before they count | **Ultra** | `server/memory.ts` |
| Fact-checking a statement against memory and the web | **Ultra** | `server/claims.ts` |
| Finding projects (openings, builds) in text or web results | **Ultra** | `server/projects.ts` |
| Predicted next need for a client (profile page) | **Ultra** | `server/predict.ts` |
| Memory: every stored fact gets an embedding; questions find the closest ones; the 3D memory view | **Qwen3-Embedding-8B** | `server/memory.ts` |

## Where Tavily is used (live web search and page reading)

| Feature (where you see it) | Tavily call | What the model does with it |
| --- | --- | --- |
| Client profile, **Web research with citations** card | Search | Super writes findings; code keeps only those whose quote is on the source page |
| Agent: "recent updates / news about this company" | Search (`research_company`) | Ultra extracts facts, each quote-checked; unverified ones are marked |
| Onboarding: your website and public pages | Extract and search | Ultra drafts tags and search areas from the real pages |
| Agent: fact-checking a statement | Search | Ultra decides supported, contradicted or not found |
| Agent: finding projects (openings, tenders) | Search | Ultra extracts projects and companies |
| Company insight summary | Search | Super summarises |

Other non-model services: Google Maps (places, geocoding, directions) and Supabase (database, auth).

## Honest limits to state if asked
- Speech recognition uses the browser's own recognition, not an NVIDIA speech model (Token Factory has no audio endpoint).
- Embeddings are Qwen3-Embedding-8B because Token Factory offers no NVIDIA embedding model.
- The agent loop uses Super rather than Ultra to keep chat turns usable.
