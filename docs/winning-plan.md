# Winning plan: what judges see, and what to do in the last three days

The organisers' checklist is the scoring sheet. Every item below maps to one line of it. No new features: only what
makes the demo work, the claims provable, and the 3 minutes land.

## 1. Checklist status

| Organiser checklist item | Status | What is left |
| --- | --- | --- |
| Runs on Nebius Token Factory or AI Cloud, uses an NVIDIA open model | **Done in code**: Nemotron 3 Ultra, Super and Nano on Token Factory | Deploy to a Nebius endpoint so "runs on Nebius AI Cloud" is literally true (docs/deploy.md) |
| Fits one of four tracks | **Best Apps and Agents** (agent with 22 tools, approvals, memory, voice, watchers) | Pick it on the form. Mention that individual mode also serves Personal AI, but submit under one track |
| Demo video, under 3 minutes, public on YouTube, shows the app working, explains Nebius + NVIDIA usage | **Not recorded** | Storyboard below. Target 2:50 so the title card cannot push it over |
| Public repo, visible open-source licence, README with setup and run instructions | Licence and README done | Make the repo public, rotate shared keys first |
| Working demo URL | **Not deployed** | Docker build, push, endpoint, judge account, seed (docs/deploy.md) |
| Feedback on Nebius and NVIDIA tools | Draft written: docs/feedback.md | Add your own impressions, paste into the form |
| Teammates added | Unknown | Add them on Devpost and remind them to accept |

## 2. What the simulation found (and what it means for the demo)

I ran the real agent and tools against the seeded database as a simulated signed-in user (`npm run eval:agent -- --sim <email>`).
First run: **26 of 30 passed**, with these real faults, now fixed:

1. **Citations in the wrong bracket style** (full-width 【m:abc】) were not recognised, so no "src" badge appeared. Fixed: all citation forms are normalised.
2. **The agent wrote a route in plain text** instead of calling `plan_route` (it called `get_client` five times, then invented a plan). A hallucinated route on camera would be the worst moment of the demo. Fixed: prompt rules ("never write a route yourself", "never claim something was saved unless a tool confirms it") and ids that are really names are now accepted.
3. **Predictions produced no approval card** when the model passed a name where an id belongs. Fixed.
4. **The verifier covered long answers in "(not verified)"** because it flagged narration like "Let me check". Fixed: narration between tool calls is dropped, and the verifier will not mark more than 40% of a reply.
5. **Row-level security holds**: 21 of 21 isolation checks passed (a stranger sees nothing and cannot write).

Re-run numbers are in `docs/agent-eval-sim.md`. Latency in the simulation (about 28 s median) is inflated by about five database round trips per query from this
machine to a Tokyo-hosted database; real latency from a deployed server will be lower, but **measure it on the hosted app before recording** and keep every
on-camera request to ones that finish in under about 15 seconds.

## 3. What makes judges remember the project

Judges watch many demos. Three things stick: a problem they recognise, something that visibly works, and a claim they can trust.

1. **One sentence they can repeat:** "Prospecting CRM that adapts to any business and proves what it says."
2. **Proof of generality:** switch between three unrelated businesses (cafe supplier, solar installer, dental supplier) in two seconds. Nothing is hard-coded.
3. **Trust, not just intelligence:** every fact has a quote; writes need approval; attacks were tested (13 of 13 flagged, none reached the user). Most agent demos show cleverness. This shows restraint.
4. **Clear Nebius + NVIDIA story:** one slide, model by role: Ultra reasons, Super runs the agent, Nano does the fast work, all through Token Factory, deployed on a Nebius endpoint.
5. **Honesty about limits** in the README (judges notice and reward it).

### Where it can be used (say two of these in the video)
- **Field sales and distribution:** reps record a note after a visit in any language; the whole team gets the facts, cited.
- **Solar, energy and construction installers:** projects and tenders are tracked, and the companies around them are linked with evidence.
- **Healthcare and dental suppliers:** find new clinics opening, predict equipment needs from project stages.
- **Individuals (Personal AI):** "I want vegan bakeries near the Marina to sell oat milk to" becomes tags, a map search and a route.

## 4. Video storyboard v2 (about 2:50, public on YouTube)

