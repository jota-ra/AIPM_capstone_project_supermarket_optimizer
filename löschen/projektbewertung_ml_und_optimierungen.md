# NutriWise — Projektbewertung, ML-Empfehlungen & Funktions-Optimierungen

*Stand: 2026-07-16 · Branch `presentation`, nach Commit `4bd1404` (Tesseract-OCR, Onboarding-Flow, Epics 10–14).*
*Grundlage: Code-Analyse des aktuellen Branches + die vorangegangenen Bewertungen dieser Session.*

---

## 1. Executive Summary

NutriWise hat sich vom ursprünglichen „ein Bon → ein Kauftipp, kein Logging"-MVP zu einem
**vorratszentrierten Ernährungsassistenten** entwickelt: Kassenbon-Upload baut ein Haushalts-Inventar,
der User hakt Verzehr ab (Tages-Log), und bekommt wochenbasiertes Nährwert-Feedback plus zwei
Empfehlungstypen — *„nutze, was du hast"* (inventar-/ablauf-bewusst) und *„Next Cart"* (Kauf).

**Kernbefund:** Der Produkt-Pivot ist **im Code bereits weitgehend umgesetzt** (Pantry, ConsumptionEvents,
zeitfensterbasierte Intake-Schätzung, inventar-bewusste Empfehlung, Chat-Onboarding, On-Device-OCR,
Rezepte, Progress-Tracking, GDPR, DE/EN). Was fehlt, ist **weniger Bauen als Ausrichten**: Narrativ,
Reibungsabbau beim Abhaken, ehrliches Genauigkeits-Framing, und die noch ungetestete Kern-Annahme.

**Für das Capstone** fehlt genau ein Baustein wirklich: ein **trainierbarer/quantifizierter Modellvergleich
(Baseline vs. Advanced)**. Den liefert das semantische Matching — dieselbe Arbeit verbessert zugleich das
belegte 54 %/66 %-Matching-Problem, das durch die Wochen-Makros jetzt *geschäftskritisch* geworden ist.

**Gesamteinschätzung:** Produktreife hoch, technische Substanz vorhanden, Story hinkt dem Code hinterher.
Mit dem ML-Baustein 1 und vier gezielten Optimierungen ist das Projekt sowohl produkt- als auch
capstone-seitig sehr gut aufgestellt.

---

## 2. Projektbewertung

### 2.1 Stärken

- **Echter Retention-Loop vorhanden.** Der Vorrat als Startbildschirm (nach dem Baseline-Upload-Gate von
  50 Artikeln) gibt einen täglichen Grund, die App zu öffnen — das schwächste KPI des Originalkonzepts
  (W1→W4-Retention) ist adressiert. Zusätzlich: In-App-Erinnerungs-Banner ab 3 Tagen Inaktivität (Epic 13).
- **Differenzierende Kern-Empfehlung.** `find_pantry_match` (recommender.py) implementiert die „Buttermilch-
  Logik": geht Lücken worst-first durch, findet passendes Item im Vorrat, rankt nach Ablauf/Frische
  (`shelf_life.py`), respektiert Ausschlüsse. Reduziert Verschwendung, kostet keinen Neukauf, ist
  regelbasiert-transparent und live demofähig. Das kann keine Kalorien-App.
- **On-Device-OCR (Tesseract) statt Gemini** (`local_extractor.py`): privat (keine Bondaten an Dritte),
  keine API-Quota/429er, offline-fähig. Starkes Vertrauens- und Kostenargument.
- **Konsequente „no invented facts"-Disziplin.** Rezepte (kuratiert), Easy Swaps und Nutri-Coach sind so
  gebaut, dass der LLM nur *formuliert*, nie Nährwerte erfindet (`recipe_suggester.py`, `nutri_coach.py`).
- **Ehrlichkeit als Feature schon eingebaut:** transparente Leerzustände (`has_sufficient_data`, Epic 11),
  „nicht medizinische Beratung"-Disclaimer, GDPR-Export + -Löschung (`account.py`), Match-Transparenz bei
  Freitext (Epic 12).
- **Solide Datengrundlage für Evaluation.** `bls_off_judgments.json`: 76 gelabelte Items, 3-Judge-Panel,
  96 % Inter-Judge-Übereinstimmung → belastbare Metrik.

### 2.2 Spannungen & Risiken (nach Wichtigkeit)

