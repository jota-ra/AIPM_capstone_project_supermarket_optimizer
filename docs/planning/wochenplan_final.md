# NutriWise — Finale Woche: Bewertung & Plan

*Stand: 2026-07-17 · Branch `llm`, nach Commit `9e1698f` (OCR-Orientierungs-Fix).*
*Fortschreibung von `Optimierungen/projektbewertung_ml_und_optimierungen.md` (16.07.) — das ML-Kapitel dort ist inzwischen umgesetzt; dieses Doc erfasst den realen Stand und den 1-Wochen-Plan bis zum Final.*

---

## 1. Executive Summary

Der ML-Kernbaustein, den das 16.07.-Doc noch als **wichtigste Capstone-Lücke** führte (quantifizierter
Baseline-vs-Advanced-Vergleich), ist **gebaut** — inklusive erweitertem Gold-Set (180 echte Bon-Zeilen),
EDA-Notebooks, OFF-Fallback-Tier und ehrlicher Metrik. Die OCR-Evaluation hat zusätzlich einen **echten
Produktions-Bug** aufgedeckt (seitliche Foto-Bons ohne EXIF-Tag → OCR-Müll), der jetzt **gefixt und
verifiziert** ist: Mean-Recall **61,8 % → 93,4 %**.

Die finale Woche gehört damit **nicht dem ML-Bauen**, sondern:
1. **Realisieren des letzten echten Produktwerts** — OCR-Fix (✅ erledigt) und 1-Tap-Portion (offen).
2. **Zwei sauberen Curriculum-Nachweisen** — A/B-Auswertung und trainierter LogReg-Re-Ranker mit
   Feature-Importance.
3. **Validierung der einzigen ungetesteten Kern-Annahme** — Check-off-Retention per 3–5-Nutzertest.

**Leitplanke:** Ehrlichkeit als Feature. Embeddings/LogReg sind **Tie-Breaker, kein Haupt-Matcher**; der
OCR-Fix ist ein **behebbarer Vorverarbeitungs-Bug**, kein OCR-Wunder. Das ist die stärkere PM-Story
(Evaluation deckt Bug auf → Fix → Verifikation = gelebter ML-Lifecycle).

---

## 2. Realer Stand vs. 16.07.-Doc

| Baustein | 16.07.-Doc | Realer Stand (17.07.) |
|---|---|---|
| ML Baseline vs. Advanced | ❌ Lücke | ✅ **Gebaut** — `ml/embedding_reranker.ipynb`, ExpTop-1/R@5, faire Metrik |
| EDA mit Plots | 🟡 keine Plots | ✅ **Gebaut** — `ml/data_eda.ipynb`, `ml/bls_eda.ipynb`, on-brand |
| Gold-Set / Evaluation | 45 kuratiert | ✅ **180 echte Bon-Zeilen**, Label-Fehlerrate 3 % (Jennifer spot-checked) |
| OFF-Fallback-Tier | Empfehlung | ✅ **Gebaut** (`ml/off_fallback.ipynb`), USDA geprüft & verworfen |
| **OCR-Recall** | nicht auf dem Radar | ✅ **Bug gefunden + gefixt + verifiziert:** 61,8 % → 93,4 % (Commit `9e1698f`) |
| 1-Tap-Portion | ❌ offen | ❌ **offen** — Consume-Endpoint verlangt noch `quantity > 0` (`backend/app/api/pantry.py:24`) |
| A/B-Test auswerten | gebaut, nicht ausgewertet | ❌ **offen** — Harness `ab_assignment.py` vorhanden |
| Check-off-Retention validieren | ❌ offen | ❌ **offen** — Nutzertest diese Woche geplant |

### Ehrliche ML-Zahlen (zum Zitieren)

- **Kuratiertes Set (45, 3-Judge):** Hybrid ExpTop-1 **33 %**, R@5 **56 %**; Fuzzy WRatio 26 %.
- **Erweitertes Set (174 nutzbar, echte Bons):** Hybrid (cleaned) ExpTop-1 **25 %** / R@5 **47 %**;
  raw 18 % / 32 %. Auf **rohen** Queries schlägt Fuzzy token_set_ratio den Hybrid (22 % vs. 18 %)
  → **Embedding schadet auf verrauschten Strings, bestätigt: Tie-Breaker, kein Haupt-Matcher.**
- **Cleanup-Effekt** (raw → bereinigt) ist groß: +7 pp ExpTop-1, +15 pp R@5.
- **OCR-Recall:** 61,8 % → 93,4 % (Commit `9e1698f`, verifiziert an 19 echten Bons via `ml/ocr_eval.py`).

---

## 3. Curriculum-Abgleich (`Optimierungen/aipm_vl.md`)

