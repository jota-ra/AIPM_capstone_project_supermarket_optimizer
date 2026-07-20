# Nährbert — User Flows

*Derived from `naehrbert_prd.md` and `business_rules.md`. Cross-refs to FR-*/BR-*/R-* IDs. Nothing added beyond what those documents state. Each flow lists Trigger · Steps · Decisions · Edge cases · Error handling · Exit conditions.*

---

## F0. The Loop (overarching cycle)

- **Trigger:** an onboarded user opens the app or uploads a receipt.
- **Steps:** Upload (F4) → Match & Review (F5) → Status-quo attribution (F6) → Gap detection & results (F7) → [first time only] Level-2 (F8) → Next-Cart (F9). Each cycle adds data and sharpens profiles/recommendations.
- **Decisions:** first receipt vs. subsequent (subsequent triggers eaten-feedback variant A); is there enough data for daily intake / trends?
- **Edge cases:** user never uploads (no loop, profile-only); single receipt (snapshot mode, no daily intake).
- **Error handling:** any sub-flow failure returns to a safe state without discarding previously saved data.
- **Exit conditions:** user leaves; all state persisted; the loop resumes next session.

## F1. Sign-up / account creation

- **Trigger:** new user opens the app and chooses "Sign up".
- **Steps:** (1) choose email+password or Google OAuth [FR-1.1]; (2) enter credentials / complete Google consent; (3) age gate — confirm ≥ 16 [BR-P7]; (4) account created in Supabase, session persisted [R-SESSION]; (5) proceed to onboarding (F3).
- **Decisions:** auth method; age ≥ 16?
- **Edge cases:** email already registered → route to login; Google account already linked; incomplete sign-up abandoned before onboarding.
- **Error handling:** OAuth failure/cancel → back to method choice with message; weak/invalid password → inline validation; age < 16 → deny with explanation.
- **Exit conditions:** authenticated + session → onboarding (F3); or user abandons. *(Health-data consent is NOT here — it is captured at Level-2, F8.)*

## F2. Login / returning session

- **Trigger:** returning user opens the app.
- **Steps:** if a valid persisted session exists → land on Dashboard (F11); else show login → authenticate → Dashboard [FR-1.2, R-SESSION].
- **Decisions:** valid session? method?
- **Edge cases:** expired refresh token → re-login; signed up but onboarding incomplete → resume onboarding (F3).
- **Error handling:** wrong credentials → error + retry; OAuth failure → retry.
- **Exit conditions:** authenticated → Dashboard; or exits.

## F3. Onboarding — Level-1 profile

- **Trigger:** first login with an incomplete profile [FR-2].
- **Steps:** (1) ask preferred form of address [FR-2.2]; (2) intro + explain the walk-through [FR-2.1]; (3) **as a scripted chat** (conversational turns, static localized copy — not LLM), step through each category (short explanation → question → reassuring feedback [R-FEEDBACK]): sex-at-birth, DOB, height, weight, exercise frequency, daily movement, meals/snacks, goal, dietary style, allergies/intolerances, dislikes, pregnancy/breastfeeding (if applicable) [§7]; (4) compute ideal profile — BMR → TDEE → macros → micros [FR-3, BR-E*/M*]; (5) land on Dashboard with an "upload first receipt" CTA.
- **Decisions:** sex option (non-binary/"prefer not to say" → mean of both BMR formulas) [BR-E1]; pregnancy question shown only for female profiles [C4]; macro feasibility (BR-M3 "constrained" branch).
- **Edge cases:** non-binary/prefer-not-to-say; out-of-range height/weight; protein+fat exceed target → surface "constrained", never negative carbs [BR-M3]; micronutrient targets deferred until the DGE/EFSA list is finalized [Q1].
- **Error handling:** invalid/out-of-range numeric inputs → inline validation; missing required field → block completion with a prompt.
- **Exit conditions:** ideal profile generated + persisted → Dashboard; every answer editable later (F12).

## F4. Receipt upload & extraction

- **Trigger:** user taps "Upload receipt" [FR-4].
- **Steps:** (1) select/capture files — JPG/JPEG/PNG/PDF/photo, multi-select [FR-4.1]; (2) show data-sufficiency disclaimer [FR-4.2]; (3) if a prior receipt exists → eaten-feedback variant A while extraction runs [F10]; (4) extract per file: date, store, item count, items (name/qty/unit/price); normalize units to the canonical enum; classify food vs non-food [FR-4.3, R-EXTRACT, R-NONFOOD]; (5) proceed to matching & review (F5).
- **Decisions:** first vs. subsequent receipt (variant-A prompt); each file = one receipt [R-FILE].
- **Edge cases:** single receipt photographed across multiple images (out of scope, MVP); non-food-only receipt; very sparse basket (< 20 items → low confidence) [BR-C3]; missing date/store (nullable).
- **Error handling:** rate-limited → retry; service unavailable → try later; invalid image (no parseable line items / unsupported MIME) → typed error; storage-upload failure → non-fatal, parsing still succeeds [FR-4.4].
- **Exit conditions:** extracted structured items → review (F5); or user cancels the upload.

