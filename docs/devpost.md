# Devpost submission draft

Copy this into the Devpost form. Items in **[brackets]** are for you to fill in.

## Fields

| Field | Value |
| --- | --- |
| Project name | Finding with Nemo |
| Tagline | An agentic prospecting CRM that works for any business, and shows its sources. |
| Track | **[choose the track on the Devpost form]** |
| Repository | https://github.com/aaronthomas-ctrl/Finding-with-Nemo (make it public; Apache-2.0) |
| Hosted URL | **[Nebius endpoint URL after deploy, see docs/deploy.md]** |
| Judge login | **[email and password of the judge account, created in Supabase Auth]**. Tell judges the seeded orgs are visible through the org switcher. |
| Demo video | **[link; check the length rule]**, script in docs/demo-script.md |
| Existing-project declaration | See below. Use it word for word. |

## Existing-project declaration

This project started from an earlier prototype, "Client Pipeline & Prospecting CRM": a single-user, browser-only map and
pipeline app hard-coded for welding suppliers in the UAE, with no login and Gemini for AI. The pre-hackathon state is
tagged `pre-hackathon` in the repository, and `git diff pre-hackathon..main` shows everything built during the
hackathon: multi-tenant Supabase schema with row level security, login and onboarding with roles, the Nebius model
gateway (Gemini removed), the 22-tool chat agent with approvals, memories with the Evidence Gate and 3D view, voice notes,
watchers with notifications, project graph and predictions, prompt-injection defences and test suite, usage caps, audit log,
PWA, seed data and evaluations. All industry-specific content was removed.

## Description (story)

**Inspiration.** Sales tools assume you already know who to call. Real prospecting starts earlier: who are my customers, where are
they, what did my colleague hear on the last visit, what changed this week? And the AI inside most tools states things with no
way to check them.

**What it does.** You say what you sell, or what you are looking for. The app researches the public web, drafts your profile,
tags and search areas, and you approve them. Then a chat agent with 22 tools finds prospects on a map, saves them, plans
the day's route, researches companies, checks claims, and watches pages for change. Salespeople record voice notes in
their own language; they are translated and turned into facts. Every fact is stored with its quote, and shown as a dot in a
3D memory view that lights up when the agent uses it. Anything that would change your data is a proposal you approve.

**How we built it.** Nemotron 3 **Ultra** for reasoning (profile pack, fact extraction with quotes, summaries, predictions),
**Super** for the tool-calling agent loop and translation, **Nano** for fast parallel work (tagging, route stops, change checks, the
reply verifier), all on Nebius **Token Factory**, with Qwen3-Embedding-8B for memory vectors. Supabase holds everything: row
level security per organisation, pgvector, storage, realtime. **Tavily** is the only route to the public web, including public LinkedIn and
Instagram pages. The app server runs every request as the signed-in user, so database policies apply to every agent action.

**Challenges.** (1) Making "cited" mean something: the Evidence Gate marks a fact verified only if its quote is found word for word in the source,
and a verifier pass marks unsupported sentences in replies. (2) Prompt injection: we built thirteen attack pages and a runner, and the
process found real bugs in our own screening. The current Nemotron models resisted nearly everything even with defences off; we report that
plainly. (3) Translation of spoken notes: Malayalam and Urdu were less reliable, so those are flagged and the original is kept.
(4) Google's terms limit how long Places coordinates may be stored; we geocode on save and clear Places coordinates after 30 days with a database cron.

**Accomplishments.** One codebase that serves a cafe supplier, a solar installer and a dental supplier with no code changes;
13 of 13 attack pages flagged and none reaching the user; 22 tools, each write behind an approval card.

**What we learned.** Evidence beats confidence. Writing the test before trusting a defence found several bugs we would have shipped.

**What is next.** Scheduled watchers as Nebius Jobs, real speech-to-text with an NVIDIA NIM key, a Nemotron safety model when available on Token Factory, the `contacts` table, team assignment.

## Built with

Nebius Token Factory, NVIDIA Nemotron 3 Ultra, Super and Nano, Qwen3-Embedding-8B, Tavily, Supabase (Postgres, pgvector, Auth, Storage, Realtime), Google Maps Platform (Places, Geocoding, Directions), React, TypeScript, Vite, Tailwind, Express, 3d-force-graph, umap-js, Docker.

## Numbers to quote (from the repo, reproducible)

- Injection suite: 13 pages flagged of 13; 70 of 70 trials blocked (Super) and 70 of 70 (Nano); with defences off 3 of 66 and 0 of 66 attacks succeeded. See docs/injection-results.md.
- Agent evaluation: **30 of 30 questions passed on the latest run** (26 of 30 on the first run; the four failures were fixed). 100% tool success, 100% citation rate, 100% of write requests produced an approval card, 100% safety. Run through a simulated signed-in user; the questions were also used to find bugs, so this is a regression score. See docs/agent-eval-sim.md.

## Submission checklist

- [ ] Repository public, licence visible, `.env` never committed (it is in `.gitignore`)
- [ ] Rotate the Supabase, Nebius, Tavily and Google keys that were shared during development (none are in the repo, but rotate before making it public)
- [ ] Hosted URL works and the judge login signs in
- [ ] Seed run for the judge account
- [ ] Video uploaded and within the length rule
- [ ] Declaration pasted, tech list filled, track chosen
- [ ] Submit by 18:00 Dubai on 30 Oct, three hours before the deadline
