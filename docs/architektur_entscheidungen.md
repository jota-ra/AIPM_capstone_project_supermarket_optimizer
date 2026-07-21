# Architektur-Entscheidungen — Gap-Analyse & Nutri-Coach

Diskussionsprotokoll zwischen Jennifer und Claude, ausgehend vom Vergleich
des Miro-Flowdiagramms (Teamkollege) gegen die bestehende Code-Basis.

**Kontext:** 2 Wochen bis Deadline (Kursabschluss AI Projektmanagement),
2-Personen-Team, Claude Code als Werkzeug.

---

## Status Quo (aktuell)

**Fertig, verifiziert, im Betrieb:**
- Gap-Analyse-Basis: Eisen/Protein/Calcium/Fiber/Zucker/Processed, Lager,
  Health Score, Easy Swaps, Konflikt-Erkennung, Progress-Tracking, Coach-Persona
- ToDo 1 — Tages-Log mit rückwirkendem Eintragen + Freitext
- ToDo 2 — Ablaufschätzung + Lager-first Next-Cart-Empfehlung
- ToDo 3 — Kalorien als vierter absoluter Nährstoff
- **Epic 11 — Transparente Leerzustände** (`has_sufficient_data`-Flag +
  differenzierte Empty-State-Texte)
- **Epic 12 — Lager-Log Robustheit** (Autocomplete, Match-Transparenz bei
  Freitext, nachträgliches Korrigieren von Kategorie/Einheit)
- **Epic 13 — Tägliches Engagement** (In-App-Erinnerungs-Banner ab 3 Tagen
  Inaktivität, Erklärtext im Pantry-Header)
- **Epic 14 — Ergebnis-Seite vereinfacht** (Kurzansicht/Details-Toggle,
  vereinheitlichte Nährstoff-Status-Liste, eingeklappte Dimensions-Balken)
- **P1.1 — Präferenz-Lernen aus Feedback** (regelbasierte Kandidaten-
  Umsortierung anhand vergangenen Feedbacks, s. unten)

**Offen aus der Diskussion (nicht vergessen, nur noch nicht gebaut):**
- P1.1-Favoriten-Teil (siehe Realitätscheck unten — bewusst nicht mitgebaut,
  da es keine Favoriten-Funktion/-Datenmodell im Projekt gibt)
- Zwei Detail-Entscheidungen als "Claude-Empfehlung, nicht explizit
  gegengecheckt" umgesetzt — vor Präsentation kurz bestätigen lassen:
  Option A bei der Lager-first-Darstellung (zwei Karten statt Umschalter),
  ±10%-Toleranzband + Haltbarkeits-Tage-Werte bei Kalorien/Ablaufschätzung
- **Operativ, blockierend:** Gemini-Tageskontingent (20 Requests/Tag,
  kostenloser Tarif) während der Entwicklung aufgebraucht — vor dem Demo
  auf bezahlten Tarif prüfen

**Bug gefunden und behoben während Epic 12.3:** `update_pantry_item_metadata`
hat einen bereits-kanonischen Kategoriewert (z. B. "vegetable") fälschlich
durch `_canonical_category` geschickt, die deutschen Rohtext ("Gemüse") in
kanonische Kategorien übersetzt — bei englischem Input traf sie keinen
Lookup-Schlüssel und fiel still auf "other" zurück. Korrigiert: direkter
Abgleich gegen die bekannten 8 Kategorien, sonst "other".

**Deviationen von der Kollegen-Skizze (Miro), mit vorgeschlagenem Kommentar:**
Siehe Abschnitt "Abgleich mit der Kollegen-Skizze" unten — dort auch die
4 konkreten Kommentar-Texte fürs Team.

---

## Priorisierte Reihenfolge

### Erledigt

1. ✅ **Tages-Log mit rückwirkendem Eintragen + Freitext-Ergänzung**
2. ✅ **Ablaufdatum-Schätzung + Lager-first Next-Cart-Empfehlung**
3. ✅ **Kalorien als vierter absoluter Nährstoff**
4. ✅ **Epic 11 — Transparente Leerzustände**
5. ✅ **Epic 12 — Lager-Log Robustheit**
6. ✅ **Epic 13 — Tägliches Engagement**
7. ✅ **Epic 14 — Ergebnis-Seite vereinfachen**
8. ✅ **P1.1 — Präferenz-Lernen aus Feedback** (regelbasiert, kein Training;
   Favoriten-Teil bewusst nicht mitgebaut, s. Detail-Abschnitt unten)

### Offen

Keine gebauten Epics mehr offen. Verbleibend: die zwei unten genannten
Detail-Bestätigungen und der operative Gemini-Tarif-Punkt.

### Explizit für das MVP gestrichen/verschoben — mit Begründung