## F5. Product matching & review / correction

- **Trigger:** extraction completes [FR-5, FR-6].
- **Steps:** (1) auto-match each food item through the tiers — Tier 0 learned → OFF identity → BLS whole-food → OFF→BLS nutrition bridge → category fallback [BR-MT0–MT4]; (2) show review list (extracted text, matched product, qty, unit — all editable) [FR-6.1]; (3) user confirms, corrects, searches OFF/BLS (nutrition-bearing results only), or marks "no match" [FR-6.2, FR-6.3]; (4) persist confirmed/corrected matches to the verified store, log no-match items [FR-6.4, R-WRITE, BR-MT6]; (5) compute nutrition totals [FR-5.3] → status-quo (F6).
- **Decisions:** accept auto-match vs. correct; which database; "no match"; does the action cast a vote? (Tier-0 pass-through does not) [R-WRITE].
- **Edge cases:** BLS-only match (no NOVA) → later grouped on sugar alone [BR-G6]; low-confidence/"unknown" items flagged; contested global key (< 50% agreement → not auto-served) [BR-MT6]; ~30% of OFF items unmatched.
- **Error handling:** OFF/BLS live-search API failure → show cached/none, allow manual pick or "no match"; matching never blocks — it degrades to the category estimate [BR-MT4].
- **Exit conditions:** all items resolved (matched / fallback / no-match) → status-quo (F6); user may leave review and resume later.

## F6. Status-quo attribution

- **Trigger:** review complete; building the status-quo profile [FR-7, BR-Intake].
- **Steps:** (1) "shared?" → if yes, people incl. you (N) → user share % [BR-I2]; (2) ask meals-outside + receipts-completeness (feed confidence, not intake) [BR-I4, BR-C4]; (3) compute per-item consumption windows (category default → repeat-purchase refine → feedback correct) [BR-T1–T3]; (4) roll up daily intake [BR-I5]; (5) compute eating-occasion coverage [BR-I6]; (6) produce status-quo sub-profiles → gap detection (F7).
- **Decisions:** shared vs. not; enough dated receipts / repeats to refine windows.
- **Edge cases:** first-ever purchase of an item (no repeat → category default); one-off items (only feedback corrects) [BR-T3]; single receipt (snapshot, low confidence, no daily intake yet).
- **Error handling:** unanswered questions → safe defaults (share 100%, waste 0) with reduced confidence.
- **Exit conditions:** status-quo profile computed → gap detection (F7).

## F7. Gap detection & results

- **Trigger:** status-quo profile ready (after each upload) [FR-9].
- **Steps:** (1) compare ideal vs. status-quo per sub-profile [BR-HS1]; (2) per-nutrient bars + closeness, excluding no-data nutrients [BR-HS2, BR-S2a]; (3) overall health score + confidence badge [BR-HS3, BR-HS4]; (4) group items Healthy/OK/Unhealthy/grey [BR-G*]; (5) show what-to-drop / what-to-add [FR-9.3]; (6) weekly/monthly trends if data permits [FR-9.6]; (7) first time here → trigger Level-2 prompt (F8); (8) congratulate improvement vs. previous [FR-9.5].
- **Decisions:** first gap analysis? (→ Level-2 prompt); enough data for trends/daily intake; confidence band.
- **Edge cases:** micronutrients gated (weight 0) until Q1; low confidence → score shown with badge, not inflated [BR-HS4]; balanced basket → "on target" state; single receipt → snapshot framing only.
- **Error handling:** incomplete data → render what's available + confidence caveat + "estimated, not measured" disclaimer.
- **Exit conditions:** results displayed → Next-Cart (F9) or Dashboard.

## F8. Level-2 functional questionnaire

- **Trigger:** first render of the results screen — a **non-blocking** prompt; re-invited ≤ once/session until completed or dismissed twice [FR-2.4, R-L2TRIG]. The questionnaire uses the same **scripted chat UI** as onboarding (B1).
- **Steps:** (1) explicit health-data consent screen [FR-2.5, BR-P1]; (2) if consented → step through symptom/lifestyle questions (bowel, stool, bloating, stomach, energy, hunger, satiety, sleep, concentration, mood, hydration, alcohol, supplements) with reassuring feedback [§7 Level-2]; (3) persist → recompute recommendation prioritization (symptom relevances) [BR-S4].
- **Decisions:** consent given? each question optional (skippable).
- **Edge cases:** declines consent → app fully usable, all symptom multipliers = 1.0 [FR-2.5, BR-S4]; dismissed twice → stop prompting; consent revoked later → F15.
- **Error handling:** partial answers saved; never blocks any Level-1 feature.
- **Exit conditions:** answers saved (or skipped) → results/Dashboard; "not medical advice" disclaimer persists [BR-P6].

