# NutriWise — Briefing für neuen Chat: EDA & Gold-Set-Erweiterung (ML)

*Zweck: Diesen Chat fortsetzen in einer frischen Session. Aufgabe: aus echten Bon-Daten
(`receipts/NutriWise_receipts.xlsx`) ein EDA-Notebook bauen und das Matching-Gold-Set von 45 auf ~180
erweitern. Stand: 2026-07-16.*

---

## 1. Kontext-Prompt (an den Anfang des neuen Chats kopieren)

> Du hilfst beim AI-PM-Capstone **NutriWise** (vorratszentrierter Ernährungsassistent: Kassenbon → On-Device-OCR
> (Tesseract) → Pantry → Tages-Log → Empfehlungen). **Regelbasiert / LLM-Hybrid, kein trainiertes ML-Modell.**
> Team: Jennifer Rake (Sprecherin 2), Stuart Kasemeier (Sprecher 1). Haltung: **Ehrlichkeit als Feature** —
> Schätzung aus Einkauf + Tages-Log, Trends statt exakter kcal, keine med. Beratung.
>
> **Bereits gebaut (nicht neu bauen):** ein reproduzierbares ML-Notebook `ml/embedding_reranker.ipynb`
> (+ `ml/requirements-ml.txt`, `ml/README.md`, `ml/reranker_headtohead.png`) — Baseline (Fuzzy) vs. Advanced
> (multilingualer Embedding-Re-Ranker) für Lebensmittel-Matching (Bon-Zeile → BLS-4.0-Eintrag). Alles auf
> **Englisch** verfasst, läuft fehlerfrei durch. Kernbefund unten in Abschnitt 2.
>
> **Aufgabe dieses Chats:** (1) EDA-Notebook `ml/data_eda.ipynb` über die echten Bon-Daten in
> `receipts/NutriWise_receipts.xlsx` bauen; (2) daraus ein **erweitertes Gold-Set (~180 Items)** für die
> Matching-Evaluation ableiten — inkl. Labeling + Verifizierung. Lies zuerst die angehängten Dateien und
> das bestehende Notebook. Halte Zahlen, Entscheidungen und Guardrails aus diesem Briefing ein.
> Arbeite **Schritt für Schritt unter Anleitung** (erklären, kleine Häppchen, Rückfragen). Notebooks
> nach jeder Erweiterung ausführen und 0 Fehler verifizieren.
>
> **Sprache: Englisch.** Alle Deliverables (Notebook-Text, Code-Kommentare, Ausgaben, Diagramm-Beschriftungen,
> README) auf Englisch — konsistent mit den bestehenden `ml/`-Dateien. **Chat-Kommunikation** auf Deutsch.

---

## 2. Schlüssel-Fakten & bisheriger Befund (nicht neu herleiten)

**Matching-Evaluation (bestehendes Notebook, Gold-Set = 45 verifizierte BLS-Matches aus `bls_off_judgments.json`,
Korpus = 7140 BLS-4.0-Namen):**
- Leitmetrik **ExpTop-1** = faire, gleichstands-bereinigte Top-1-Genauigkeit (bei k Kandidaten am Top-Score
  zählt Gold nur 1/k). Fuzzy erzeugt viele Gleichstände (WRatio ~47), daher ist best-case Top-1 irreführend.
- Ergebnis: **Hybrid-Score (75 % WRatio + 25 % Embedding) = 33 % ExpTop-1** (deterministisch), schlägt
  reines Fuzzy WRatio (26 %). Reine Embedding-Suche (16 %) und reiner Re-Ranker (24 %) verlieren.
- **Ehrliche Kernbotschaft:** Off-the-shelf-Embedding ist **kein Haupt-Matcher, sondern ein Tie-Breaker.**
  Auto-Pick → Hybrid; Auswahlliste (Top-3/5) → reines Fuzzy (R@3/R@5 = 56 %). Fehler des Embeddings:
  Token-Fallen (`Cola`→`Colabier`), Domänen-Blindheit (roh/gedünstet, Fettstufen).
- **Messgrenzen bewusst nennen:** nur 45 Items; α auf demselben Set getunt (optimistisch); Exakt-Name-Metrik
  bestraft gleichwertige BLS-Alternativen; keine neuen Judge-Urteile.

**„Gold" = Gold-Standard/ground truth:** die als korrekt bekannte Referenz. Query = Bon-Zeile,
Gold = der von 3-LLM-Judges bestätigte richtige BLS-Eintrag.

**Trainieren vs. Inferenz:** Bisher nur Inferenz (Modell benutzen). Echtes Fine-Tuning bräuchte ~1.000–10.000
Bon→BLS-Paare (haben wir nicht). Diese Daten entstehen organisch über **Tier-0 „gelernte verifizierte
Matches"** (User-Bestätigungen), nicht über gekaufte DBs.

---

## 3. Datenlage (EDA bereits gemacht — Zahlen übernehmen, nicht neu raten)