| Punkt | Begründung |
|---|---|
| Preis-Extraktion aus dem Kassenbon | Statische Kosten-Stufen (low/medium/high) reichen für Easy Swaps im Demo-Kontext; echte Preise sind ein Nice-to-have, kein Blocker |
| Weekly/Monthly-Übersicht | Reine Aggregations-UI über bereits vorhandene Daten — niedrigere Priorität als die funktionalen Bausteine oben |
| Grocery Ranking/Grouping | Keine geprüfte Nutzerhypothese dafür; MVP-Kernhypothese ist "vertraut der User EINER Empfehlung genug zu handeln", nicht "gefällt ihm eine Liste" |
| Volle Mikronährstoff-Abdeckung (Vitamine, Magnesium, B12, …) | OFF-Abdeckung wird pro Nährstoff schwächer, DGE-Recherche-Aufwand bleibt gleich hoch — lieber 4 Nährstoffe sauber als 10 halbgar |
| "Wie oft Zuhause kochen"-Frage im Onboarding | Kein Konsument dieser Antwort in der Pipeline — Daten sammeln ohne Verwendung |
| Freie LLM-Rezept-Generierung | Widerspricht der Kernregel seit Roadmap Story 5.3 ("LLM must not invent nutrition facts") |
| Exaktes Alter (Geburtsdatum) statt Alters-Bucket | Geprüft: Genauigkeitsgewinn marginal (Bucket-Mittelwert-Fehler bei BMR winzig ggü. der viel gröberen Aktivitäts-Stufen-Granularität); zusätzliches Pflichtfeld + mehr identifizierende Daten (Datenschutz) für kaum Nutzen |
| Getrennte Exercise-Frequency-/Daily-Movement-Felder | Redundant zu `activity_level` fürs MVP, mehr Onboarding-Reibung für kaum mehr Genauigkeit |
| Echte CI/pytest-Suite | Vorhandene manuelle Smoke-Test-Skripte sind für 2 Personen/2 Wochen in diesem Kurskontext proportional genug |
| Prospektive Frage ("Für wie viele Tage kaufst du ein?") | **Entschieden gegen** — würde das bereits funktionierende, retrospektive Lager-System konkurrierend duplizieren |
| Rohes Kaufdatum aus Kassenbon-OCR extrahieren | **Nicht nötig** — `PantryItem.last_replenished_at` (Upload-Zeitpunkt) reicht als Anker für die Ablaufschätzung |
| E-Mail/Push-Erinnerungen | Infra-Aufwand sprengt den 2-Wochen-Rahmen — Epic 13 nutzt stattdessen ein reines In-App-Banner |

---

## Abgleich mit der Kollegen-Skizze (Miro)

| Bereich | Skizze | Tatsächlich gebaut | Bewusst? |
|---|---|---|---|
| "Für wie viele Tage kaufst du ein?" (prospektiv) | Frage vor dem Next Cart | Nicht gebaut — stattdessen retrospektives Pantry/Tages-Log | Ja |
| Kaufdatum vom Kassenbon | Wird extrahiert | Nicht extrahiert — `last_replenished_at` reicht als Anker | Ja |
| Preis | Wird extrahiert | Nicht extrahiert, statische Kosten-Stufen bei Easy Swaps | Ja (MVP-Scope) |
| "Repräsentieren diese Kassenbons deinen ganzen Einkauf?" | Explizite Frage | Nicht gebaut | **Nein — echte Lücke** |
| Recipe Generation | Klingt nach dynamischer Generierung | Statische, kuratierte Tabelle | Ja (Anti-Halluzinations-Prinzip) |
| Exaktes Alter / getrennte Exercise+Movement-Felder | Beides granularer | Alters-Bucket / ein `activity_level`-Feld | Ja |
| Grocery Ranking/Grouping, Weekly/Monthly-Dashboard | Vorgesehen | Nicht gebaut | Ja |
| Goal Multiplier (Kalorienziel) | Flache Prozent-Anpassung auf TDEE | Gebaut, zusätzlich mit zweiseitigem Toleranzband + zielabhängiger Unterdrückung | Erweitert, nicht 1:1 |
| Ablaufschätzung + Lager-first-Empfehlung | Kommt in der Skizze nicht vor | Gebaut | Wir gehen über die Skizze hinaus |
| Tages-Log mit Freitext | Nur grob angedeutet (Buckets) | Präziser gebaut (echte Mengen, freies Datum) | Wir gehen über die Skizze hinaus |

**Konkrete Kommentare für den Kollegen:**

1. *Zur prospektiven Frage:* "Wir haben das bewusst nicht gebaut, weil wir ein
   retrospektives System haben (täglich bestätigter, tatsächlicher Konsum mit
   Teilmengen). Beides parallel würde sich widersprechen. Falls dein Flow
   downstream davon ausgeht — wo genau brauchst du diese Antwort?"