| Thema | Status | 1-Wochen-Chance |
|---|---|---|
| Python, Pandas/Numpy, SQL, Data Viz | ✅ solide | — |
| EDA, Evaluation Metrics | ✅ stark | im Deck herausstellen |
| Hands-on ML, ML Lifecycle, Data Products | ✅ stark | Lifecycle-Doc formalisieren (billig) |
| NLP, Applied LLMs, Prompt Engineering | ✅ (Nutri-Coach, LLM-Judge) | — |
| Software/AI Architecture | ✅ (gestufter Resolver, FastAPI) | Architektur-Diagramm |
| GDPR / AI Act | 🟡 GDPR gebaut, AI Act offen | **1 Slide** Risiko-Einstufung (billig) |
| **Logistic Regression, Feature Engineering** | ❌ | **LogReg-Re-Ranker** auf 174 Labels, Feature-Importance |
| Decision Tree / KNN / Ensemble | ❌ | als Vergleichsmodelle im selben Notebook (Beifang) |
| **A/B Testing** | 🟡 Harness gebaut, nie ausgewertet | **auswerten** — kleinster Aufwand, direkter Treffer |
| Streamlit | ❌ (React) | **Mini-Demo-App** für Matcher/EDA — live demofähig |
| DVC | ❌ | `ml/`-Daten versionieren (billig, niedriger Produktwert) |
| RAG, AI Agents, MCP, Local LLM | ❌ | diese Woche **nicht** anfassen (Substanzverlust für Checkboxen) |

**Neue Curriculum-Themen mit gutem Aufwand/Nutzen:** LogReg + Feature Engineering (+ DT/KNN als Beifang),
A/B-Auswertung, Streamlit. DVC + AI-Act-Slide sind Cent-Artikel. RAG/Agents/MCP/Local-LLM bewusst außen vor.

---

## 4. Priorisierter 1-Wochen-Plan (2 Personen)

| Tag | Person A (Produkt/Code) | Person B (ML/Analyse) |
|---|---|---|
| **1** | ✅ OCR-Fix committet + verifiziert (`9e1698f`); Before/After-Belegbilder fürs Deck exportieren | **A/B-Test auswerten** (`ab_assignment.py` + `consumed_at`) gegen Go/No-Go-Schwellen im Metrics-Plan; **3–5 Tester rekrutieren** + Kurz-Skript |
| **2** | **1-Tap-Portion**: `quantity` optional, Default = 1 Portion (`units.py`/`nutrition_personalization.py`); Abhaken = 1 Klick | **LogReg-Re-Ranker** im bestehenden Harness: Features aus Fuzzy-Scores + Embedding-Sim + Query-Länge/Token-Overlap; train/test-Split auf 174 Labels |
| **3** | **Mini-Nutzertest** (3–5 Personen, Check-off-Retention beobachten) + Reibungs-Feedback | LogReg vs. Fuzzy vs. Hybrid (+ DT/KNN als Beifang); **Feature-Importance**; Caveats (174 Labels, weite CIs) |
| **4** | Test-Auswertung + kleine Fixes; **Streamlit-Demo** (Query → Kandidaten+Scores; EDA-Plots) | **ML-Lifecycle-/Data-Challenges-Doc**; optional **DVC**; **AI-Act-Risiko-Slide** |
| **5** | Demo-Durchlauf + Puffer | **Deck mit echten Zahlen** (Baseline-vs-Advanced, OCR-Before/After, A/B, Nutzertest-Zitate) |

**Muss:** OCR-Fix (✅) · 1-Tap-Portion · A/B ausgewertet · LogReg-Re-Ranker mit Feature-Importance · Deck mit echten Zahlen.
**Should:** Streamlit-Demo · Nutzertest-Auswertung · AI-Act-Slide.
**Stretch:** DVC · DT/KNN-Beifang · Verbrauchs-/Portions-ML als „Future"-Kapitel.

---

## 5. Fokus-Wege (falls Priorisierung nachjustiert wird)

- **Weg A — Produkt zuerst, dann Showcases** *(empfohlen):* OCR-Commit (✅) + 1-Tap zuerst, dann A/B +
  LogReg. Höchster kombinierter ROI, geringes Risiko.
- **Weg B — Curriculum maximieren:** LogReg+DT+KNN, Feature Eng., A/B, Streamlit, DVC, AI-Act. Viele
  Häkchen, aber Produkt-Reibung bleibt liegen — nur mit mind. dem OCR-Commit vertretbar (erledigt).
- **Weg C — Demo-Wow:** Streamlit-Live-Demo + OCR-Before/After + Deck. Stärkste Bühnenwirkung; lebt vom
  OCR-Fix (erledigt).

---

## 6. Ehrlichkeits-Guardrails (nicht verletzen)

- Embedding/LogReg **nicht** als „ML löst Matching" verkaufen. Story: Auto-Pick → Hybrid (33 %, +27 %
  relativ), Auswahlliste → Fuzzy (R@5 56 %); Embedding ist Tie-Breaker. Bei LogReg: 174 Labels → weite CIs,
  Features/α **nicht** auf dem Test-Set tunen.
- OCR ehrlich als „behebbarer Vorverarbeitungs-Bug" framen, nicht als OCR-Wunder.
- Portionen/kcal bleiben **Trend/Bereich**, nicht scheinpräzise. 1-Tap macht „leichter als Loggen" wahr,
  ändert aber nichts an der Trend-statt-exakt-Haltung.
- Bei Deck/Doc-Revisionen: erst Änderungsliste zur Freigabe, dann in neue versionierte Datei.

---

*Verweise: `Optimierungen/projektbewertung_ml_und_optimierungen.md`, `ml/README.md`, `ml/ocr_eval.py`,
`ml/embedding_reranker.ipynb`, `backend/app/services/local_extractor.py`, `backend/app/api/pantry.py`,
`nutriwise_metrics_and_data_collection_plan.md`.*
