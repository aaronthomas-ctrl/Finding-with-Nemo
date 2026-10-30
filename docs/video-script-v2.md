# Video script v2: the story, then the proof (target 2:45, hard limit 3:00)

Replaces `video-script.md` as the one to shoot. Same rules: **SAY** is read aloud (about 410 words), **DO** is on screen,
**BADGE** is a small overlay naming the Nebius and NVIDIA part. Record scene by scene and cut the waits (Nebius takes about
5 s to start answering, 20 to 30 s for a multi-step agent answer).

## What judges must take away (every scene serves one of these)
1. **A real gap:** nothing gave you data on nearby, explorable sites, so you had no starting point in the field.
2. **It works live:** map, agent, research, memory, in one flow, on a public URL.
3. **Nebius + NVIDIA are the engine:** three Nemotron models by role, plus embeddings, all on Token Factory.
4. **Trust:** every claim links to a source; unverifiable claims are dropped; attacks are blocked.
5. **Useful anywhere:** a business or one person, any trade, any city.

## Screen guide (what to have open)
| Scene | Page and route | Feature to show |
| --- | --- | --- |
| 1 | Google Maps tab, then **Prospecting** `/` | Empty map, organisation selector |
| 2 | `/onboarding` then **Prospecting** `/` | Individual setup, ticked tags with quotes, map opens on your city |
| 3 | **Prospecting** `/` | Area + radius, agent chat, approval card, selected client question |
| 4 | **Pipeline** `/pipeline` then a client profile | Cited web research card and source links |
| 5 | **Prospecting** `/` route drawer, then **Voice notes** `/voice` | Route from a start point, Hindi voice note facts |
| 6 | **Memory** `/memory` | Glowing 3D view, dots light up, source quote |
| 7 | Editor card, optional **Settings** `/settings` | Numbers and audit log |
| 8 | GitHub README, live URL | Architecture, repo, URL |

Pre-open these tabs in this order so you only switch tabs, never hunt for pages on camera.

## Before recording
- Hosted URL, not localhost. Chrome, 1080p, notifications off, no keys visible, microphone check.
- Two accounts: a **fresh individual** (scene 2) and a **business account with the demo orgs attached** (scenes 3 to 6).
- Demo org for scenes 3 to 6: **Bean & Co Supplies** (cafe supplier, Dubai). Do one silent run of every prompt first; the first request after idle is slow.
- Use short prompts. Keep your own AI request allowance (`AI_CALLS_PER_USER`) high on the recording account.
- Voice scene: use Chrome (browser speech recognition makes the transcript; Nebius does the translation and fact extraction).

---

### Scene 1: The gap (0:00 to 0:20)
**OPEN:** first a plain Google Maps tab (any city), then the app at `/` (**Prospecting**, left sidebar) with the organisation selector at the top of the sidebar.
**DO:** Start on a plain Google Maps view of a city. Cut to the empty map in the app, then flip the organisation selector through two businesses.
**SAY:** "When I went out to find customers, there was no product that told me what is around me: the businesses nearby, what they do, and who is worth a visit. So I built one. This is Finding with Nemo. You get instant research, and an agent that acts, in the field and in your own space, powered by NVIDIA Nemotron on Nebius, with Tavily for the live web."
**BADGE:** Nebius Token Factory + NVIDIA Nemotron 3 + Tavily

### Scene 2: Anyone can start (0:20 to 0:40)
**OPEN:** `/onboarding` on the fresh account (Step 1 "No, just me", then Step 3 with Country, City and the text box). After Approve, the app lands on **Prospecting** (`/`). Show the glowing tag chips with a tick, hover one for its quote.
**DO:** Fresh account. "No, just me". Enter country and city, then: `I want vegan bakeries near Dubai Marina to sell oat milk to.` Build. Show the review card, point at a ticked tag and hover to show its quote, press Approve. The map opens on your city.
**SAY:** "Business or just one person, you say where you are and what you want. Tavily reads the public web and Nemotron Ultra drafts my tags and search areas. Every ticked tag has a quote from a real page. I approve once, and the map opens on my city."
**BADGE:** Ultra: profile pack  |  Tavily: web research

### Scene 3: Explore the map with the agent (0:40 to 1:15)
**OPEN:** **Prospecting** (`/`). Left panel: "1. Search Area & Region", pick a focus-area chip and a radius (for example 25 km); the circle appears on the map. Use the **Agent chat** panel for the three prompts. Then click one result card in the right list so it is the selected business.
**DO:** Switch to **Bean & Co Supplies**. Select a city and radius on the map. In the chat:
1. `Find software and IT companies in my selected area.` (results appear, tags are used per search)
2. `Save these.` Show the proposal card and press **Approve**; point out it also remembers the new tag.
3. Click one saved company, then ask: `What do we know about this client?`
**SAY:** "I pick an area. I do not have to draw it again or explain it: the agent sees my screen. It searches Google Maps for my own tags inside that area, and proposes what to save. Nothing changes until I approve. It even remembers the new tag for next time. Then I click a client and ask what we know, and it already knows which one I mean."
**BADGE:** Super: agent with tool calling  |  Google Maps search per tag