2. *Zu "Recipe Generation":* "Falls das freie LLM-Generierung meint: das
   widerspricht der Grundregel seit dem ersten Roadmap-Risiko ('LLM must not
   invent nutrition facts', 3. Juli). Unser System ist deshalb eine kuratierte,
   statische Tabelle. Falls du echte Generierung willst, müssen wir das vorher
   mit dieser Regel abgleichen."
3. *Zur Vollständigkeits-Frage:* "Deine Frage 'repräsentieren diese Kassenbons
   deinen ganzen Einkauf?' haben wir nicht umgesetzt — das ist eine echte
   offene Lücke bei uns, keine bewusste Streichung. Guter Punkt, den wir noch
   nachziehen sollten."
4. *Zu Kaufdatum/Preis:* "Falls dein Teil (z. B. Kosten-Dashboard) darauf
   angewiesen ist: beides wird aktuell nicht aus dem Kassenbon extrahiert.
   Sag Bescheid, falls du das brauchst."

---

## Diskussionsverlauf & Begründungen im Detail (ToDo 1–3)

### A. Prospektiv vs. retrospektiv — entschieden

Beim bestehenden, retrospektiven Lager/Konsum-System bleiben
(`services/pantry.py`, `ConsumptionEvent`). Begründung: zwei konkurrierende
Lösungen für dasselbe Grundproblem hätten sich widersprochen. Das
Pantry-System liefert echte bestätigte Daten statt einer Vorab-Schätzung.

### B. Rohes Kaufdatum aus dem Kassenbon — geprüft und verworfen

Ursprünglicher Vorschlag (Claude): Kaufdatum parsen, weil Upload-Zeitpunkt ≠
echter Kaufzeitpunkt. Gegenprüfung (Jennifer): nötig, wenn der User ohnehin
bestätigen muss, was er tatsächlich gegessen hat? Ergebnis: `intake_estimator.py`
und `progress_tracker.py` nutzen ausschließlich `ConsumptionEvent.consumed_at`
— das Kaufdatum fließt in keine Berechnung ein. Ursprüngliche Priorisierung
war ein Fehler, zurückgenommen. Das eigentliche Problem (Genauigkeit von
`consumed_at` bei seltener, nachträglicher Bestätigung) führte zu ToDo 1.

### ToDo 1 — Tages-Log (✅ erledigt)

Löst drei Unsicherheiten: **Wann gegessen** (Tages-Ansicht, rückwirkendes
Eintragen), **Vollständigkeit** (Freitext pro Tag für Lebensmittel ohne
Kassenbon-Ursprung), **Zurechenbarkeit** (kein neuer Mechanismus nötig — die
bestehende Teilmengen-Logik reicht, täglicher statt wöchentlicher Eintrag
reduziert das Vergessen-Problem).

Umgesetzt: `confirm_consumption()`/`insert_consumption_event()` mit optionalem
`consumed_at`; `log_manual_consumption()` (matched gegen Lager-Item falls
vorhanden, sonst unabhängiger Log-Eintrag); `POST`/`GET /pantry/log`;
`PantryStep.tsx` mit Vor-/Zurück-Datumsnavigation (14 Tage) + Freitext-Formular.
Scope-Cut: nur Hinzufügen, kein Bearbeiten/Löschen vergangener Tage.

### ToDo 2 — Ablaufschätzung + Lager-first-Empfehlung (✅ erledigt)

Umgesetzt: `services/shelf_life.py` (Haltbarkeits-Tabelle pro Kategorie,
bewusst approximiert); `PantryItem.estimated_expiry`/`days_until_expiry`
(on-the-fly berechnet); `find_pantry_match()` in `recommender.py` (bevorzugt
das am schnellsten ablaufende passende Lager-Item, respektiert
Exclusion-Filter, abgelaufene Items bleiben sichtbar mit `urgent=True`);
`PantryMatchCard` zusätzlich zur `NextCartCard` (Option A).

**Bug gefunden und behoben:** Kategorien wurden beim Einlagern nie
kanonisiert (blieben roher Parser-Text wie "Getränke" statt "drink") —
dadurch wären sowohl die Ablaufschätzung als auch die länger bestehende
Gramm-Umrechnung in `intake_estimator.py` fast immer auf den "other"-Fallback
zurückgefallen. Behoben über `fallback_categories._canonical_category` beim
Einlagern.

### ToDo 3 — Kalorien als vierter absoluter Nährstoff (✅ erledigt)

Bricht bewusst das bisherige Muster (Eisen/Protein/Calcium = "mehr ist immer
besser bis zum Bedarf"): Kalorien brauchen ein zielabhängiges Ziel und einen
zweiseitigen Gap. Umgesetzt: `personalized_tdee()` aus der Protein-Rechnung
extrahiert; `_CALORIE_GOAL_ADJUSTMENT`-Tabelle (Miro-Diagramms "Goal
Multiplier"); `detect_calorie_gap()` mit ±10%-Toleranzband, **außerhalb**
der generischen `_NUTRIENTS`-Schleife.

**Korrektur während der Verifikation:** die erste Fassung hat bei
zielkonformer Abweichung (Defizit bei "Abnehmen", Überschuss bei
"Muskelaufbau") nur eine mildere Nachricht gezeigt, nicht — wie in der
eigenen Spec verlangt — den Gap komplett unterdrückt. Beim Gegentesten
gegen die eigene Verifikationsvorgabe gefunden und korrigiert.

### P1.1 — Präferenz-Lernen aus Feedback (✅ erledigt)

**Bewertung:** grundsätzlich gut, aber ausdrücklich kein trainiertes Modell
— mit 2 Testern über 2 Wochen nicht seriös machbar, würde der
Anti-Halluzinations-Linie widersprechen. Stattdessen regelbasierte
Gewichtung auf Bestehendem: Feedback-System (`models/feedback.py`) existierte
bereits, wurde aber nie ausgelesen.

**Umgesetzt:**
- `db/supabase.py`: neu `get_feedback_by_session(session_id)` (analog zu
  `get_recommendations_by_session`).
- `services/preference_learning.py` (neu): `item_preference_scores(session_id)`
  verknüpft `recommendations.payload.item` (welches Item wurde gezeigt) mit
  `feedback.response` (yes=+1/no=-1/maybe=0) über `recommendation_id` und
  summiert pro Item-Name.
- `services/recommender.py`: neu `_apply_preference_scores(candidates, scores)`
  — stabile Umsortierung nach Score (höchster zuerst, Tabellenreihenfolge als
  Tiebreaker), **entfernt nie einen Kandidaten**, verschiebt ihn nur.
  `recommend_next_cart()` und `find_pantry_match()` erhalten optionalen
  `session_id`-Parameter, wenden den Boost vor dem Exclusion-Filter an;
  ein positiv bewerteter Treffer bekommt einen zusätzlichen
  Reasoning-Satz ("You've responded positively to this before."). Ohne
  `session_id`/ohne Feedback-Historie bleibt das Verhalten unverändert
  (bestehende Regressionsskripte laufen unverändert grün).
- `api/recommendations.py`: `session_id` wird an beide Aufrufe durchgereicht.

**Bewusst nicht mitgebaut — Favoriten:** Es gibt kein Favoriten-
Datenmodell/keine Favoriten-UI im Projekt; das wäre eine neue Funktion,
nicht nur eine Verdrahtung von Bestehendem, und war nicht Teil eines
bestätigten Atomic-Task-Scopes. Aufgeführt als offener Erweiterungspunkt,
falls Zeit bleibt — kein Blocker für die Kernfunktion.

**Verifiziert (live gegen echte Supabase-Tabellen `recommendations`/`feedback`,
Testdaten danach gelöscht):** Baseline ohne Feedback wählt den ersten
erlaubten Kandidaten in Tabellenreihenfolge ("Griechischer Joghurt" für
`protein:low`). Nach einem simulierten "yes"-Feedback auf "Tofu" wählt
dieselbe Session "Tofu", inklusive Transparenz-Hinweis in `reasoning`. Nach
einem simulierten "no"-Feedback auf den ursprünglichen Top-Kandidaten wird
dieser ans Ende verschoben, bleibt aber unverändert in der zugrunde
liegenden Kandidatenliste (`_apply_preference_scores` verändert nur die
Reihenfolge, nie die Menge — separat per Unit-Check bestätigt).

**Realitätscheck:** mit wenig Nutzungshistorie wird der Effekt eher
anekdotisch als groß sichtbar sein — im Pitch nicht als "lernender
Algorithmus" überverkaufen.

---

## Epics 11–14 (entwicklungsbereit)

Format wie im übrigen Projekt: Epic → User
Story → Atomic Tasks (Component/Input/Output/Success/Test). Jede Story ist
so beschrieben, dass ein Entwickler sie ohne Rückfrage umsetzen kann.

### Epic 11 — Transparente Leerzustände

**Ziel:** Der Nutzer soll nie im Unklaren sein, ob ein leerer Gap-Bereich
"alles im grünen Bereich" oder "noch nicht genug Daten" bedeutet.

**11.1 — Data-Sufficiency-Signal.** Als Nutzer will ich unterscheiden
können, ob "keine Gaps" heißt "alles gut" oder "noch nichts bestätigt",
damit ich nicht fälschlich denke, meine Ernährung sei bereits optimal.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 11.1.1 Data-Sufficiency-Flag | `backend/app/services/absolute_gap_detector.py` (neue Funktion `has_sufficient_data(session_id) -> bool`, genutzt in `api/nutrition.py`) | `estimate_daily_*` Ergebnisse der 4 Nährstoffe (`events_considered`) | neues Response-Feld `has_sufficient_data: bool` (True, wenn mind. 1 Nährstoff `events_considered > 0` hat) | Snapshot-Response unterscheidet "keine Events" von "im Zielbereich" | Session ohne jeden Confirm → `false`; Session mit ≥1 Confirm + Werten im Zielbereich → `true`, `absolute_gaps=[]` |
| 11.1.2 Empty-State-Text differenzieren | `frontend/src/steps/ResultsStep.tsx`, `frontend/src/types/api.ts` (`has_sufficient_data` auf `NutritionSnapshot`), `frontend/src/lib/i18n.tsx` (zwei neue Keys) | `snapshot.has_sufficient_data` | zwei unterschiedliche Texte im leeren `absolute_gaps`-Bereich | Text ändert sich sichtbar je nach Flag | Manuell beide Zustände auslösen (Session ohne Confirms vs. mit) |

### Epic 12 — Lager-Log Robustheit

**Ziel:** Freitext-Eingaben im Tages-Log sollen nicht durch Tippfehler
unbeabsichtigt vom Lagerbestand entkoppelt werden, und der Nutzer soll
Transparenz über die Datenqualität seiner Einträge haben.

**12.1 — Autocomplete aus dem Lagerbestand.** Als Nutzer will ich beim
Freitext-Eintrag Vorschläge aus meinem bestehenden Lager sehen, damit
Tippfehler nicht zu ungewollt getrennten Einträgen führen.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 12.1.1 Autocomplete-Liste | `frontend/src/steps/PantryStep.tsx` (`ManualLogForm`) | bereits geladene `items`-Liste (kein neuer Endpoint) | HTML `<datalist>` (oder gefilterte Dropdown-Liste) mit den Lager-Namen | Tippen zeigt passende Lager-Items zur Auswahl | Manuell: Teilstring eines Lager-Namens eintippen, Vorschlag erscheint |

**12.2 — Match-Transparenz bei Freitext.** Als Nutzer will ich sehen, ob
mein Freitext-Eintrag echten Nährwerten zugeordnet werden konnte, damit ich
weiß, wie verlässlich die Schätzung ist.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 12.2.1 Match-Info in Response | `backend/app/api/pantry.py` (`POST /pantry/log`), reuse `services/nutrition_mapping.map_items` | Freitext-Name | Response-Feld `matched: bool` (True bei OFF/generischem Match, False bei reinem Fallback) | Response zeigt Match-Qualität, ohne den Log-Eintrag selbst zu verändern | Bekannter Name (z. B. "Apfel") → `matched=true`; Fantasiename → `matched=false` |
| 12.2.2 UI-Hinweis | `frontend/src/steps/PantryStep.tsx` | `matched` aus 12.2.1 | kurzer Hinweistext nach dem Hinzufügen ("passende Nährwerte gefunden" / "grobe Schätzung") | Hinweis erscheint korrekt je nach Match-Ergebnis | Beide Fälle manuell auslösen |

**12.3 — Lager-Item nachträglich korrigieren.** Als Nutzer will ich
Kategorie/Einheit eines Lager-Items nachträglich korrigieren können, damit
falsch erkannte OCR-Daten die Ablaufschätzung nicht verfälschen.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 12.3.1 PATCH-Endpoint | `backend/app/api/pantry.py` (neu: `PATCH /pantry/items/{normalized_name}`), `backend/app/services/pantry.py` (neu: `update_pantry_item_metadata(session_id, name, unit=None, category=None)`) | Body `{unit?, category?}` | aktualisiertes Lager-Item | Kategorie-Änderung wirkt sich sofort auf `days_until_expiry` aus | Kategorie von "other" auf "vegetable" ändern → Ablaufschätzung ändert sich entsprechend |
| 12.3.2 Edit-UI | `frontend/src/steps/PantryStep.tsx` (`PantryRow`) | aktuelle `unit`/`category` | inline editierbare Felder | Änderung wird gespeichert und sofort angezeigt | Manuell Kategorie ändern, Seite neu laden, Änderung bleibt |

### Epic 13 — Tägliches Engagement

**Ziel:** Nutzer zur regelmäßigen Bestätigung motivieren, ohne
E-Mail/Push-Infrastruktur aufzubauen (Scope-Cut, siehe Streichliste oben).

**13.1 — In-App-Erinnerung.** Als Nutzer will ich eine Erinnerung sehen,
wenn ich länger nicht geloggt habe, damit meine Bedarfsschätzungen nicht
veralten.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 13.1.1 Tage-seit-letzter-Bestätigung | `backend/app/services/pantry.py` (neu: `days_since_last_confirmation(session_id) -> Optional[int]`), eingehängt in `api/pantry.py`'s `GET /pantry`-Response | letztes `ConsumptionEvent.consumed_at` der Session | Response-Feld `days_since_last_confirmation` | Korrekter Tageswert, `None` wenn nie bestätigt | Session mit Confirm vor 5 Tagen → `5`; frische Session → `None` |
| 13.1.2 Banner-UI | `frontend/src/steps/PantryStep.tsx` (oder `ResultsStep.tsx`) | `days_since_last_confirmation >= 3` | Hinweis-Banner ("Du hast seit X Tagen nichts bestätigt — deine Schätzungen werden ungenauer") | Banner erscheint/verschwindet korrekt je nach Wert | Manuell Schwellenwert testen |

**13.2 — Begründung im UI.** Als Nutzer will ich verstehen, warum
tägliches Bestätigen wichtig ist, damit ich es priorisiere.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 13.2.1 Erklärtext | `frontend/src/steps/PantryStep.tsx`, `frontend/src/lib/i18n.tsx` (neuer Key) | — (reiner Copy/Platzierungs-Task) | kurzer Erklärtext im Pantry-Header | Text ist sichtbar, ohne die Seite zu überladen | Visuelle Prüfung |

### Epic 14 — Ergebnis-Seite vereinfachen

**Ziel:** Die Ergebnis-Seite (aktuell 12+ Karten/Blöcke untereinander) auf
eine schnelle "Kurzansicht" + optionale "Details" verteilen — Demo-Politur,
keine neue Funktionalität. Bewusst zuletzt, da subjektivster Punkt.

**14.1 — Kurzansicht vs. Details.** Als Nutzer will ich zuerst eine kurze,
verständliche Zusammenfassung sehen, bevor ich mich durch technische
Details klicke.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 14.1.1 Layout-Umbau | `frontend/src/steps/ResultsStep.tsx` | bestehende Karten (unverändert in sich) | "Kurzansicht" (Coach-Message, Health Score, Next-Cart/Pantry-Match-Karte(n), Conflicts falls vorhanden) oben, Rest (Progress, Dimensions, Gaps, Absolute Gaps, Easy Swaps, Pantry-Recipes, evaluated_candidates) unter einem Toggle/`<details>` | Seite wirkt beim ersten Laden deutlich kürzer, alle Inhalte bleiben erreichbar | Manuell: Seite laden, Kurzansicht sichtbar, Details einklappbar |

**14.2 — Vereinheitlichte Nährstoff-Anzeige.** Als Nutzer will ich
Nährstoff-Status an einem Ort sehen, nicht in zwei getrennten Listen
(Dichte-Gaps / absolute Gaps).

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 14.2.1 Anzeige zusammenführen | `frontend/src/steps/ResultsStep.tsx` | `snapshot.gaps` + `snapshot.absolute_gaps` (Backend-Trennung bleibt unangetastet) | eine gemeinsame Anzeige-Liste "Nährstoff-Status", pro Eintrag mit Einheit (damit Dichte- und Absolut-Werte nicht verwechselt werden) | Nutzer sieht einen Bereich statt zwei | Beide Gap-Typen gleichzeitig vorhanden → beide erscheinen in derselben Liste, klar unterscheidbar |

**14.3 — Dimensionen einklappen.** Als Nutzer will ich die rohe
Dimensions-Balkenanzeige nur bei Bedarf sehen.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 14.3.1 Standardmäßig eingeklappt | `frontend/src/steps/ResultsStep.tsx` | bestehende `DimensionBar`-Sektion | Sektion standardmäßig eingeklappt, mit "Details anzeigen"-Toggle | Sektion ist beim Laden nicht sichtbar, aber ein Klick entfernt | Manuell togglen |

---

## Epic 15 — Tiered Nutrition Feedback (Confidence Ladder)

*Note: this section continues in English — scoped in an English-language planning
session (with Stuart, not Jennifer). Format matches Epics 11–14 above.*

**Goal:** never show the user a confidently-wrong number. Show *something*
useful from the very first receipt upload, and progressively unlock deeper
feedback (basket composition → early signal → weekly gap/score → long-term
trend) only as real evidence accumulates — and tell the user in plain
language what unlocks the next level.

**Respects two decisions already made above, does not reopen either:**
- **Section A (line 130):** stays retrospective/confirmed (`ConsumptionEvent`)
  only. No story below introduces a competing prospective/inferred
  consumption model.
- **Section B (line 137):** does not thread receipt `purchase_date` into
  `PantryItem.last_replenished_at` or build depletion/purchase-interval
  modeling (`consumption_timeframe.py`/`status_quo.py`) into any new tier.
  Tier 1 (15.3) reads `receipt_items` directly for a one-off composition
  snapshot — it is not a consumption-timing model, so it doesn't compete
  with the retrospective system.

**15.1 — Tracking-Coverage Primitive.** As a user, I want the app to tell
the difference between "I didn't log/wasn't home" and "I actually ate too
little," so a gap in my logging never reads as a real nutritional problem.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 15.1.1 Away-day flag storage | new table `user_day_flags` (next migration slot, e.g. `v15_user_day_flags.sql`), `backend/app/db/pantry_repo.py` (new `mark_day_away` / `unmark_day_away` / `get_away_days`) | `user_id, date` | row `{user_id, date, flag='away'}`, idempotent toggle | a marked day is retrievable and un-markable | mark day X away → appears in `get_away_days`; unmark → disappears |
| 15.1.2 Coverage calculator | `backend/app/services/pantry.py` (new `day_coverage(user_id, date_from, date_to) -> {tracked, away, untracked}`) | date range, `ConsumptionEvent` rows, `user_day_flags` | every day in range classified as exactly one of `tracked` (≥1 `ConsumptionEvent`), `away` (explicit flag), `untracked` (neither) | counts always sum to the full range length | 7-day range, 3 logged / 1 away / 3 blank → counts match |
| 15.1.3 Windowed calculations respect coverage | `backend/app/services/intake_estimator.py` (`_estimate_daily_nutrient`, line 86) | existing `window_days`/`offset_days` params + `day_coverage()` | denominator = tracked-day count, not calendar-day count; `away` days excluded entirely, not zeroed | a week with 2 away days no longer reads as a deficit purely from those days | 5 tracked days at 100% of target + 2 away days → weekly gap shows ~0%, not −29% |
| 15.1.4 "Mark day away" control | `frontend/src/steps/DiaryStep.tsx` (date-nav header) | currently viewed date | toggle button, calls new away-flag API | tapping marks/unmarks the day, state visible on revisit | manual: navigate to a past date, tap "I was away," reload, state persists |
| 15.1.5 Coverage badge component | new `frontend/src/components/CoverageBadge.tsx` (reuse the `h-2 rounded-full bg-zinc-100` bar idiom already used by `GatedGapsCard`, `ResultsStep.tsx:453-490`) | `{tracked, away, untracked}` + window length | small bar + "X of Y days tracked" label; reused by 15.4/15.5/15.6 | visually consistent with existing progress bars | render with 3/7 and 30/90 sample data |
| 15.1.6 Explainer copy | `frontend/src/lib/i18n.tsx` (2 new keys) | — | short disclaimer next to the away toggle | user understands the mechanic without asking | visual review, en + de |

**15.2 — Tier 0: Single-Source Targets.** As a user, I want the same
calorie/macro target shown everywhere in the app, so numbers never silently
disagree with each other.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 15.2.1 Audit legacy-engine callers | grep every caller of `nutrition_personalization.personalized_calorie_target_kcal` / `personalized_tdee` / `daily_protein_target_g` | — (read-only) | complete call-site list | no surprises during 15.2.2 | list reviewed, nothing missed |
| 15.2.2 Retarget calorie gap | `backend/app/services/absolute_gap_detector.py:79` (`detect_calorie_gap`) | `ideal_profile.compute_ideal_profile(profile).calories_kcal` replaces `nutrition_personalization.personalized_calorie_target_kcal(profile)` | same `AbsoluteGap` shape, new target source | `TargetsCard`'s number and the calorie-gap requirement always match | compare `/profile` `ideal_profile.calories_kcal` against the gap detector's requirement — identical |
| 15.2.3 Decide fate of legacy engine | `backend/app/services/nutrition_personalization.py` | 15.2.1 audit result | either delete the module, or explicitly scope what's left (e.g. a density-model protein ref still in use elsewhere) | no orphaned target logic silently diverging from `ideal_profile.py` | code review — nothing user-facing still compares against the old TDEE |

*No frontend/DB/explainer work in this story — invisible plumbing only.*

**15.3 — Tier 1: Basket Composition.** As a user, I want to see the macro
makeup of what I've bought before I've logged a single meal, so the app
isn't empty on day one.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 15.3.1 Basket composition calculator | new `backend/app/services/basket_composition.py` (`compute_basket_composition(user_id) -> {protein_pct, fat_pct, carb_pct, kcal_total, items_considered}`) | `receipt_items` joined to matched nutrition data (reuse the existing nutrient-resolution used by the snapshot pipeline — don't build a second lookup) | calorie-weighted macro % split across every receipt the user has uploaded | percentages sum to ~100%, computable with zero `ConsumptionEvent`s | upload one receipt, call the function before any pantry confirmation exists |
| 15.3.2 Expose via API | `backend/app/api/nutrition.py` — new `basket_composition` field on the existing snapshot response, or a new `GET /nutrition/basket-composition` | `user_id` | `{protein_pct, fat_pct, carb_pct}` | reachable before the upload-progress gate clears | call it mid-onboarding, before `ReceiptUploadProgress.complete` |
| 15.3.3 Basket composition card | new `frontend/src/components/BasketCompositionCard.tsx` (uses the `Card` primitive, `AppShell.tsx:208`) | `basket_composition` | 3-segment bar or percentage rows, labeled "Your basket" | renders in the gated pre-threshold `ResultsStep` view (near `GatedGapsCard`) and optionally `ProfileSummary` | visual check pre- and post-gate |
| 15.3.4 Honest-framing disclaimer | `frontend/src/lib/i18n.tsx` (new key, same visual treatment as `targets.constrained`) | — | disclaimer: "based on what you've bought, not confirmed eaten yet" | always shown with the card, never presented as a diet claim | visual review |

**15.4 — Tier 2: Early Signal / Calibration Mode.** As a user, I want a
gentle nudge once I've logged a little, without a hard score built on too
little data.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 15.4.1 Tracked-day threshold + blend weight | `backend/app/services/absolute_gap_detector.py` (new `tracking_maturity(user_id, window_days=7) -> {tracked_days, threshold, blend_weight}`) | `day_coverage()` (15.1.2) | `blend_weight = min(1.0, tracked_days / threshold)` — **threshold not yet confirmed, proposal: 3 tracked days** | ratio is 0 with zero logs, 1.0 once threshold met | 0/2/3/7 tracked days → 0 / 0.67 / 1.0 / 1.0 |
| 15.4.2 Blended composition | `backend/app/services/basket_composition.py` (new `compute_blended_composition`) | 15.3.1 output + confirmed-`ConsumptionEvent` composition + `blend_weight` | weighted average, shifting toward confirmed data as it accumulates | weight=0 → basket-only; weight=1.0 → confirmed-only | unit test both boundaries |
| 15.4.3 Early-signal UI | `frontend/src/steps/ResultsStep.tsx` (near `BasketCompositionCard`) | blended composition + `blend_weight` + `CoverageBadge` | qualitative copy only ("early signs your protein share is lower than target") — **no numeric score below threshold** | no hard percentage-vs-target shown pre-threshold | visual check at 0/2/3 tracked days |
| 15.4.4 "Unlock the next tier" explainer | `frontend/src/lib/i18n.tsx` (new key) | `threshold − tracked_days` | dynamic copy: "log 2 more days to unlock your weekly score" | updates live with remaining count | visual check at varying tracked-day counts |

**15.5 — Tier 3: Weekly Gap + Health Score.** As a user, I want an honest
weekly report card that doesn't punish me for eating outside or traveling.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 15.5.1 Extend absolute gaps to fat/carbs | `backend/app/services/absolute_gap_detector.py:72` (`_NUTRIENTS`), `backend/app/services/intake_estimator.py` (new `estimate_daily_fat_g`/`estimate_daily_carbs_g` alongside lines 166-195) | `ConsumptionEvent`s, `ideal_profile.compute_ideal_profile()` (post-15.2) | `AbsoluteGap` entries for fat_g/carbs_g, same shape as existing iron/protein/calcium | `detect_absolute_gaps` returns 6 dimensions instead of 3(+calorie) | log a day, verify fat/carb gaps appear alongside existing ones |
| 15.5.2 Meals-outside daily log | **Option A (recommended):** `backend/app/services/pantry.py` — `log_manual_consumption` with a reserved sentinel name (`normalized_name="__ate_out__"`), reusing existing event machinery, no new table (matches ToDo1's "no new mechanism needed" precedent). **Option B:** new minimal table `meals_outside_log(user_id, date, count)` | user taps "ate out" N times | per-day outside-meal count, queryable by date | **needs team confirmation on A vs. B** | log 2 outside-meals on a day, verify count retrievable |
| 15.5.3 Effective-target proration | `backend/app/services/absolute_gap_detector.py` (new `effective_target(profile, date, meals_outside_today)`) | `profile.meals_per_day` (**already exists, no new field**), daily target, 15.5.2's count; falls back to the existing static `MealsOutside` enum share (`status_quo.py:31`, `_MEALS_OUTSIDE` dict) on days with no explicit tap | `target × (1 − meals_outside/meals_per_day)` | a day fully eaten outside shows target≈0, not a deficit | 3 meals/day profile, 3 outside-taps → effective target 0 for every macro that day |
| 15.5.4 Wire into the weekly window | `backend/app/services/intake_estimator.py` (`DEFAULT_WINDOW_DAYS=7`, line 23) | 15.1's away-day exclusion + 15.5.3's effective target | weekly gap compares confirmed intake only against the shrunk target, over tracked days only | a week with 1 away day + 2 partial-outside days shows a fair gap | construct the scenario, compare against a naive flat-target calc |
| 15.5.5 Fat/carb + coverage badge in Results | `frontend/src/steps/ResultsStep.tsx` (`NutrientStatusList`, lines 83-120) | extended `absolute_gaps` (15.5.1) + `CoverageBadge` | weekly gap cards for all 6 dimensions, coverage badge next to the health score | visually consistent with existing gap cards | visual check with a full week of varied data |
| 15.5.6 "Why is my target smaller today" explainer | `frontend/src/lib/i18n.tsx` (new key), inline wherever `effective_target < target` | that day's outside-meal count | "2 of 3 meals today were marked eaten out, so today's target is scaled down" | shown only on days it applies | visual check, outside-meal day vs. normal day |

**15.6 — Tier 4: 30/90-Day Trend.** As a user, I want a long-term picture
that a bad week (lost receipt, vacation) doesn't distort.

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 15.6.1 Rolling weekly-average aggregator | `backend/app/services/intake_estimator.py` (new `estimate_trend(user_id, dimension, total_days=30, bucket_days=7)`, reusing the existing `window_days`/`offset_days` params of `_estimate_daily_nutrient` per bucket — no new estimation logic needed) | dimension, date range | array of `{bucket_start, avg_daily_value, coverage_pct}` | 30 days → ~4 points, 90 days → ~13 points | synthetic data with gaps, verify bucket count/values |
| 15.6.2 Coverage floor per window | `backend/app/services/absolute_gap_detector.py` (windowed variant of the `has_sufficient_data` pattern, e.g. `has_sufficient_trend_data(user_id, total_days) -> bool`) | `day_coverage()` over the full window — **threshold not yet confirmed, proposal: ≥60% tracked days** | boolean gate; below it, return `insufficient_data` instead of a distorted trend | low-coverage month shows "not enough data," not a number | simulate low-coverage vs. normal month |
| 15.6.3 Trend chart component | new `frontend/src/components/TrendChart.tsx` (genuinely new — no existing chart component to reuse) | weekly-average points (15.6.1) + `coverage_pct` per bucket | line/area chart; low-coverage buckets visually de-emphasized (dashed/lighter), not hidden | trend stays honest about data gaps | visual check with a synthetic gap month |
| 15.6.4 30/30/90-day toggle in Results | `frontend/src/steps/ResultsStep.tsx` | window selector (7/30/90 — Tier 3 is the 7-day case) | switching ranges updates the same chart/card area | no jarring reload feel when switching | manual click-through |
| 15.6.5 Scope guard: no legacy depletion model | documentation/code-review only | — | confirms Tier 4 is built purely on `ConsumptionEvent` + 15.1–15.5, never on `status_quo.py`/`consumption_timeframe.py`'s purchase-interval model | avoids resurrecting the retrospective-vs-prospective debate (Section A) | code review — no new caller of `consumption_timeframe.window_for` introduced |
| 15.6.6 Trend explainer | `frontend/src/lib/i18n.tsx` (new key) | — | "We only use days with real data for this trend — gaps from travel or a missed upload are skipped, not counted against you" | shown once per chart | visual review |

**Needs confirmation before building** (Claude recommendations, not yet
checked against the team — same convention as the two flagged items above
for Epics 11–14):
- Tracked-day threshold to unlock Tier 3 (15.4.1) — proposed 3 days.
- Coverage floor for the Tier 4 trend (15.6.2) — proposed ≥60%.
- Sentinel-event vs. new-table choice for meals-outside logging (15.5.2).
- Whether to delete `nutrition_personalization.py` outright or keep a scoped
  remnant (15.2.3).
