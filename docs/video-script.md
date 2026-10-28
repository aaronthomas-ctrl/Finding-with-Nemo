# Video script (about 2:50, public on YouTube)

Read the **SAY** lines aloud at a calm pace (about 400 words in total). **DO** is what is on screen. **BADGE** is a small
text label to overlay in the editor so judges see the Nebius and NVIDIA usage. Record each scene separately.

## Before recording
- Hosted URL, not localhost. Two accounts: a **fresh** one for scene 2, and the **seeded** one (switch with the sidebar selector).
- Seeded orgs: **Bean & Co Supplies** (cafe supplier, Dubai) for every scene except the title. Do one silent run of each prompt first, because the first request after idle is slower.
- Chrome, 1080p, notifications off, no keys or dashboards visible. Microphone check.
- Fill the **[N]** in scene 7 from `docs/agent-eval-sim.md` after the final evaluation run.

---

### Scene 1: Hook (0:00 to 0:12)
**DO:** Open the app and flip the organisation selector through the three businesses: Bean & Co (cafes), SunHarbor Solar, BrightSmile Dental.
**SAY:** "Sales teams lose what they learn: the voice note in Hindi, the web research, who to visit next. This is Finding with Nemo, a prospecting CRM that adapts to any business and shows its sources."
**BADGE:** Nebius Token Factory + NVIDIA Nemotron 3

### Scene 2: Onboarding (0:12 to 0:35)
**DO:** Fresh account. "No, just me". Type: `I want vegan bakeries near Dubai Marina to sell oat milk to.` Press Build. Show the review card, point at a ticked tag, hover to show its quote, press Approve.
**SAY:** "I'm a new user and I say what I'm looking for. Tavily researches the public web, and Nemotron Ultra on Nebius drafts my tags, tiers and search areas. Every tag with a tick has a quote from a real page. I approve once."
**BADGE:** Ultra: profile pack  |  Tavily: web research

### Scene 3: Agent, map and route (0:35 to 1:05)
**DO:** Switch to **Bean & Co Supplies**, open the map. In the chat type:
1. `Suggest search tags and search vegan bakeries near Dubai Marina.` (results appear on the map)
2. Show the proposal cards, press **Approve** on one.
3. `Plan a route for today starting at Dubai Marina.` (route drawer opens, press Approve)
**SAY:** "Now the agent. Nemotron Super runs it with tool calling. It searches the map and, instead of changing my data, it shows me proposals. I approve. Nano picks the stops, Google orders the route. Nothing changes until I say so."
**BADGE:** Super: agent loop  |  Nano: stop selection

### Scene 4: Voice note (1:05 to 1:30)
**DO:** Voice notes page. Client: Green Sprout Cafe. Language: Detect. Record this sentence in Hindi, then Save:
`आज मैं ग्रीन स्प्राउट कैफे के मालिक से मिला। वे जनवरी में दूसरी शाखा खोल रहे हैं और शुक्रवार तक ओट मिल्क का कोटेशन चाहते हैं।`
(In English: "Today I met the owner of Green Sprout Cafe. They are opening a second branch in January and want an oat milk quote by Friday.")
Show the original, the English translation and the ticked facts. If a follow-up proposal appears, press OK.
**SAY:** "Salespeople speak their own language. This Hindi note is transcribed, translated, and stored encrypted. Each fact passes the Evidence Gate: no quote in the source, no verified fact. A dated next step becomes a follow-up I can approve."
**BADGE:** Super: translation  |  Ultra: fact extraction

### Scene 5: Memory (1:30 to 1:55)
**DO:** Memory page. Slowly rotate the 3D view. In the chat type: `What do we know about Green Sprout Cafe's plans?` The dots light up and the camera moves. Click one dot to show its source quote.
**SAY:** "Everything the team learns becomes a memory, one dot each, embedded on Token Factory. I ask what we know about Green Sprout Cafe. The dots the agent used light up, and every claim links back to its source."
**BADGE:** Embeddings on Nebius Token Factory

### Scene 6: Watcher (1:55 to 2:15)
**DO:** Watchers page. Press **Run now** on the news watcher. When the bell shows a number, open it (the seeded notification is a fallback if the live run is slow).
**SAY:** "Watchers keep an eye on pages for change. Nano filters the noise, Ultra summarises what matters, and a notification arrives live: here, a new cafe opening that will need a milk supplier."
**BADGE:** Nano: change check  |  Ultra: summary

### Scene 7: Trust (2:15 to 2:40)
**DO:** Show a plain card (make it in your editor) with three lines: `13 of 13 injection attacks flagged, none reached the user`, `[N] of 30 real questions passed across 3 businesses`, `Row-level security: each organisation's data is separate`. Cut briefly to the audit log in Settings.
**SAY:** "Trust is the point. I tested thirteen prompt-injection attacks: all thirteen were flagged and none reached the user. Thirty real questions across three businesses: [N] passed. And row-level security keeps every organisation's data apart."

### Scene 8: Close (2:40 to 2:55)
**DO:** Architecture card from the README, then the repo link and the Nebius endpoint URL.
**SAY:** "Three Nemotron models, Ultra, Super and Nano, on Nebius Token Factory, deployed on Nebius, with Supabase and Tavily underneath. Open source, Apache 2.0. Finding with Nemo."
**BADGE:** Deployed on Nebius  |  Apache-2.0

---

## If you run over 3:00
Cut scene 7 first, then shorten scene 6, then record only one Hindi sentence. Never cut scenes 1, 3 and 4.

## If a step is slow or fails live
Retry once and edit the wait out. If it still fails, show the same thing in the seeded data (the route, the cited answer and the notification already exist there).

## YouTube upload
- Visibility **Public** (not unlisted). Length under 3:00 including any title card.
- Title: `Finding with Nemo: an agentic prospecting CRM on Nebius + NVIDIA Nemotron`
- First line of the description: the GitHub link. Then one paragraph naming the models by role and the Nebius endpoint URL.
