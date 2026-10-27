# Demo video script

**Check the length rule on the Devpost page before recording** (it could not be read automatically). The script below is
about 3 minutes; the trim notes show what to cut for a shorter limit.

**Setup before recording**
- Two accounts: a **fresh judge account** (for onboarding as an individual) and your **seeded account** (`npm run seed -- --email you@example.com --activate`, then use the org switcher).
- Browser at 1280x720, light zoom, notifications off. Have a second tab with `/injection-tests/index.html` ready.
- Use the hosted URL, not localhost, so the judges see the deployed app.
- Mic check for the voice note. Say the sentence in a language other than English (Hindi or Arabic worked best in testing).

| Time | Screen | Say / do |
| --- | --- | --- |
| 0:00 | Login | "Finding with Nemo is a prospecting CRM that adapts to any business. Nothing about the industry is hard-coded." Sign in as the judge account. |
| 0:12 | Onboarding step 1 to 3 | Choose **No, just me**. Type: "I want vegan bakeries near Dubai Marina to sell oat milk to." Press Build. Say: "Tavily reads the public web, Nemotron Ultra drafts the profile, and every tag with a check has a quote found on a real source." Approve. |
| 0:40 | Chat panel | Ask: "Suggest search tags and search that area." Show the tag proposal card, approve it, show the chips. Say: "Writes are proposals. I approve them." |
| 1:00 | Map | "Draw a 2 km circle around Jumeirah Beach Residence, then search for vegan bakeries." The polygon appears and results land on the map. "Save the three best." Approve. Mention "geocoded coordinates, Places data stays in memory." |
| 1:25 | Route | Switch to the seeded org. "Plan a route for today starting at Dubai Marina." Nano picks the stops, **Google Directions orders them**; the route drawer opens. Approve the card. |
| 1:45 | Voice note | Open **Voice notes**, pick Green Sprout Cafe, record 10 to 15 seconds in Hindi or Arabic. Show the original and the English translation and the verified facts. "Stored encrypted. The facts passed the Evidence Gate: each has a quote." Show the follow-up proposal and approve it. |
| 2:15 | Memory | Open **Memory**. Slowly rotate the 3D view. Ask in the chat: "What do we know about Green Sprout Cafe's plans?" The cited dots **light up** and the camera moves. Click one: source quote and link. |
| 2:35 | Watcher | Open **Watchers**, press **Run now** on the news watcher. The **bell** lights up live. Click the notification. "Nano filters noise, Ultra summarises, Tavily is the only route to the public web." |
| 2:50 | Safety | Show `/injection-tests`. "Thirteen attack pages. The agent ignored them, and the audit log shows what was blocked." Open **Settings** to show usage meter and audit log in two seconds. |
| 3:05 | Close | "Nebius Token Factory, three Nemotron models, Supabase row level security per organisation, Tavily for research. Thank you." |

**If you need to cut:** drop the safety segment first, then the route, then shorten the voice note to one sentence.

**Tavily prize.** Say "Tavily" out loud in three places: onboarding research, the research tool in chat, and the watcher.

**Do not show:** API keys, the `.env` file, the Supabase dashboard, or real client data (the seed is synthetic).