**① `receipts/NutriWise_receipts.xlsx` — echte Bons, DAS Kronjuwel fürs Matching.**
- 3 Sheets: `items`, `receipts`, `category`. **Titelzeile über dem Header → beim Einlesen `header=2`.**
- Sheet `items`: **180 Artikel**, 30 Belege, 7 dt. Ketten (LIDL 68, Netto 55, ALDI 22, EDEKA 20, Kaufland 7,
  PENNY 5, REWE 3). Spalten: `receipt-ID, store, location, date, name_original, name_standard, quantity,
  category, uncertain, notes`.
  - `name_original` = Roh-Bonzeile (z. B. `"CHILI MIX TRI."`, `"Kartoffeln Süß"`, `"LINSEN MIT SG"`).
  - `name_standard` = bereinigt (z. B. `"Chili-Mix Tricolore"`, `"Süßkartoffeln"`).
  - `uncertain` = True bei 15/180 (Ehrlichkeits-Flag), `category` in dt. Klassen (vegetable 60, dairy 23,
    fruit 22, bakery 12, legume 11, meat 10 …).
  - **KEIN BLS-Match vorhanden** — nur **1/180** `name_standard` liegt exakt im BLS-Korpus.
    → 180 echte Queries, aber **Label fehlt noch** (= die eigentliche Arbeit).

**② `receipts/Groceries_dataset.csv` — NICHT fürs Matching.**
- Trennzeichen `;`. 38.765 Transaktionen, 3.898 Mitglieder, Datum, nur **167 generische englische Kategorien**
  („whole milk", „tropical fruit"). → Ideal für **ML-Baustein 2 (Verbrauchs-/Next-Cart-Vorhersage)** via
  Mitglied+Datum+Warenkorb, **nicht** für Namen-Matching. **Nicht übersetzen** (Namen sind nur Muster-Tokens).

**③ `receipts/Instacart Market Basket Analysis_Products.csv` — randständig.**
- 49.688 **englische** Produktnamen + aisle/department. Kein BLS-Bezug, keine Bon-Zeilen. **Nicht übersetzen**
  (Modell ist multilingual; Problem ist der fehlende BLS-Bezug, nicht die Sprache).

---

## 4. Aufgaben dieses Chats

**Schritt 1 — EDA-Notebook `ml/data_eda.ipynb`** (on-brand, Salbeigrün `#7c9a6a`, viel Weißraum, sans-serif):
- `NutriWise_receipts.xlsx` sauber laden (`header=2`), die Zahlen aus Abschnitt 3 mit Diagrammen belegen
  (Ketten-, Kategorie-, uncertain-Verteilung; name_original vs name_standard).
- Kurz-EDA der beiden anderen CSVs mit klarer Einordnung „wofür (nicht) nutzbar".

**Schritt 2 — Labeling-/Verifizierungs-Pipeline** (Gold-Set 45 → ~180):
- Query-Frage klären: **`name_original` (roh, ehrlichere = echte Pipeline) vs. `name_standard` (bereinigt,
  leichter)** — idealerweise **beides messen**, um den Cleanup-Effekt zu zeigen.
- BLS-Match-Vorschlag erzeugen (bestehender Hybrid-Score aus `embedding_reranker.ipynb` + optional LLM-Judge),
  dann **Label verifizieren** (unabhängiger Judge und/oder Stichprobenprüfung durch Jennifer) →
  ehrliche Label-Fehlerrate ausweisen. **Zirkularität/Same-Model-Bias vermeiden.**
- Ergebnis in denselben Harness einspeisen (`evaluate_ranker`, braucht `query` + `gold_corpus_idx`),
  **getrennt ausgewiesen von den echten 45**.

**Später (nicht dieser Chat):** `Groceries_dataset` als Datenquelle für Baustein 2 (Verbrauch/Next-Cart).

---

## 5. Anzuhängende Dateien

| Datei | Priorität |
|---|---|
| `ml/briefing_ml_data_chat.md` (dieses Briefing) | Muss |
| `ml/embedding_reranker.ipynb` (bestehender Harness + `evaluate_ranker`, ExpTop-1) | Muss |
| `ml/README.md` | Muss |
| `receipts/NutriWise_receipts.xlsx` | Muss |
| `bls_off_judgments.json` (die echten 45) | Muss |
| `data/BLS_4_0_Daten_2025_DE.xlsx` (Korpus, Spalte `Lebensmittelbezeichnung`) | Muss |
| `receipts/Groceries_dataset.csv`, `receipts/Instacart …_Products.csv` | Optional (Kurz-EDA) |
| `projekt_briefing_neuer_chat.md` (Gesamt-Produktkontext) | Optional |

---

## 6. Do / Don't (Guardrails)

**Do:** `python -m pip` (nicht `pip`) für Installs (venv-Falle des Nachbarprojekts vermeiden); Notebooks nach
Änderung ausführen + 0 Fehler prüfen; Integritäts-Check (liegt jedes Gold im Korpus?) vor jeder Messung;
Label verifizieren, Fehlerrate ehrlich nennen; erweitertes Set **getrennt** von den echten 45 ausweisen;
ExpTop-1 als Leitmetrik; on-brand Diagramme; **Englisch für alles — ML-Deliverables in `ml/` und die
Chat-Kommunikation.**

**Don't:** kein trainiertes Modell vortäuschen; Embedding nicht als Haupt-Matcher verkaufen (Tie-Breaker!);
englische Tabellen NICHT übersetzen; synthetisch/auto-gelabelte Daten nicht als verifizierten Gold-Standard
ausgeben; α-Overfitting nicht verschweigen; bei Deck/Doc-Revisionen erst Änderungsliste zur Freigabe.
