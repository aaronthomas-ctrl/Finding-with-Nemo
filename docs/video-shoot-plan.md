# Video shoot plan: three use cases, one live demo (target 2:50, limit 3:00)

This replaces the scene order in `video-script-v2.md`. The story and models line from that file still apply.
**Use cases we talk about:** (1) job seekers: vacancies and company details, (2) sales teams: welding fabricators and EPC contractors, (3) procurement: finding suppliers.
**What we demo live:** (2), the fabricator and EPC contractor sales flow, because it uses every feature. (1) and (3) are two short clips on the same engine.

## 0. Before you press record (30 minutes, do not skip)
1. **Redeploy:** Render dashboard, Manual Deploy, latest reference. Wait for the green "Live" badge. Check `/api/health`.
2. **Dry run every prompt below once** on the live site, because the first request after idle is slow, and so you know which real companies return good results. Write down the company names you will use.
3. **Accounts:** (a) your **business account**: the org that sells to fabricators and EPC contractors (the one with your welding-products profile and tags); (b) an **individual account** for use cases 1 and 3. Keep `AI_CALLS_PER_USER` high for both, or you will hit the 40-request cap mid-take.
4. **Browser:** Chrome, 1080p, zoom 100%, bookmarks bar hidden, notifications off. Close dev tools. Pre-open tabs in this order: GitHub README, Google Maps (any city), the app (business account), the app in a private window (individual account).
5. **Pick two real targets** from your dry run: **a large EPC contractor** with a real web presence (for the cited research card) and **3 to 5 fabricators** near your chosen area (for saving and the route). Do not use the invented demo clients for web research; the web has nothing on them.
6. **Voice note:** decide to record the audio and **paste the transcript** into the box (browser recognition can fail). Prepare the sentence below.
7. **Screen recorder:** record each take as its own clip. Every take starts with the page already open, and ends 2 seconds after the result appears. Cut spinners in the edit.

## 1. The shot list

| # | Clip | Account and page | Type or do | Show, and hold for 2 s | Time |
| --- | --- | --- | --- | --- | --- |
| A | Hook | Google Maps tab, then app `/` | Show a plain map, cut to the app | The empty map and the sidebar | 0:00 to 0:12 |
| B | Use case 1: jobs | Individual account, **Prospecting** `/` | Search area set to a city (Ras Al Khaimah, 25 km). In chat: `Find software and IT companies hiring in my selected area.` | Map pins and the result list with names and addresses | 0:12 to 0:24 |
| C | Use case 3: procurement | Same account | Chat: `Find steel plate and welding consumables suppliers in my selected area.` | Pins appear, one card opened | 0:24 to 0:34 |
| D | Use case 2 intro | Business account, **Prospecting** `/` | Click your focus-area chip, set radius 25 km. Do not type yet. | The circle on the map | 0:34 to 0:40 |
| E | Find fabricators | Same page | Chat: `Find welding fabrication companies and EPC contractors in my selected area.` | Tool label "Searching the map", then pins, tag chips on results | 0:40 to 0:58 |
| F | Save with approval | Same page | Chat: `Save these.` Show the approval card; press **Approve**. | The card text, including that it also remembers new tags | 0:58 to 1:12 |
| G | Selected client | Same page | Click one saved company on the list, then chat: `What do we know about this client?` | It names the right company (no "which one?") | 1:12 to 1:22 |
| H | Cited research | **Pipeline** `/pipeline`, open the EPC contractor's profile | Press **Fetch cited web research** | The brief with [1] [2], then click one numbered source | 1:22 to 1:42 |
| I | Agent web search | Chat on the same client | `Any recent news about <contractor name> in the UAE? Cite sources.` | Label "Searching the web with Tavily", answer with links, the line "I searched the live web with Tavily" | 1:42 to 2:02 |
| J | Route | **Prospecting** `/` | Chat: `Plan a route starting at <your hotel or landmark> to my nearest saved fabricators.` Approve in the drawer. | The drawer with the start point first and stops after it | 2:02 to 2:18 |
| K | Voice note | **Voice notes** `/voice` | Pick the client, record 10 s, paste the transcript, Save | Original, English, ticked facts | 2:18 to 2:32 |
| L | Memory | **Memory** `/memory` | Chat: `What do we know about <fabricator you spoke about>?` | Dots light up, click a dot for its quote | 2:32 to 2:44 |
| M | Close | README architecture, then the live URL | Scroll to the diagram | Repo link and URL | 2:44 to 2:55 |

