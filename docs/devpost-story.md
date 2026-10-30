## Inspiration

I wanted to find customers and companies based on how close they are to me, and there was no product that told me what was around me: which businesses are nearby, what they do, and who is worth a visit. Sales tools assume you already know who to call. Real prospecting starts earlier, in the field. And the AI inside most tools states things with no way to check them. I wanted instant research and an agent that acts, on the street and in your own space, where every claim shows its source.

## What it does

**Finding with Nemo** is an agentic prospecting CRM built on a map.

- **Tell it what you want.** A business says what it sells; an individual says what they are looking for and where. Tavily reads the public web and Nemotron drafts a profile, tags and search areas, plus standing instructions for the agent ("playbooks") shaped by what you want research to look for, such as contract wins and LinkedIn pages for a seller, or careers pages and recruiters for a job seeker. You approve them, and the map opens on your city.
- **Pick an area and ask.** The chat agent sees your screen (the area, the results, the client you selected), searches Google Maps for your own tags inside that area, and proposes what to save. Nothing changes until you press Approve, and new tags are remembered for next time.
- **Instant, cited research.** For any client, Tavily brings back the live web and Nemotron writes a short brief. Each sentence carries a quote from its source, and our code keeps it only if that exact quote appears on the page. You only see what the page really says. The agent can do the same from chat ("any recent news on this contractor?") and tells you when it used Tavily.
- **Memory that works for your agent.** Say "remember that Qasr Meridian wants quotes in dirhams" and it is stored in the organisation's memory, recalled by every later chat, and shown as a dot in a glowing 3D memory view that lights up when the agent uses it.
- **In the field.** Plan a route that starts where you are, and record a voice note in your own language: it is translated, stored encrypted, and its facts are checked against what was said.
- **Keeps learning your work.** The playbooks are refreshed from what you search, save and ask, and you can read, edit or roll them back.

**Use cases:** job seekers (nearby employers, careers pages, recruiters), sales teams (we demonstrate welding suppliers selling to fabricators and EPC contractors) and procurement (nearby suppliers). Any trade and any city, with no code changes.

## How we built it

- **NVIDIA Nemotron on Nebius Token Factory, each model with a job.** **Nemotron 3 Ultra** does careful reasoning: onboarding, extracting facts with their quotes, fact-checking. **Nemotron 3.5 Super-VL** runs the tool-calling agent loop, writes research briefs and translates voice notes. **Nemotron 3.5 Lightning** does fast checks: tagging, picking route stops, and a verifier that marks any reply sentence with no supporting source as "not verified". **Qwen3-Embedding-8B** (also on Token Factory) powers memory search. If a model is withdrawn, the app switches to its successor automatically.
- **Tavily** is the route to the live web: company research, onboarding, fact-checking and project finding.
- **Supabase** holds everything with row-level security per organisation (the server runs every request as the signed-in user, so database policies apply to every agent action), plus pgvector, auth, storage and realtime. **Google Maps Platform** provides places, geocoding and directions.
- React, TypeScript, Vite, Tailwind and Express, shipped as a Docker image built by GitHub Actions and hosted on Render. A hard per-user cap on AI requests keeps free judge access safe.

## Challenges we ran into

1. **Making "cited" mean something.** The Evidence Gate marks a fact verified only if its quote is found word for word in the source. In practice many model-written findings fail that check and are dropped, which is the point.
2. **An agent that does not ask what is on screen.** Early versions asked the user to draw an area that was already selected, or lost track of which client was open. Sending the agent the screen state fixed it.
3. **Honest limits.** Token Factory has no speech-to-text, so voice notes use the browser's recognition with a typed fallback. There was no Nemotron embedding model, so memory search uses Qwen. Multi-step answers, especially web research, can take 20 to 80 seconds.
4. **Models that move.** Two models we built on were announced as obsolete during the hackathon, so we moved to their replacements and added an automatic fallback.

## Accomplishments we are proud of

- One codebase for any trade and any city, with every write behind an approval card.
- 13 of 13 prompt-injection attacks flagged, and a 30-question agent regression across three unrelated businesses passed 30 of 30. That is a regression score on the earlier models, since those questions also helped us find bugs.
- Cited research where unsupported claims are dropped rather than shown.

## What we learned

Evidence beats confidence. Writing the test before trusting a defence found bugs I would have shipped, and a model sentence only counts when code can find its quote on the page.

## What is next

Scheduled watchers as Nebius Jobs, real speech-to-text with an NVIDIA speech model, a Nemotron safety model when it is available on Token Factory, and team assignment of leads.

## Pre-hackathon work

This project started from an earlier prototype, "Client Pipeline & Prospecting CRM": a single-user, browser-only map and pipeline app hard-coded for welding suppliers in the UAE, with no login and Gemini for AI. The pre-hackathon state is tagged `pre-hackathon` in the repository, and `git diff pre-hackathon..main` shows what was built during the hackathon: the multi-tenant Supabase schema with row-level security, login and onboarding with roles, the Nebius model gateway (Gemini removed), the chat agent with approvals, memory with the Evidence Gate and 3D view, voice notes, cited web research, playbooks, prompt-injection defences and tests, usage caps, an audit log and evaluations.
