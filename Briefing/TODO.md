# ToDo — Repo-Aufräumung, Doku & Reproduzierbarkeit

Stand: 2026-07-20. Kontext: Repo-Struktur aufgeräumt, Reproduzierbarkeit
(schema.sql, .env.example, README, CI) hergestellt. Diese Liste = die noch
**offenen, meist optionalen** Punkte. Das Produkt läuft — nichts hier ist
funktional zwingend.

Legende: 🔴 verwaist/tot · 🟡 legacy · 🟢 live · Risiko = Code/Daten betroffen.

---

## Offen — risikolos, schnell

- [ ] **🔴 Verwaisten Code löschen** (0 Produktiv-Importe, verifiziert):
  - [ ] `backend/app/analytics/adoption_score.py` **zusammen mit** `backend/app/scripts/test_adoption.py` (der Test importiert es → als Paar)
  - [ ] `backend/app/models/pantry.py` (`PantryItem`, null Importe)
- [ ] **🗑️ `löschen/`-Ordner endgültig entfernen** (`git rm -r "löschen"`) — war das Staging vor dem Löschen; Inhalt vorher final durchsehen
- [ ] **Kosmetik / veraltete Doku fixen:**
  - [ ] `backend/app/api/README.md` — nennt `/api/v1`-Prefix, den es nicht gibt
  - [ ] `frontend/README.md` — noch Vite-Template-Boilerplate
- [ ] **`Briefing/aipm_vl.md`** — Scratch-Notiz (Kurs-Themen); löschen oder behalten entscheiden

## Offen — Entscheidung + Risiko (eher später)

- [ ] **🟡 DB-Altlast `user_day_flags`** — verwaiste Tabelle (kein Code-Bezug). Droppen = Migration + `schema.sql`-Update
- [ ] **🟡 Legacy-Spalten** in `receipts` (`upload_time`, `parser_version`, `scan_quality`, `items_count`, `raw_metadata`, `receipt_date`) und `profiles` (`goal`, `activity_level`, `dietary_pattern`, `exclusions`, `weight`/`height`) — nur bewusst mit Migration; **Datenverlust-Risiko**
- [ ] **🟡 Density-System retiren** (`nutrition_model` / `gap_detector` / `nutrition_snapshot`, Endpunkt `/nutrition/snapshot`) — **NICHT** trivial: Frontend ruft `/nutrition/snapshot` aktiv auf, `DISCLAIMER` wird von `receipts.py` + `progress_tracker.py` genutzt. Erst wenn Frontend umgestellt ist. Vorerst **bewusst lassen**.

## Laufend (nächste 1,5–2 Wochen) — von CI erzwungen

- [ ] Bei DB-Änderung (neue Migration) → `backend/db/schema.sql` mitziehen *(CI blockt sonst den PR)*
- [ ] Bei neuer Env-Variable → `.env.example` ergänzen *(CI: `check_env_example.py`)*
- [ ] Bei neuem Setup-Schritt → `README.md` ergänzen
- [ ] Am Ende: frischer Supabase-Schema-Export → `schema.sql` regenerieren (via `backend/db/introspect_queries.sql`) + README-Durchsicht

---

## Erledigt (Referenz)

- [x] Repo-Struktur: `docs/{product,research,decisions,planning,design}`, `data/{BLS,receipts}`, `Archiv/`, `löschen/`
- [x] Legacy-Skripte & obsolete Docs nach `löschen/`; `matching_investigations.ipynb`, `pre_build_questions.md` nach `Archiv/`
- [x] `BLS_data/` → `data/`, `receipts/` → `data/receipts/` (alle Code-/Notebook-Pfade nachgezogen)
- [x] Caches & `.DS_Store` untracked + gitignored
- [x] `backend/db/schema.sql` — DB-Bootstrap von Null (12 Tabellen, aus Live-Export)
- [x] `.env.example` (inkl. `ALLOWED_ORIGINS`), README-Rewrite
- [x] Absicherung: CI-Guard, `check_env_example.py`, `backend/db/README.md`, `introspect_queries.sql`
- [x] `docs/file_inventory.md` — Datei-für-Datei-Status
- [x] Alles committet + nach `origin/main` gepusht (`2c61cf6`)