Cut order if you run over: drop clip C first, then K, then G. Never cut E, F, H, I.

## 2. Exact text to say (about 420 words; read at a calm pace)

**A (hook):** "When I went out to find customers, nothing told me what was around me: which businesses are nearby, what they do, and who is worth a visit. So I built Finding with Nemo. It gives instant research and an agent that acts, in the field and in your own space, using NVIDIA Nemotron on Nebius, with Tavily for the live web."

**B (jobs):** "It works for a job seeker. Pick an area and ask for software and IT companies. You get a map of employers and their details."

**C (procurement):** "It works for procurement. Ask for steel and welding consumables suppliers and you get the nearby suppliers on the map."

**D to E (sales):** "Now the main case: a sales team selling to welding fabricators and EPC contractors. I select my area, then ask. The agent sees my screen, so I never have to describe the area. It searches Google Maps for my own tags inside that circle."

**F:** "It proposes what to save, and nothing changes until I approve. It remembers new tags for next time."

**G:** "I click a company and ask what we know. It already knows which one I mean."

**H:** "Now research. Tavily brings back the live web, and Nemotron writes a short brief. Each sentence carries a quote from its source. Our code keeps a sentence only if that exact quote is on the page, so I only see what the page really says."

**I:** "I can also just ask the agent for recent news. It says it is searching with Tavily, and it answers with sources."

**J:** "In the field I ask for a route from where I am. The nearest fabricators become the stops."

**K:** "After a visit I record a voice note. It is translated and each fact is checked against what was said."

**L:** "Everything the team learns becomes a memory, one dot each. I ask a question and the dots the agent used light up, with links to the source."

**M (close):** "Three NVIDIA Nemotron models run on Nebius Token Factory, each with a job. Ultra does the careful reasoning and fact extraction. Super runs the agent and writes the research briefs. Nano does fast checks like route stops, tags and flagging unsupported sentences. Embeddings power the memory, and Tavily brings in the live web so every claim points to a real page. Open source, Apache 2.0. Finding with Nemo."

## 3. What it contributes (say these as the voice-over for B, C and the close; one each)
- **Job seekers:** find employers around you and see what each company does, without ten tabs.
- **Sales teams:** a prospecting list you can trust, with sources, and an agent that does the legwork.
- **Procurement:** shortlist nearby suppliers in minutes.
- **For every team:** a memory that does not leave when a person does, and no claim without a source.

## 4. Things that can go wrong, and what to do
| Problem | Fix |
| --- | --- |
| Agent takes 30 to 60 s | Normal. Cut the wait. Do not narrate over a spinner. |
| Search returns the wrong kind of business | Set the tag filter first (pick the tag chip), then run clip E again. |
| Research card finds little | Use a bigger company, not a small local shop. |
| Voice recognition fails | Paste the transcript. Do not say "transcribed from my voice". Say "the transcript is captured". |
| "Request limit reached" | Use the unlimited account, or ask me to raise your cap. |
| Judge sees blank map | Confirm the Supabase redirect URL and Maps referrer settings are saved. |

## 5. After recording
1. Edit to under **3:00**. Add the small label badges from `video-script-v2.md` (Nemotron + Nebius + Tavily).
2. Upload to YouTube as **Public**. Title: `Finding with Nemo: instant research and an agent for the field, on Nebius + NVIDIA Nemotron`. First line of the description: the GitHub link, then the live URL, then one paragraph naming the models by role (from `docs/models-used.md`).
3. Do not state latency or token numbers, and describe the 30 of 30 as a regression score.
