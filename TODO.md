# TODO (later stage)

- [ ] Re-test onboarding step 3 with a real description and website; check the profile pack quality (tags, tier rules, presets). Reset helper: `node --env-file=.env scripts/reset-onboarding.mjs <email>`
- [ ] Enable Google sign-in in Supabase and allow the app URL as a redirect (magic links need it too)
- [ ] Create the judge demo account (password sign-in) and note it for Devpost
- [ ] Service-role key into Jobs only (watchers, voice, UMAP, 30-day Places cleanup)
- [ ] NVIDIA NIM key for Nemotron ASR and the safety model (not on Token Factory)
- [ ] Rotate all keys shared in chat after the hackathon
- [ ] Try the chat agent end to end while signed in (tags, map search, save, route, approval cards). Built and type-checked, not yet exercised with a real login
- [ ] Contacts are stored as one encrypted blob in `clients.metadata.contacts_enc`; move to the `contacts` table
- [ ] Removed for now (rebuild if time): Tier 1 watch screens, warehouse stock browser, direct-push ledger. Outreach log and lean campaigns replace them
- [ ] Phase E: memories, Evidence Gate on facts, 3D view, verifier. Phase F: voice notes. Phase G/H: watchers, notifications, project graph
- [ ] Try memory end to end while signed in: paste a note in Memory, watch facts verify by quote, chat and see dots light up, hover citations. Built and type-checked; the Evidence Gate and poisoning filter were checked with a stub database
- [ ] Memory layout runs on demand (UMAP in the server); wrap as a Nebius Job when deploying
- [ ] `check_claim` (supported / contradicted / not found) is not built yet