| # | Risiko | Warum es zählt | Status |
|---|---|---|---|
| 1 | **Narrativ ≠ Code.** Deck/Positioning suggeriert teils noch „kein Logging / geschätzt aus Einkauf". Der Code macht aktives Konsum-Tracking (ConsumptionEvent = echtes Ist-Signal). | Ihr präsentiert sonst ein anderes Produkt als das gebaute; verschenkt die stärkere Story. | **offen** — Framing-Aufgabe |
| 2 | **Portionen ungelöst.** Der Consume-Endpoint verlangt `quantity > 0` (`api/pantry.py`) → User muss eine Menge eingeben. | Genau die Reibung, an der Logging-Apps sterben; ohne Portion bleiben Makros grob. Scheinpräzise kcal zerstören Vertrauen. | **offen** |
| 3 | **Match-Genauigkeit ist load-bearing geworden.** Seit ihr Pro-Woche-Makros behauptet, hängt die Glaubwürdigkeit am Bon→Lebensmittel-Matching (Baseline 54 % korrekt / 66 % nutzbar). | Weiche Nudges verzeihen Fehler, konkrete Makro-Zahlen nicht. | **offen** — ML-Baustein 1 |
| 4 | **Haushalts-Zuordnung.** Bon = Haushalt, Pantry = pro `user_id`. Mehrpersonen-Haushalte brechen die Pro-User-Makros. | Falsche Genauigkeitsbehauptung bei geteiltem Einkauf. | teilweise (Single-User implizit) |
| 5 | **Inventar-Drift.** „Noch da / seit X nicht verzehrt" stimmt nur bei diszipliniertem Abhaken + vollständigem Bon (Grundnahrung, lose Ware, Nicht-Bon-Käufe lecken). | Die Empfehlung wird falsch, wenn das Inventar driftet. | teilweise (Ablaufschätzung mildert) |
| 6 | **Kern-Annahme ungetestet.** *Überlebt das Abhaken die Neuheit?* (Metrics-Doc Assumption #2). Daten (`consumed_at`) existieren, Auswertung nicht. | Klebt der Loop nicht, ist das ganze Inventar-/Empfehlungsmodell wertlos. | **offen** — Validierung |

### 2.3 Reifegrad je Capstone-Anforderung

*(Die Topics aus `midterm_presentation/requirements.md` sind zugleich die Struktur des Finals.)*

| Anforderung | Reife | Kommentar |
|---|---|---|
| Business-Ziel / Zielgruppe / Motivation | ✅ stark | klar, mehrfach dokumentiert |
| Success-Kriterien / KPIs | ✅ stark | 10-KPI-Framework vorhanden; noch nicht instrumentiert |
| Datenquellen & Challenges | 🟡 mittel | 3 Quellen real, im Code verstreut → als Doc konsolidieren |
| EDA mit Plots | 🟡 mittel | im Repo keine Plots; fürs Deck aus den Daten erzeugt → als Notebook formalisieren |
| Evaluation-Metrik | 🟡 mittel | LLM-Judge vorhanden; für Capstone gegen Gold-Labels definieren |
| ML-Workflow / Pipeline | ✅ stark (regelbasiert) | echte mehrstufige Pipeline; bewusst kein trainiertes Modell |
| **Baseline-Modell & Performance** | ❌ **Lücke** | kein quantifizierter Modellvergleich → **wichtigste Capstone-Lücke** |
| Advanced-Modell (optional) | ❌ Lücke | existiert nicht → ML-Baustein 1 füllt beide |

---

## 3. ML-Empfehlungen

### Leitprinzip

> **ML dorthin, wo Regeln beweisbar versagen** (offene/unbekannte Eingaben, personalisierte Mengen,
> Vorhersagen). **Regeln behalten, wo Transparenz ein Feature ist** — Lückenerkennung, Zielwerte
> (BMR→TDEE→Makro), Empfehlungs-Begründung. Nicht ML-ifizieren, nur weil man kann.

### 3.1 Baustein 1 — Semantisches Matching *(jetzt · Pflicht · Capstone-Anker)*

- **Problem:** Fuzzy-Token-Matcher trifft ~54 % korrekt, scheitert am Long-Tail (50 % der Artikel
  erscheinen nur einmal). Regeln generalisieren nicht auf kryptische, einmalige Bon-Texte.
- **Lösung:** Multilingualer Sentence-Embedding-Re-Ranker (z. B. `paraphrase-multilingual-MiniLM`);
  Kandidaten des Fuzzy-Matchers per Cosine-Ähnlichkeit neu ranken. „AB Bud" → „Pilsner Bier",
  „Broccoli" → „Brokkoli", Marke→generisch.
- **Warum ideal:** **kein Training nötig** (pretrained, zero-shot) → unabhängig von fehlenden Nutzerdaten.
  **Baseline (Fuzzy) vs. Advanced (Embeddings)** auf demselben Test-Set = exaktes Capstone-Deliverable.
- **Daten:** `bls_off_judgments.json` als Testmenge; OFF/BLS-Namen als Kandidaten.
- **Metrik:** Top-1-Accuracy, usable@1 (korrekt+teilweise), No-Match-F1. LLM-Judge als sekundäre Validierung.
- **Aufwand:** ~2–3 Tage. **Produktwirkung: hoch** (alles Nachgelagerte hängt an der Match-Qualität).

### 3.2 Baustein 2 — Verbrauchs-/Verfalls-Vorhersage *(Differenzierer · löst Retention-Risiko)*

- **Problem:** Inventar-Drift (Risiko #5) + Abhaken-Bürde (Risiko #6).
- **Lösung:** Duration-/Survival-Modell pro Item-Kategorie, personalisiert: *„Milch vor 6 Tagen gekauft,
  du verbrauchst sie typisch in 5 → vermutlich leer"* → korrigiert Inventar **ohne** Abhak-Zwang.
- **Daten:** `consumed_at`-Events + `last_replenished_at`; `shelf_life.py` zu „Verbrauchsdauer" erweitern.
- **Ehrlich:** früh wenig Daten → **Start als Kategorie-Prior, bayesianisch personalisiert.** Nicht als
  fertig trainiertes Modell verkaufen — „designed-in ML, das mit Nutzung besser wird".
- **Produktwirkung: hoch** (reduziert genau die Reibung, die den Kern-Loop bedroht).

### 3.3 Baustein 3 — Portions-/Mengenschätzung *(macht Feedback ehrlich präzise)*

- **Problem:** Makro-Genauigkeit ohne Portionen (Risiko #2).
- **Lösung:** personalisierte Portionsschätzung pro Item/Kategorie aus `quantity_consumed`-Historie;
  Cold-Start via Populations-Serving-Priors (`units.py`, `nutrition_personalization.py`).
- **Verknüpfung:** ML-Version des „1-Tap-Portion"-Fixes (siehe 4.2); teilt Event-Historie & Cold-Start-
  Muster mit Baustein 2.
- **Produktwirkung: mittel–hoch** (behebt die schwächste Stelle des Feedbacks).

### 3.4 Wo bewusst KEIN ML

- **Empfehlungs-Ranking per Bandit/Learning-to-Rank:** datenhungrig und opfert die transparente
  Begründung („weil Ballaststoff-Lücke + läuft ab") — ein Produktwert. Regeln behalten, ML später.
- **Gap-Detection / Zielwerte / BMR-Kette:** deterministisch lassen; ML würde nur Vertrauen kosten.

### 3.5 Priorisierung

1. **Baustein 1** — jetzt bauen, ist Pflicht-ML fürs Capstone *und* die größte Produktverbesserung.
2. **Baustein 2 & 3** — als „Advanced/Future ML"-Kapitel: Architektur + Prior-basierter Prototyp, ehrlich
   als „lernt mit Nutzung". Zeigt Produktreife ohne Daten vorzutäuschen.
3. **Roter Faden:** *„ML gezielt dort, wo Regeln nicht generalisieren — Matching heute, personalisierte
   Mengen/Verbrauch als Lern-Loop — Lücken/Empfehlungen bewusst regelbasiert & transparent."*

---

## 4. Funktions-Optimierungen

*Nach Priorität; markiert, was Änderung vs. bereits-gebaut ist.*

### 4.1 Narrativ an den Code angleichen *(höchste Priorität, kein Code)*
Positioning konsequent auf den Pivot umstellen: *„dein Vorrat, der für dich arbeitet"* statt „kein Tracker".
Disclaimer von „geschätzt aus deinem Einkauf" auf „Schätzungen aus Einkauf + Tages-Log". Betrifft Deck,
Pitch, App-Copy. → Im aktualisierten Deck bereits angepasst.

### 4.2 Check-off-Reibung entfernen — 1-Tap-Portion *(kleinste Änderung, größter KPI-Effekt)*
Consume-Endpoint verlangt heute eine Menge (`api/pantry.py`). → **1 Tap = 1 typische Portion** als Default
(Serving-Priors aus `units.py`/`nutrition_personalization.py`), Menge nur optional. Macht das Versprechen
„leichter als Loggen" erst wahr — und entscheidet, ob der Loop klebt.

### 4.3 Trend-/Bereichs-Feedback statt Scheinpräzision
Weil Portionen grob bleiben: Wochen-Lücken **direktional** ausgeben („diese Woche tendenziell zu wenig
Protein"), keine exakten kcal. (Teilweise vorhanden über `has_sufficient_data` + Toleranzband ±10 %.)

### 4.4 Match-Genauigkeit heben
Direkt an ML-Baustein 1 gekoppelt; zusätzlich den learned Tier-0-Store (`verified_matches.py`) aktiv
befüllen und Normalisierung des deutschen Bon-Texts verbessern.

### 4.5 Kern-Annahme validieren *(bevor Genauigkeit poliert wird)*
5-User-Test + **Check-off-Retention** aus den `consumed_at`-Events auswerten. Der A/B-Test
(`ab_assignment.py`: Variante A „beim nächsten Upload fragen" vs. B „täglich im Dashboard") ist bereits
gebaut — nur noch auswerten.

### 4.6 Single-User ehrlich machen
MVP explizit als Einzelperson framen; Mehrpersonen-Haushalt als späterer Tier (passt zum geplanten
Family-Plan).

### 4.7 Bereits umgesetzte Optimierungen (nur bestätigen / nicht neu bauen)
Pantry als Home + Baseline-Upload-Gate, transparente Leerzustände, Engagement-Banner, Progress-Tracking,
Rezepte + Easy Swaps, Nutri-Coach, Non-Food-Filter (`non_food_terms.py`), Waste-Tracking (Migration v12),
GDPR-Export/Löschung, DE/EN-i18n, Ergebnis-Seite vereinfacht (Epic 14).

**Vor der Präsentation bestätigen** (in `docs/architektur_entscheidungen.md` als „Claude-Empfehlung, nicht
gegengecheckt" markiert): Zwei-Karten-Darstellung Lager-first vs. Umschalter; ±10 %-Toleranzband +
Haltbarkeits-Tage bei Kalorien/Ablaufschätzung.

---

## 5. Capstone-Einordnung & 1-Wochen-Plan (2 Personen)

**Bridge:** Das Produkt bleibt regelbasiert (Vertrauens-Entscheidung). Ihr müsst das *Matching* als ML-Task
*aufsetzen und messen* — das erfüllt die Rubric und verbessert das Produkt zugleich.

| Tag | Person A | Person B |
|---|---|---|
| 1 | Gold-Dataset labeln (Bons → 200+ Items, korrektes Lebensmittel + No-Match-Flag) | `requirements-ml.txt` + Kandidaten-/Feature-Extraktion aus `matcher`/`resolver` als Notebook-Funktion |
| 2 | EDA-Notebook (5 Plots: Kategorie, Fuzzy-Score korrekt-vs-falsch, Outcome/Kategorie, Coverage, Long-Tail) | Fuzzy-**Baseline** auf Test-Set messen |
| 3–4 | Data-Writeup + Baseline-vs-Advanced-Tabelle/Plot in die Pipeline | **Embedding-Re-Ranker** (Baustein 1) + Evaluation vs. Baseline |
| 5 | Gewinner-Modell hinter Feature-Flag als Matcher-Tier → Live „before/after" | Deck mit echten Zahlen aktualisieren; 5-User-Test parallel |

**Must:** Gold-Labels + Train/Test, Fuzzy-Baseline-Zahl, Embedding-Advanced-Modell, Vergleich auf einer
Metrik, EDA-Plots. **Should:** Pipeline-Notebook end-to-end, Data-Challenges-Doc, No-Match-Metrik.
**Stretch:** trainierter LogReg-Re-Ranker (Feature-Importance), Modell im Produkt verdrahtet,
Portions-/Verbrauchs-Prototyp (Baustein 2/3).

---

## 6. Priorisierte To-Do-Liste (verdichtet)

1. **Narrativ ausrichten** (kein Code) — sofort.
2. **ML-Baustein 1: Embedding-Matcher + Baseline-Vergleich** — Pflicht fürs Capstone, größter Produkthebel.
3. **1-Tap-Portion** — kleinste Änderung, entscheidend für den Kern-Loop.
4. **Check-off-Retention validieren** (5-User-Test + A/B-Auswertung) — bevor weiter poliert wird.
5. **Trend-Feedback + Single-User-Framing** — Ehrlichkeit sichern.
6. **Baustein 2/3 (Verbrauch/Portion-ML)** — als Future-Kapitel/Prototyp.
7. **Gap-Detection/Empfehlung bewusst regelbasiert lassen** — nicht anfassen.

---

*Verweise: `backend/app/services/{recommender,local_extractor,intake_estimator,shelf_life,verified_matches,
nutri_coach}.py`, `backend/app/api/pantry.py`, `bls_off_judgments.json`, `docs/architektur_entscheidungen.md`,
`midterm_presentation/requirements.md`, `nutriwise_metrics_and_data_collection_plan.md`.*
