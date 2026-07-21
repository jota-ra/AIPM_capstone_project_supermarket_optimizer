# File Inventory — Verbindung, Nutzung & Status

Was jede Datei tut, wie sie mit dem Rest verbunden ist, und ob sie **in
der Produktfunktion aktiv** ist. Stand: 2026-07-20 (nach Repo-Umbau).

**Status-Legende**
| | Bedeutung |
|---|---|
| 🟢 | **Live** — im ausgelieferten Produktpfad, von einer API-Route erreichbar |
| 🟡 | **Live (Legacy)** — noch verdrahtet, aber durch neueres System abgelöst → Retire-Kandidat |
| 🔴 | **Verwaist** — nirgends importiert, toter Code |
| 🔵 | **Dev/Test** — Skripte, Test-Harnesses, Fixtures; nicht im Deploy-Pfad |
| 📄 | **Doku/Daten/Config** — kein Laufzeit-Code |

Wie das erzwungen bleibt: siehe [backend/db/README.md](../backend/db/README.md) + CI.

---

## Root — Config & Deploy

| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `README.md` | Projekt-Einstieg / Setup | 📄 |
| `Dockerfile` | Backend-Container (Render) | 📄 Deploy |
| `render.yaml` | Render-Service-Definition | 📄 Deploy |
| `requirements.txt` | Backend-Python-Deps (von Dockerfile/Render genutzt) | 📄 Deploy |
| `.env.example` | Env-Vorlage (Backend + Frontend, eine Root-`.env`) | 📄 |
| `.gitignore`, `.python-version` | Tooling | 📄 |

## Backend — Einstieg & Config

| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `backend/app/main.py` | FastAPI-App; bindet die 9 Router ein, CORS (`ALLOWED_ORIGINS`) | 🟢 |
| `backend/app/core/config.py` | Pydantic-Settings (Supabase-Keys, Coach-Flag) aus Root-`.env` | 🟢 |

## Backend — API-Router (`backend/app/api/`)

Alle in `main.py` eingebunden → alle 🟢.

| Datei | Endpunkte / Verbindung | Status |
|---|---|---|
| `receipts.py` | `POST/GET /receipts`, Review, manuelles Matching, Bild — orchestriert Ingestion → Matching → Verified-Store | 🟢 |
| `profile.py` | `/profile*` inkl. `/me`, `/{id}/level2`, Export — treibt Ideal-Profile (E2) | 🟢 |
| `nutrition.py` | `/nutrition/analysis` (E7), `/status-quo` (E6), `/snapshot` (Legacy-Density) | 🟢 |
| `recommendations.py` | `/next-cart` (E8) + `/recommendations` | 🟢 |
| `feedback.py` | `/feedback` zu Empfehlungen | 🟢 |
| `analytics.py` | `/analytics*`, Adoption-Score | 🟢 |
| `pantry.py` | `/pantry*` — Vorratsbestand & Log | 🟢 |
| `products.py` | OFF/BLS-Debug-Lookup + manueller Match-Pin | 🟢 |
| `consumption.py` | `/consumption/context`, `/feedback` (E10 Eaten-Feedback) | 🟢 |
| `api/README.md` | API-Notizen (teils veraltet: nennt `/api/v1`-Prefix, der nicht genutzt wird) | 📄 |

## Backend — Services (`backend/app/services/`)

### Rezept-Ingestion (E3)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `receipt_parser.py` | Orchestriert Parsing; `RECEIPT_PARSER_MOCK`-Pfad | 🟢 |
| `local_extractor.py` | On-Device OCR/PDF/Text (Tesseract/PyMuPDF) — ersetzt alten Gemini-Vision-Call | 🟢 |
| `receipt_text_parser.py` | Deterministischer Parser für alle Inputs | 🟢 |
| `units.py` | Mengen-/Einheiten-Parsing | 🟢 |
| `storage.py` | Supabase-Bild-Upload + Löschung nach Parse (E12) | 🟢 |

