# Video script v3: name Nebius, every Nemotron model and Tavily out loud (target 2:50, limit 3:00)

Why this version: judges score what they can hear and see. In every scene you **say the name** of the service or model doing the work, and a small **badge** with the same name sits on screen. Each name is tied to a feature, so a judge can point at the screen and say "that is Tavily" or "that is Nemotron Ultra on Nebius".

Same demo flow and screens as `docs/video-shoot-plan.md` (welding supplier selling to fabricators and EPC contractors). About 440 spoken words.

## The names you will say (practise these)
| Say | It is | Where it shows up |
| --- | --- | --- |
| **Nebius Token Factory** | the one API that serves every model | closing scene, and "on Nebius" in each scene |
| **Nemotron 3 Ultra** | NVIDIA's largest model: careful reasoning, fact extraction | onboarding, quote-checked facts, web-page facts |
| **Nemotron 3.5 Super-VL** | NVIDIA: the agent, research briefs, translation | chat agent, cited research brief, voice translation, playbooks |
| **Nemotron 3.5 Lightning** | NVIDIA: fast checks | tag ideas, route stops, "not verified" checker |
| **Qwen3-Embedding** | embeddings on Nebius | memory search and the 3D memory view |
| **Tavily** | live web search and page reading | onboarding, research brief, chat news, fact-checking |

---

### Scene 1: The gap (0:00 to 0:15)
**OPEN:** a plain Google Maps tab, then the app's **Prospecting** page.
**BADGE:** Nebius Token Factory + NVIDIA Nemotron + Tavily
**SAY:** "When I went out to find customers, nothing told me what was around me, or who was worth a visit. So I built Finding with Nemo: an agent that finds nearby businesses and researches them. It runs on **NVIDIA Nemotron models on Nebius Token Factory**, with **Tavily** for the live web."

### Scene 2: Onboarding (0:15 to 0:35)
**OPEN:** onboarding step 3 (describe the business, then the "what should research look for" box), then the review card with ticked tags.
**BADGE:** Tavily reads the web | Nemotron 3 Ultra drafts the profile
**SAY:** "I describe my business and say what research should look for. **Tavily** reads my website and the public web. **Nemotron 3 Ultra**, on Nebius, drafts my tags and search areas, and each tag keeps a quote from a real page. **Nemotron 3.5 Super** writes my agent's playbooks: how to search and how to research a company for me."

### Scene 3: Find and save (0:35 to 1:05)
**OPEN:** **Prospecting**. Pick the area chip and radius. Chat: `Find welding fabrication companies and EPC contractors in my selected area.` Then `Save these.` and press **Approve**.
**BADGE:** Super-VL: the agent | Lightning: tag ideas | Google Maps
**SAY:** "The chat agent runs on **Nemotron 3.5 Super-VL** with tool calling. It sees my screen, and **Nemotron 3.5 Lightning** suggests the search tags. It searches Google Maps inside my circle, then proposes what to save. Nothing changes until I approve."

### Scene 4: Cited research, with Tavily (1:05 to 1:35)
**OPEN:** **Pipeline**, a real saved contractor, **Fetch cited web research**; click one [1] source.
**BADGE:** Tavily: search | Super-VL: writes the brief | Evidence Gate
**SAY:** "Now research. **Tavily** runs the searches my playbook asks for: projects won, news, the LinkedIn page, careers. **Nemotron 3.5 Super** writes a short brief, and every sentence carries a quote. Our code keeps a sentence only if that exact quote is on the page. So I only see what the page really says."

### Scene 5: Ask the agent for news (1:35 to 2:00)
**OPEN:** chat: `Any recent news about <contractor> in the UAE? Cite sources.` Show the label "Searching the web with Tavily".
**BADGE:** Tavily | Ultra: extracts facts | Lightning: checks the reply
**SAY:** "I can ask the agent directly. It tells me it is searching with **Tavily**. **Nemotron 3 Ultra** extracts the facts from those pages, and **Nemotron 3.5 Lightning** checks the reply and marks any sentence that has no source."

### Scene 6: Memory (2:00 to 2:25)
**OPEN:** chat: `Remember that this client wants quotes in dirhams.` Then open **Memory** (3D view); ask `What do we know about <client>?` and let the dots light up.
**BADGE:** Qwen3-Embedding on Nebius | memory
**SAY:** "I can tell the agent to remember something, and it goes into the team's memory. Memory search uses **Qwen3-Embedding on Nebius**. Every memory is a dot, and the dots the agent used light up, with links to their sources."

### Scene 7: In the field (2:25 to 2:42)
**OPEN:** chat: `Plan a route starting at Al Hamra Mall to my saved clients.` Then **Voice notes**: paste the transcript, Save.
**BADGE:** Lightning: route stops | Super-VL: translation | Ultra: facts
**SAY:** "In the field, **Nemotron Lightning** picks the stops and Google orders them. After a visit, a voice note is translated by **Nemotron Super**, and **Nemotron Ultra** pulls out the facts, each one checked against what was said."

### Scene 8: Close (2:42 to 2:55)
**OPEN:** README architecture picture, then the live URL.
**BADGE:** Nebius Token Factory | NVIDIA Nemotron | Tavily | Apache-2.0
**SAY:** "Every model call goes through one API on **Nebius Token Factory**: Nemotron Ultra, Nemotron 3.5 Super and Lightning from NVIDIA, plus Qwen embeddings. **Tavily** brings in the live web. Open source, Apache 2.0. Finding with Nemo."

---

## Rules while recording
- Say the full name once per scene (for example "Nemotron 3.5 Super-VL"), then the short form ("Super") is fine.
- Say "on Nebius" or "Nebius Token Factory" in at least six scenes. Say "Tavily" in scenes 1, 2, 4, 5 and 8.
- Do not say speed or token numbers. Do not call the 30-of-30 a blind test. Do not mention watchers or predictions.
- If a model name is wrong on screen after you change settings, check `docs/models-used.md`.

## Badge text for the editor (copy exactly)
1. Nebius Token Factory + NVIDIA Nemotron + Tavily
2. Tavily: web research  |  Nemotron 3 Ultra: profile  |  Nemotron 3.5 Super: playbooks
3. Nemotron 3.5 Super-VL: agent  |  Nemotron 3.5 Lightning: tag ideas
4. Tavily: search  |  Nemotron 3.5 Super-VL: brief  |  Evidence Gate: quote check
5. Tavily  |  Nemotron 3 Ultra: facts  |  Nemotron 3.5 Lightning: reply check
6. Qwen3-Embedding on Nebius: memory search
7. Nemotron 3.5 Lightning: route  |  Nemotron 3.5 Super: translation  |  Nemotron 3 Ultra: facts
8. Nebius Token Factory  |  NVIDIA Nemotron  |  Tavily  |  Apache-2.0
