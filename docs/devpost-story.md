## Inspiration

When I went out to find customers, there was no product that told me what was around me: which businesses are nearby, what they do, and who is worth a visit. Sales tools assume you already know who to call. Real prospecting starts earlier, in the field, and the AI inside most tools states things with no way to check them. I wanted instant research and an agent that acts, on the street and in your own space, where every claim shows its source.

## What it does

**Finding with Nemo** is an agentic prospecting CRM built on a map.

- **Tell it what you want.** A business says what it sells; an individual says what they are looking for and where. Tavily reads the public web and Nemotron drafts a profile, tags and search areas. You approve them, and the map opens on your city.
- **Pick an area and ask.** The chat agent sees your screen (the area, the results, the client you selected), searches Google Maps for your own tags inside that area, and proposes what to save. Nothing changes until you press Approve, and new tags are remembered for next time.
- **Instant, cited research.** For any client, Tavily brings back the live web and Nemotron writes a short brief. Each sentence carries a quote from its source, and our code keeps it only if that exact quote appears on the page. You only see what the page really says. The agent can do the same from chat ("any recent news on this contractor?") and tells you when it used Tavily.
- **In the field.** Plan a route that starts where you are, record a voice note in your own language (translated, stored encrypted, facts quote-checked), and ask what the team knows. Every learned fact is a glowing dot in a 3D memory view that lights up when the agent uses it.

**Use cases:** job seekers (nearby employers and company details), sales teams (we demonstrate welding fabricators and EPC contractors), and procurement (shortlist nearby suppliers). The same app serves a cafe supplier, a solar installer and a dental supplier with no code changes.

## How we built it

- **NVIDIA Nemotron 3 on Nebius Token Factory**, each with a job. **Ultra** does careful reasoning: onboarding, extracting facts with their quotes, fact-checking. **Super** runs the tool-calling agent loop, writes research briefs and translates voice notes. **Nano** does fast checks: tagging, picking route stops, and a verifier that marks any reply sentence with no supporting source as "not verified". **Qwen3-Embedding-8B** (also on Token Factory) powers memory search.
- **Tavily** is the route to the live web: company research, onboarding, fact-checking and project finding.
- **Supabase** holds everything with row-level security per organisation (the server runs every request as the signed-in user, so database policies apply to every agent action), plus pgvector, auth, storage and realtime. **Google Maps Platform** provides places, geocoding and directions.
- React, TypeScript, Vite, Tailwind and Express, shipped as a Docker image built by GitHub Actions and hosted on Render. A hard per-user cap on AI requests keeps free judge access safe.

## Challenges we ran into

1. **Making "cited" mean something.** The Evidence Gate marks a fact verified only if its quote is found word for word in the source. In practice many model-written findings fail that check and are dropped, which is the point.
2. **Prompt injection.** We built thirteen attack pages and a runner; the process found real bugs in our own screening. All 13 were flagged and none reached the user. The Nemotron models resisted nearly everything even with our defences off, and we report that plainly.
3. **An agent that does not ask what is on screen.** Early versions asked the user to draw an area that was already selected, or lost track of which client was open. Sending the agent the screen state fixed it.
4. **Honest limits.** Token Factory has no speech-to-text, so voice notes use the browser's recognition with a typed fallback. Token counts from a streaming bug were inflated in one evaluation run; we fixed the metering and no longer quote them. Multi-step answers can take 20 to 60 seconds.
5. **Google's terms.** Places coordinates may only be stored briefly, so we geocode on save and clear Places coordinates after 30 days with a database job.

## Accomplishments we are proud of

- One codebase for any trade and any city, with every write behind an approval card.
- 13 of 13 prompt-injection attacks flagged; a 30-question agent regression across three unrelated businesses passed 30 of 30 (a regression score, since those questions also helped us find bugs).
- Cited research where unsupported claims are dropped rather than shown.

## What we learned

Evidence beats confidence. Writing the test before trusting a defence found bugs we would have shipped, and a model sentence only counts when code can find its quote on the page.

## What is next

Scheduled watchers as Nebius Jobs, real speech-to-text with an NVIDIA speech model, a Nemotron safety model when it is available on Token Factory, and team assignment of leads.

## Pre-hackathon work

This project started from an earlier prototype, "Client Pipeline & Prospecting CRM": a single-user, browser-only map and pipeline app hard-coded for welding suppliers in the UAE, with no login and Gemini for AI. The pre-hackathon state is tagged `pre-hackathon` in the repository, and `git diff pre-hackathon..main` shows what was built during the hackathon: the multi-tenant Supabase schema with row-level security, login and onboarding with roles, the Nebius model gateway (Gemini removed), the chat agent with approvals, memories with the Evidence Gate and 3D view, voice notes, cited web research, prompt-injection defences and tests, usage caps, an audit log, seed data and evaluations.