Rules: show the real hosted URL, speak slowly, put the **model badge** on screen for each step, and never show keys.

| Time | Show | Say | On-screen badge |
| --- | --- | --- | --- |
| 0:00 to 0:12 | Three org names flash through the switcher | "Sales teams lose what they learn: the voice note in Hindi, the web research, who to visit next. This is Finding with Nemo, a prospecting CRM that adapts to any business and shows its sources." | Nebius Token Factory + NVIDIA Nemotron 3 |
| 0:12 to 0:35 | Fresh account: onboarding as an individual, "vegan bakeries near the Marina to sell oat milk to", approve profile | "It researches the public web with Tavily, and Nemotron Ultra drafts my tags and search areas. Each tag with a tick has a quote found on a real page." | Ultra: profile pack. Tavily: research |
| 0:35 to 1:05 | Chat: "search vegan bakeries near Dubai Marina, save the best three, plan today's route." Show proposal cards, approve, route opens | "The agent runs on Nemotron Super with tool calling. Every change is a proposal I approve. Google orders the route; Nano picks the stops." | Super: agent loop. Nano: stop selection |
| 1:05 to 1:30 | Voice note in Hindi (one sentence): original, English translation, verified facts, follow-up proposal | "Salespeople speak their own language. It is translated, stored encrypted, and each fact passes the Evidence Gate: no quote in the source, no verified fact." | Super: translation. Ultra: facts |
| 1:30 to 1:55 | Memory 3D view; ask "what do we know about Green Sprout Cafe?"; dots light up; click one to show the quote | "Each dot is a memory. The ones the agent used light up, and every answer links back to its source." | Qwen3 embeddings on Token Factory |
| 1:55 to 2:15 | Watchers: Run now, the bell lights up, open the notification | "Watchers check pages for change. Nano filters the noise, Ultra summarises, and I am notified in the app." | Nano: change check. Ultra: summary |
| 2:15 to 2:40 | Numbers card: 13 of 13 attacks flagged, none reached the user; 30-question eval result; "row level security per organisation" | "I tested thirteen prompt-injection attacks and thirty real questions. Here is what held, measured." | none |
| 2:40 to 2:55 | Architecture card with model roles; the Nebius endpoint URL; repo link | "Three Nemotron models on Nebius Token Factory, deployed on Nebius, open source under Apache 2.0." | Deployed on Nebius |

**Cut order if you run long:** the numbers card first, then the watcher, then shorten the voice note. **Never cut:** the hook, the agent
with approvals, the voice note, and the model badges.

**Recording tips**
- Record each segment separately and edit; do a dry run on the hosted URL first because the first request after idle is slower.
- Use the seeded organisation for speed and a fresh account only for onboarding.
- Type the prompts in advance (copy and paste from `docs/demo-script.md`). Retry any step that takes over 15 seconds, then edit the wait out.
- Subtitles on the Hindi segment. 1080p. Check the final length is under 3:00 including any title card.
- YouTube: **Public** (not unlisted), title "Finding with Nemo: agentic prospecting CRM on Nebius + NVIDIA Nemotron", the repo link in the first line of the description.

## 5. Schedule

| When (Dubai) | Do |
| --- | --- |
| **Today (Wed 28)** | Click through the app and report breaks. Run the real agent evaluation with your login. Build the Docker image; deploy to a Nebius endpoint; add its URL to Supabase Auth and the Maps key. Create the judge account; run the seed for it |
| **Thu 29 morning** | Fix anything the hosted app shows. Measure latency on the hosted URL |
| **Thu 29 afternoon** | Record and edit the video; upload to YouTube as Public |
| **Thu 29 evening** | Make the repo public (rotate keys first). Fill Devpost: track, URL, judge login, video, declaration, feedback, teammates |
| **Fri 30** | Buffer. **Submit by 18:00**, three hours before the deadline |

## 6. If something is not ready

- **No Nebius deploy by Thursday noon:** submit a hosted URL on any host that works, state in the README that deployment to a Nebius endpoint is documented in docs/deploy.md but was run elsewhere, and say so plainly. Do not claim what is not true.
- **Voice note unreliable on camera:** pre-record the clip in the seeded org and show the result; the transcript fallback works in Chrome only.
- **A step is flaky:** show the seeded data for it instead of running it live.