## F9. Next-Cart recommendations

- **Trigger:** user taps the Next-Cart area [FR-10].
- **Steps:** (1) ask days-to-shop + desired home-cooked frequency [FR-10.1]; (2) score candidates (severity × confidence × symptom × goal), filter by dietary style/allergies/dislikes [BR-S1–S6]; (3) output 1 primary + ≤2 alternatives (add/replace) + ≤2 reduce [BR-S1]; (4) *(Post-MVP)* propose recipes → select → shopping list [FR-10.3].
- **Decisions:** any eligible candidate? reduce suggestions only when over-consumed red items exist.
- **Edge cases:** all candidates excluded by profile → "no suitable recommendation"; no gaps → nothing to add; low data → still runs, low confidence.
- **Error handling:** recommendation-table load failure → degrade to "no recommendation", never crash.
- **Exit conditions:** recommendations shown (+ feedback widget); recipes/shopping list are post-MVP.

## F10. Consumption / eaten feedback (A/B)

- **Trigger:** variant **A** — at the next receipt upload [FR-8.1, R-EATEN]; variant **B** — daily via the dashboard [FR-11.7]. Assignment is sticky by user-id hash.
- **Steps:** ask what was eaten / still have / thrown away for prior items → adjust remaining quantities + waste_fraction [BR-T3, BR-I3].
- **Decisions:** variant A or B (sticky); named items vs. basket-level waste.
- **Edge cases:** no prior receipt (variant A not shown); user skips (defaults: waste 0).
- **Error handling:** skip allowed; partial input saved.
- **Exit conditions:** consumption updated → feeds status-quo recompute (F6).

## F11. Dashboard (hub)

- **Trigger:** after login or after any flow completes [FR-11].
- **Steps:** view health score + confidence, macro/micro detail, receipt/item counter, item health ranking; actions: upload new receipt (F4), update consumption (F10-B), edit profile (F12); selected recipes (post-MVP) [FR-11.*].
- **Decisions:** which action; data present vs. empty state.
- **Edge cases:** brand-new user (no receipts) → empty state + upload CTA; cross-user comparison hidden (post-MVP).
- **Error handling:** partial data → render only the cards that have data.
- **Exit conditions:** user navigates into a sub-flow or exits.

## F12. Profile management & edit

- **Trigger:** user opens Edit Profile [FR-12].
- **Steps:** view/adjust all Level-1 & Level-2 data → recompute profiles on change [R-RECALC]; switch language [FR-12.2, R-LANG]; export data (F13); delete profile (F14).
- **Decisions:** which field; language; export vs. delete.
- **Edge cases:** changing weight/goal/activity → ideal profile recomputes; age auto-updates from DOB.
- **Error handling:** invalid values → validation.
- **Exit conditions:** saved + recomputed → back to Dashboard.

## F13. Data export (GDPR portability)

- **Trigger:** user requests export in Edit Profile [FR-12.4, BR-P3].
- **Steps:** assemble profile + receipts + derived profiles → JSON/CSV → download/deliver.
- **Decisions:** format (JSON/CSV).
- **Edge cases:** large dataset (many receipts).
- **Error handling:** generation failure → retry/notify.
- **Exit conditions:** export file delivered.

## F14. Account / profile deletion (GDPR erasure)

- **Trigger:** user taps Delete Profile [FR-12.3, BR-P3].
- **Steps:** confirm → hard cascade delete of all personal data (profile, receipts, images, derived profiles, the user's verified-match votes) → sign out.
- **Decisions:** confirm deletion?
- **Edge cases:** de-identified aggregate verified-match mapping is **retained** (no personal data); in-flight uploads.
- **Error handling:** partial-delete failure → retry to guarantee completeness.
- **Exit conditions:** account and personal data removed; user signed out.

## F15. Consent revocation (Level-2)

- **Trigger:** user revokes health-data consent in Edit Profile [BR-P1].
- **Steps:** disable Level-2 processing → hide Level-2 inputs → recommendations fall back to no-symptom prioritization (all multipliers 1.0) [BR-S4].
- **Decisions:** confirm revoke.
- **Edge cases:** already-collected Level-2 data — processing stops and inputs hide; full removal happens via deletion (F14) or is retrievable via export (F13).
- **Error handling:** n/a (toggle).
- **Exit conditions:** Level-2 off; app remains fully usable.

---

*Gating dependencies surfaced by these flows: **Q1** (DGE/EFSA micronutrient list) gates micro bars/score in F7; **Q6** (A/B feasibility) affects F10; recipe steps in F9 and cross-user cards in F11 are post-MVP.*