### Matching / Nährwert-Auflösung (E2/E4)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `resolver.py` | E4 Tiered Resolver — komponiert matcher + bls_matcher + verified/non-food | 🟢 |
| `matcher.py` | OFF-Fuzzy-Matcher (Task 2.2); Schwellwerte von confidence/bls importiert | 🟢 |
| `bls_matcher.py` | Lokale BLS-DB (`data/BLS_4_0…xlsx` → `_bls_cache.json`) | 🟢 |
| `off_api.py` | Open-Food-Facts-Client (+ `_off_cache.json`) | 🟢 |
| `text_similarity.py` | Token-aware Fuzzy-Ähnlichkeit | 🟢 |
| `base_terms.py`, `non_food_terms.py`, `fallback_categories.py` | Normalisierung, gelernte Non-Food-Keys, Kategorie-Fallbacks | 🟢 |
| `nutrition_mapping.py` | Epic-2-Glue: `map_items` → resolver | 🟢 |
| `source_labels.py` | Quellen-Labels (OFF/BLS/verified) | 🟢 |
| `verified_matches.py` | Tier-0 gelernte Matches (E5), JSON- oder Supabase-Backend | 🟢 |

### Ideal-Profil — aktuelles Zielsystem (E2)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `ideal_profile.py` | Mifflin-St-Jeor-Engine; liest `business_rules.md`/`reference_data.md` | 🟢 |
| `nutrition_personalization.py`, `nutrient_requirements.py` | Personalisierung + Bedarfswerte | 🟢 |

### Status-Quo — Ist-Aufnahme (E6)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `status_quo.py` | Rezept-abgeleitete Tagesaufnahme (inkl. `waste_fraction`) | 🟢 |
| `consumption_timeframe.py`, `intake_estimator.py` | Zeitfenster + bestätigter Pantry-Verbrauch | 🟢 |

### Analyse / Gaps / Score (E7)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `gap_engine.py` | Ideal-vs-Status-Quo-Balken + Score | 🟢 |
| `confidence_model.py` | Konfidenz des Gesamt-Snapshots | 🟢 |
| `absolute_gap_detector.py` | Bedarf-vs-Ist (Eisen/Protein/…) | 🟢 |
| `grouping.py`, `health_score.py`, `conflict_detector.py`, `exclusion_filter.py` | Gruppierung, Score, Konflikte, Ausschlüsse | 🟢 |
| `symptom_relevance.py` | E9 Symptom-Priorisierung | 🟢 |

### Empfehlungen / Next Cart (E5/E8)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `recommender.py` | E5-Recommender (liest `data/recommendations.json`) | 🟢 |
| `next_cart_engine.py` | E8 BR-S1 Next-Cart-Engine | 🟢 |
| `easy_swaps.py`, `recipe_suggester.py`, `explainer.py` | Swaps, Rezepte (`data/recipes.json`), Erklärungen | 🟢 |
| `preference_learning.py`, `shelf_life.py`, `progress_tracker.py` | Präferenzen, Haltbarkeit, Fortschritt | 🟢 |
| `nutri_coach.py` | Warmer Coach-Text (Gemini, gated via `COACH_LLM_ENABLED`) | 🟢 |

### Pantry & Adoption (E10/E12/E13)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `pantry.py` | Vorrats-Logik | 🟢 |
| `adoption.py` | Adoption via comparator + nutrition_delta | 🟢 |
| `ab_assignment.py` | Deterministisches A/B | 🟢 |

### Querschnitt / Infra
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `auth.py` | E1 Supabase-Auth-Token-Verifikation | 🟢 |
| `i18n.py` | Backend-Lokalisierung (DE/EN), 20+ Importeure | 🟢 |
| `error_handler.py` | Einheitliche Fehler | 🟢 |
| `account.py` | E12 GDPR Export/Erasure | 🟢 |