### Scene 4: Instant, cited research (1:15 to 1:40)
**OPEN:** **Pipeline** (`/pipeline`), click a saved client to open its profile (`/pipeline/<id>`). Scroll to the **Web research with citations** card and press **Fetch cited web research**. Click a numbered source link under it.
**DO:** Open that client's profile. Press **Fetch cited web research**. Show the brief with [1] [2] numbers, then click a source link.
**SAY:** "Now the research, instantly. Tavily brings back the live web, and Nemotron writes a short brief. Each sentence carries a quote from its source, and our code keeps it only if that exact quote is on the page. Claims that cannot be proved are dropped, so I only see what the page really says."
**BADGE:** Tavily search  |  Super: brief  |  Evidence Gate

### Scene 5: In the field (1:40 to 2:05)
**OPEN:** back on **Prospecting** (`/`) for the route request; the **route drawer** opens on the right. Then **Voice notes** (`/voice`) in the sidebar: pick the client, language Detect, press record.
**DO:** Back to the map chat: `Plan a route from Dubai Marina to my nearest clients.` Route drawer opens at the start point, press Approve. Then switch to the Voice page, pick the client, speak the Hindi sentence (below), Save. Show the original, the English and the ticked facts.
`आज मैं ग्रीन स्प्राउट कैफे के मालिक से मिला। वे जनवरी में दूसरी शाखा खोल रहे हैं और शुक्रवार तक ओट मिल्क का कोटेशन चाहते हैं।`
**SAY:** "Out in the field, I ask for a route that starts where I am. After the visit I speak a note in my own language. It is translated, stored encrypted, and each fact has to pass the Evidence Gate. A date becomes a follow-up I can approve."
**BADGE:** Nano: stop selection  |  Super: translation  |  Ultra: fact extraction

### Scene 6: It remembers (2:05 to 2:25)
**OPEN:** **Memory** (`/memory`) in the sidebar. Show the 3D view, then use the agent chat on this page. Click a dot to open its source quote.
**DO:** Memory page, slowly rotate the glowing 3D view. Chat: `What do we know about Green Sprout Cafe's plans?` The dots light up. Click one to show its source quote.
**SAY:** "Everything the team learns becomes a memory, one glowing dot each, embedded on Token Factory. I ask a question and the dots the agent used light up, with links back to their sources. The next teammate does not start from zero."
**BADGE:** Embeddings on Nebius Token Factory

### Scene 7: Trust and limits (2:25 to 2:42)
**OPEN:** the editor card (not the app). Optionally cut to **Settings** (`/settings`, admin only) to show the audit log.
**DO:** A plain card (made in your editor) with three lines: `13 of 13 prompt-injection attacks flagged, none reached the user`, `30 of 30 regression questions passed across 3 businesses`, `Per-organisation row-level security, hard per-user AI limit`.
**SAY:** "Trust is built in. Thirteen of thirteen prompt-injection attacks were flagged. Thirty of thirty test questions passed across three different businesses. Each organisation's data is separate, and every user has a hard AI limit."

### Scene 8: Close (2:42 to 2:55)
**OPEN:** the README architecture picture on GitHub (`github.com/aaronthomas-ctrl/Finding-with-Nemo`), then the live app URL in the address bar.
**DO:** Architecture picture from the README, then the repo link and the live URL.
**SAY:** "Ultra, Super and Nano on Nebius Token Factory, with Supabase and Tavily underneath. Open source, Apache 2.0. A first step for anyone who needs to know what is around them: Finding with Nemo."
**BADGE:** Nebius + NVIDIA Nemotron  |  Apache-2.0

---

## If you run over 3:00
Cut scene 7 to one line, then drop the voice note from scene 5, then shorten scene 2. Never cut scenes 1, 3 or 4: they are the story, the live agent and the cited research.

## If a step is slow or fails
Retry once and cut the wait. If it still fails, show the same result from the seeded data. Never narrate over a long spinner.

## Do not claim
- No "watchers" or "predictions" (removed from the app).
- Do not say latency or token counts; the recorded numbers were affected by a bug and are not measured.
- The 30 of 30 is a regression score (the questions were also used to fix bugs). Say "passed", not "blind test".

## Word count check
About 410 spoken words at a calm pace is roughly 2:45. If your read is slower, trim scene 5 first.

## YouTube upload
- Visibility **Public**. Length under 3:00 including any title card.
- Title: `Finding with Nemo: instant research and an agent for the field, on Nebius + NVIDIA Nemotron`
- First line of the description: the GitHub link, then the live URL, then one paragraph naming the models by role.
