---
name: e11-dashboard
description: Epic 11 dashboard was already ~90% built as the merged Insights/Overview; only closed FR-11.3/11.4 gaps
metadata:
  type: project
---

Epic 11 (Dashboard & Presentation) was evaluated 2026-07-15 and found to be ~90% already delivered by the existing "Insights"/Overview page (`frontend/src/steps/ResultsStep.tsx`) — the deliberately-merged single home (Dashboard + Results merge, logged in `docs/architektur_entscheidungen.md`).

**Decision (confirmed with user):** extend the existing Overview, do NOT build a separate Dashboard page or a `GET /dashboard` endpoint. Both would be regressions — a separate page re-introduces the two-competing-homes problem the merge solved; a new endpoint duplicates logic the page already composes via `Promise.allSettled` over snapshot/analysis/next-cart/recommendations/pantry (which is the engineering task's own "or compose existing endpoints" alternative).

**Implemented (only the real gaps):**
- FR-11.3 — an always-available "Upload a receipt" button in the Overview header (hidden in the empty `noData` state, which has its own CTA), routing to the Pantry upload flow via `onNavigate("pantry")`. No duplicate uploader.
- FR-11.4 — a compact "📄 X receipts · Y items" counter surfaced on the main view (previously only inside "Show details").

Frontend-only change (ResultsStep.tsx + 3 i18n keys: results.uploadReceipt / receiptsCounter / itemsCounter). Already-satisfied stories left untouched: S1 hub/nav, S2 empty state, S3 score/detail/ranking cards, S4 variant-B consumption ([[e10-eaten-feedback]]) + cross-user comparisons hidden by absence (@post-mvp). User declined the optional edit-profile affordance (👤 nav icon covers FR-11.8) and the explicit cross-user guard.