### Legacy-Density-System (Epic 4) — abgelöst durch E7, aber noch verdrahtet
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `backend/app/nutrition_model.py` | Density-Dimensionen + `DISCLAIMER` (10 Importeure) | 🟡 |
| `nutrition_profile.py` | Density-Profil; `grams_for` **auch vom neuen Stack** genutzt → nicht einfach löschbar | 🟢/🟡 |
| `gap_detector.py` | Density-Gaps → `/nutrition/snapshot` | 🟡 |
| `nutrition_snapshot.py` | Density-Snapshot-Glue → `/nutrition/snapshot` | 🟡 |
| `confidence.py` | Per-Produkt-Konfidenz-Label (in `receipts.py`) | 🟢/🟡 |
| `_off_cache.json` | Laufzeit-Cache (jetzt gitignored, untracked) | 🔵 |

## Backend — Analytics (`backend/app/analytics/`)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `events.py` | Event-Logging (10+ Importeure) | 🟢 |
| `comparator.py` | Rezept-Vergleich für Adoption | 🟢 |
| `nutrition_delta.py`, `absolute_nutrition_delta.py` | Nährwert-Deltas | 🟢 |
| `match_quality.py` | Matching-Qualitätsmetriken | 🟢 |
| `adoption_score.py` | **Verwaist** — nur von `scripts/test_adoption.py` importiert; `adoption.py` rechnet direkt | 🔴 |

## Backend — Models (`backend/app/models/`)
Pydantic-Verträge, alle von API/Services genutzt → 🟢: `profile, receipt, nutrition, snapshot, health_score, next_cart, feedback, analytics, conflict, absolute_gap`.

| Datei | Status |
|---|---|
| `models/pantry.py` (`PantryItem`) — **verwaist**, null Importeure (Pantry fließt als dicts) | 🔴 |

## Backend — DB (`backend/app/db/` + `backend/db/`)
| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `app/db/supabase.py` | Supabase-Client + alle Tabellen-Helper (tolerant) | 🟢 |
| `app/db/pantry_repo.py` | Pantry-/Consumption-Tabellen | 🟢 |
| `app/db/receipt_items_repo.py` | Batch-Insert Positionen | 🟢 |
| `db/schema.sql` | **From-scratch DB-Bootstrap** (12 Tabellen) | 📄 |
| `db/migrations/*.sql` | Historische Migrationen v4–v14 | 📄 |
| `db/introspect_queries.sql` | Schema-Regeneration | 📄 |
| `db/README.md` | DB-Setup + Sync-Checkliste | 📄 |

## Backend — Dev/Test (nicht im Deploy-Pfad)
| Pfad | Zweck | Status |
|---|---|---|
| `app/scripts/test_*.py` (18) | Manuelle Test-Harnesses pro Epic (`python -m …`) | 🔵 |
| `app/scripts/build_bls_off_dataset.py` | Baut Gold-Set | 🔵 |
| `app/fixtures/*` | Test-Daten; `mock_receipt.json` nur im `RECEIPT_PARSER_MOCK`-Modus zur Laufzeit | 🔵 |
| `app/data/recipes.json`, `recommendations.json` | **Laufzeit-Daten** (vom Recommender/Recipe-Suggester geladen) | 🟢 |

## Frontend (`frontend/src/`)
React 19 + Vite; State-getriebener Step-Flow (kein Router). Alle 🟢.

