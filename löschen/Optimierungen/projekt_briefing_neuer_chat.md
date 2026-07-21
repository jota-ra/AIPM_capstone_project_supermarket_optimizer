# NutriWise — Briefing für einen neuen Chat

*Zweck: Dieses Dokument gibt einer frischen LLM-Session (z. B. neuer Claude-Code-Chat) den vollen
Kontext, um an NutriWise weiterzubauen — Produkt, ML, Präsentation und UI. Stand: 2026-07-16, Branch
`presentation`, nach Commit `4bd1404` (Tesseract-OCR, Epics 10–14).*

## So nutzt du dieses Briefing
1. **Abschnitt 1** (Kontext-Prompt) an den Anfang des neuen Chats kopieren.
2. Die Dateien aus **Abschnitt 4** anhängen (`@datei` in Claude Code) — Muss-Dateien immer, Rest je nach Aufgabe.
3. Aus **Abschnitt 5** den passenden Aufgaben-Prompt wählen.
4. **Abschnitt 2 & 6** (Fakten + Do/Don't) sorgen dafür, dass die LLM nichts falsch herleitet.

---

## 1. Kontext-Prompt (zum Einfügen)

> Du hilfst beim AI-PM-Capstone **NutriWise** — einem **vorratszentrierten Ernährungsassistenten**.
> Der User lädt Kassenbons hoch; **On-Device-OCR (Tesseract)** baut daraus ein **Haushalts-Inventar
> (Pantry)**. Der User **hakt Verzehr ab** (Tages-Log) statt manuell zu loggen; daraus schätzt die App
> **Wochen-Nährwerte** und gibt **zwei Empfehlungen**: „nutze, was du hast" (inventar-/ablauf-bewusst)
> und „Next Cart" (Kauf). Neue User durchlaufen einen **Onboarding-Chat**, der den Bedarf ermittelt
> (BMR→TDEE→Makros). Es ist ein **regelbasiertes / LLM-Hybrid-Produkt, kein trainiertes ML-Modell**:
> die einzige LLM (Gemini) ist der „Nutri-Coach", der nur Zahlen **formuliert**, nie erfindet.
> Tech-Stack: **FastAPI** (Backend), **React + Vite** (Frontend), **Supabase** (DB/Auth),
> **OpenFoodFacts + BLS 4.0** als Nährwert-Quellen, gestufter Resolver für das Matching.
> Team: **Jennifer Rake (Sprecherin 2)** und **Stuart Kasemeier (Sprecher 1)**.
> Wichtige Haltung: **Ehrlichkeit als Feature** — alles ist „Schätzung aus Einkauf + Tages-Log, keine
> medizinische Beratung"; Nährwerte als **Trends/Bereiche**, nicht als exakte kcal. Lies zuerst die
> angehängten Dateien, bevor du Annahmen triffst. Halte die Zahlen und Entscheidungen aus dem Briefing ein.

---

## 2. Schlüssel-Fakten & Entscheidungen (nicht neu herleiten)

- **Zielgruppe:** gesundheitsbewusste Erwachsene 25–45, DACH/Deutschland (DGE-Werte).
- **Kernhypothese:** Vertrauen Nutzer einer aus dem Bon abgeleiteten Empfehlung genug, um zu handeln?
  **Make-or-Break-Frühindikator:** klebt die **Abhak-Gewohnheit** über Woche 1? (Metrics-Doc Assumption #2)
- **Evaluation / Baseline (aus `bls_off_judgments.json`):** 76 einzigartige Items / 227 Vorkommen, 3-LLM-
  Judge-Panel. **OpenFoodFacts-Match: 54 % korrekt, 66 % nutzbar** (korrekt+teilweise), 24 % kein Treffer.
  **BLS-Tabelle allein: 32 % korrekt, 36 % falsch.** **Judge-Konsens 96 % einstimmig.** Ziel-Marke: **≥70 %
  nutzbar.** Die 54 %/32 % sind ein **Head-to-Head zweier unabhängiger Strategien, NICHT additiv.**
- **Matching-Architektur (gestufter Resolver):** Tier 0 gelernte verifizierte Matches → Tier 1 OFF-Fuzzy
  + OFF→BLS-Bridge (nur unter Typ-Übereinstimmungs-Guard) → Tier 1b BLS-Rohware → Tier 3 Kategorie-Fallback.
  Grund für den Guard: eine lose Bridge bringt BLS' ~⅓-Falschlebensmittel-Problem zurück.
- **ML-Leitprinzip:** ML **nur dort, wo Regeln nicht generalisieren** (Matching, Portionen, Verbrauch);
  Lücken-Erkennung, Zielwerte (BMR-Kette) und Empfehlungs-Begründung bleiben **regelbasiert & transparent.**
- **ML-Bausteine (empfohlen):** (1) *jetzt/Pflicht* semantischer Embedding-Re-Ranker (multilingual, z. B.
  `paraphrase-multilingual-MiniLM`) → Baseline vs. Advanced; (2) Verbrauchs-/Verfalls-Vorhersage;
  (3) Portionsschätzung. (2)+(3) starten als Prior, personalisiert mit der Zeit.
- **Corporate Design (aus `frontend/src/index.css`):** Akzent Salbeigrün `#7c9a6a`, soft `#eef2ea`,
  Ink `#1d1d21`, Ink-soft `#6e6f74`, Canvas `#fafafa`, **sans-serif** (System-Stack). Semantik getrennt vom
  Akzent: niedrig = Clay `#b36a4a`, über Ziel = Amber. Ein Akzent, viel Weißraum.
- **OCR:** Tesseract on-device (privat, keine API-Quota, offline) — **ersetzt Gemini für Bons**. Gemini
  nur noch im Nutri-Coach (nur Formulierung).
- **Zwei noch unbestätigte Design-Entscheidungen (vor Präsentation gegenchecken):** Zwei-Karten-Empfehlung
  (statt Umschalter); ±10 %-Toleranzband bei Kalorien/Ablaufschätzung. (Quelle: `architektur_entscheidungen.md`.)

---

## 3. Aktueller Stand / bereits gebaut (nicht neu bauen)

**Im Code (verifiziert):** Onboarding-Chat, Bon-Upload + On-Device-OCR, Pantry (Bestand mit Menge/Ablauf),
Tages-Log (`ConsumptionEvent` = Ist-Signal), `intake_estimator` (Wochenfenster), `find_pantry_match`
(inventar-/ablauf-bewusste Empfehlung), Next-Cart, Rezepte, Easy Swaps, Progress-Tracking, Nutri-Coach,
transparente Leerzustände, Engagement-Banner (ab 3 Tagen), DSGVO-Export/Löschung, i18n DE/EN,
Non-Food-Filter, Waste-Tracking, A/B-Test (Eaten-Feedback).

**Als Deliverables dieser Session (in `midterm_presentation/` und `Optimierungen/`):**
- `NutriWise_Midterm_Presentation.pptx` (v0, EN) · `..._v1.pptx` (v1, EN) · `..._v1_DE.pptx` (v1, DE)
- `Optimierungen/projektbewertung_ml_und_optimierungen.md` (Bewertung + ML-Plan + Optimierungen)
- `Optimierungen/NutriWise_UI_Dummy.html` (klickbarer UI-Prototyp)
- Präsentations-Build-Skripte liegen im Session-Scratchpad (Python + python-pptx + matplotlib).

**Offene Kern-Aufgaben:** (a) ML-Baustein 1 (Embedding-Re-Ranker) bauen + Baseline-vs-Advanced messen;
(b) 1-Tap-Portion (Consume-Endpoint verlangt heute eine Mengeneingabe → Reibung); (c) Check-off-Retention
per 5-User-Test validieren; (d) EDA-Notebook + Data-Writeup formalisieren.

---

## 4. Benötigte Dokumente (anhängen)

| Datei | Wofür | Priorität |
|---|---|---|
| `Optimierungen/projektbewertung_ml_und_optimierungen.md` | Konsolidierte Bewertung, ML-Empfehlungen, Optimierungen, 1-Wochen-Plan | **Muss** |
| `bls_off_judgments.json` | Evaluations-Datensatz — Baseline-Zahlen, Grundlage für Baseline-vs-Advanced & EDA | **Muss** (für ML/EDA) |
| `docs/architektur_entscheidungen.md` | Was gebaut/gestrichen wurde, offene Entscheidungen, Deviationen | **Muss** |
| `roadmap_consolidated.md` | MVP-Scope, Kernhypothese, Positionierung, Prioritäten | **Muss** |
| `nutriwise_metrics_and_data_collection_plan.md` | 10 KPIs, 5 Annahmen, Go/No-Go-Schwellen | **Muss** (für KPIs/Validierung) |
| `frontend/src/index.css` | Corporate-Design-Tokens (Salbeigrün, Font) | Muss (für UI/Deck-Design) |
| `Optimierungen/NutriWise_UI_Dummy.html` | Referenz-UI / User-Journey | Muss (für UI-Arbeit) |
| `backlog_structured.md` | Epic-Struktur (E11–E14 etc.) | Optional |
| `docs/demo_script.md` | Demo-Ablauf (Kern-Loop) | Optional (für Demo/Deck) |
| `Optimierungen/pre_build_questions.md` | Aufgelöste Divergenzen, Referenzdaten-Entscheidungen | Optional |
| `README.md` | Setup Backend/Frontend | Optional (für Code-Arbeit) |
| `backend/app/services/{resolver,recommender,intake_estimator,verified_matches,local_extractor,nutri_coach}.py` | Matching-/Empfehlungs-/OCR-Logik | Optional (für Code/ML) |
| `frontend/src/steps/*` + `frontend/src/lib/api.ts` | Screens + API-Oberfläche | Optional (für UI/Integration) |
| Präsentations-Build-Skript (`build_deck.py` / `build_deck_de.py`) | Zum Weiterbearbeiten der Decks | Optional (nur für Deck-Änderungen) |

> **Hinweis Claude Code:** In diesem Projekt gibt es ein persistentes Memory (`MEMORY.md` + `memory/*.md`),
> das viele dieser Fakten automatisch in jede Session lädt (u. a. `product-pivot-pantry-consumption`,
> `e4-resolver-and-bridge`, `deck-doc-revision-approval-flow`). In einem **anderen Tool** (ChatGPT o. Ä.)
> musst du die Dateien oben manuell anhängen.

---

## 5. Aufgaben-Prompts (je nach Ziel)

**A · ML-Baseline vs. Advanced bauen (höchster Hebel):**
> „Baue ein reproduzierbares Notebook: lade `bls_off_judgments.json`, definiere die Metrik (Top-1-Accuracy,
> usable@1, No-Match-F1), quantifiziere den Fuzzy-Matcher als **Baseline**, dann einen multilingualen
> **Embedding-Re-Ranker** als **Advanced**-Modell, vergleiche beide auf demselben Test-Set. Erzeuge
> `requirements-ml.txt`. Halte die Zahlen aus dem Briefing ein."

**B · Präsentation ändern (Freigabe-Flow beachten!):**
> „Überarbeite die Präsentation `midterm_presentation/NutriWise_Midterm_Presentation_v1.pptx`. **Nenne mir
> erst die geplanten Änderungen als nummerierte Liste zur Freigabe, bearbeite dann.** Neue Version als
> `..._v2.pptx`." *(Der User will bei Deck/Doc-Revisionen immer erst eine Änderungsliste zur Freigabe.)*

**C · UI/Feature bauen:**
> „Setze die 1-Tap-Portion um: der Consume-Endpoint soll standardmäßig **1 typische Portion** annehmen
> (Menge optional), damit Abhaken ein Tap ist. Orientiere dich an `Optimierungen/NutriWise_UI_Dummy.html`
> und den Design-Tokens in `frontend/src/index.css`."

**D · Validierung / KPIs:**
> „Instrumentiere die Check-off-Retention aus den `consumed_at`-Events und werte den vorhandenen A/B-Test
> (`ab_assignment.py`) aus — gegen die Schwellen in `nutriwise_metrics_and_data_collection_plan.md`."

---

## 6. Do / Don't (Guardrails)

**Do:**
- Ehrliches Framing: „Schätzung aus Einkauf + Tages-Log", Trends statt exakter kcal, „keine med. Beratung".
- Regeln behalten für Lücken, Zielwerte, Empfehlungs-Begründung (Transparenz = Produktwert).
- Bei Deck/Doc-Revisionen **erst Änderungsliste zur Freigabe**, dann in **neue versionierte Datei** schreiben.
- Salbeigrün als **einzigen** Akzent, sans-serif, viel Weißraum.

**Don't:**
- Kein trainiertes ML-Modell vortäuschen; die App ist regelbasiert/LLM-Hybrid (LLM nur Formulierung).
- OFF 54 %/BLS 32 % nicht als kumulative Verbesserung darstellen — es ist ein Head-to-Head.
- Kein Empfehlungs-Ranking per Bandit/ML (datenhungrig, opfert Transparenz) — Regeln behalten.
- Gemini nicht mehr als OCR beschreiben (ist Tesseract on-device).
- Portionen/exakte Kalorien nicht als präzise verkaufen, solange keine Mengenerfassung existiert.

---

*Quell-Deliverables dieser Session: `Optimierungen/projektbewertung_ml_und_optimierungen.md`,
`Optimierungen/NutriWise_UI_Dummy.html`, `midterm_presentation/NutriWise_Midterm_Presentation*.pptx`.*