| Datei | Zweck & Verbindung | Status |
|---|---|---|
| `main.tsx`, `App.tsx` | Einstieg + Step-Steuerung (`StepId`) | 🟢 |
| `lib/api.ts` | Zentraler Backend-Client (alle Endpunkte, Bearer-Token) | 🟢 |
| `lib/supabase.ts` | Supabase-Client (Auth) | 🟢 |
| `lib/i18n.tsx`, `lib/utils.ts` | Lokalisierung, Helfer | 🟢 |
| `types/api.ts` | TS-Typen der API | 🟢 |
| `components/AppShell.tsx` | Layout/Navigation | 🟢 |
| `components/ConsentBanner, Footer, Logo, TargetsCard` | UI-Bausteine | 🟢 |
| `steps/AuthScreen.tsx` | Login/Signup + Alters-Gate | 🟢 |
| `steps/OnboardingUploadStep, ChatOnboardingStep` | Onboarding + Upload | 🟢 |
| `steps/ReviewStep.tsx` | Positions-Review + Korrektur/Non-Food | 🟢 |
| `steps/PantryStep, DiaryStep` | Vorrat, Tages-Log | 🟢 |
| `steps/ResultsStep.tsx` | Dashboard/Insights (E11) | 🟢 |
| `steps/AnalysisCard, NextCartCard, Level2Card, EatenFeedbackCard` | Ergebnis-Karten (E7/E8/E9/E10) | 🟢 |
| `steps/ProfileSummary, NotificationsStep` | Profil, Benachrichtigungen | 🟢 |
| `index.css`, `vite-env.d.ts` | Styles, Typen | 🟢 |

## ML / Evaluation (`ml/`) — reproduzierbarer Analyse-Workspace (kein Deploy)
| Datei | Zweck | Status |
|---|---|---|
| `ocr_eval.py` | OCR-Regressionstest über `data/receipts/` (importiert `local_extractor`) | 🔵 Tooling |
| `embedding_reranker.ipynb`, `goldset_eval/extend.ipynb`, `bls_eda/data_eda.ipynb`, `off_fallback.ipynb` | EDA/Matching-Evaluation | 🔵 |
| `matching_investigations.ipynb` | Matching-Analyse (Evidenz) | 🔵 |
| `bls_off_judgments.json`, `*_sample/off.json`, `labeling_worksheet.json` | Gold-Set + Labeling | 📄 Daten |
| `README.md`, `briefing_ml_data_chat.md`, `requirements-ml.txt` | ML-Doku + Deps | 📄 |

## Daten (`data/`)
| Pfad | Zweck | Status |
|---|---|---|
| `data/BLS_4_0_*.xlsx/pdf` | BLS-Nährwert-DB (von `bls_matcher` genutzt) | 🟢 Daten |
| `data/receipts/*` | Test-Kassenbons + `receipts_queries.json` (Gold-Set) | 🔵 Testdaten |

## Dokumentation (`docs/`)
| Pfad | Zweck | Status |
|---|---|---|
| `product/*` | PRD, User Stories/Flows, Business Rules, Epics, AC, Impl-Package (business_rules/reference_data/epics/AC vom Code als Spec/Orakel referenziert) | 📄 |
| `research/*` | UX-Research, Interview-Guide, Metrics-Plan | 📄 |
| `decisions/*` | Engineering-Entscheidungs-Log (E1…E13) | 📄 |
| `planning/wochenplan_final.md` | Wochenplan | 📄 |
| `design/onboardingflow_etc.md` | Onboarding-Flow-Entwurf | 📄 |
| `architektur_entscheidungen.md` | Architektur-Log (in 6 Code-Dateien referenziert) | 📄 |
| `data_retention_security.md` | GDPR/Security-Spec | 📄 |
| `demo_script.md`, `file_inventory.md` | Demo-Skript, dieses Dokument | 📄 |

## Nicht-aktiv (Archiv & Staging)
| Pfad | Zweck | Status |
|---|---|---|
| `Archiv/Lovable_prototypes/` | Lovable.dev-Prototypen (anderer Stack, nicht referenziert) | 🗄️ archiviert |
| `Archiv/pre_build_questions.md` | Abgeschlossenes Prozess-Artefakt | 🗄️ archiviert |
| `löschen/*` | Legacy-Skripte + obsolete Docs, Staging vor endgültigem Löschen | 🗑️ zu löschen |
