import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// App-wide language switch, driven by the chat onboarding's first
// question (see ChatOnboardingStep.tsx). Covers this app's own static
// copy only — text the *backend* generates (gap messages, recommendation
// explanations, disclaimers) stays English, since the backend doesn't
// localize its output today (that's backlog Epic 17, a separate piece
// of work).

export type Lang = "en" | "de";

const LANGUAGE_KEY = "nutriwise.language";

const STRINGS: Record<string, { en: string; de: string }> = {
  // Landing / demo entry point (LandingStep.tsx)
  "landing.badge": { en: "A NUTRITION COACH, ON AUTOPILOT", de: "EIN ERNÄHRUNGS-COACH, IM HINTERGRUND" },
  "landing.titleLine1": { en: "Your nutrition,", de: "Deine Ernährung," },
  "landing.titleLine2": { en: "actually understood.", de: "endlich verstanden." },
  "landing.body": {
    en: "NutriWise reads your grocery receipts and compares them to what your body actually needs — iron, protein, calcium, calories. Confirm what you really ate in seconds each day, and your coach gets sharper every week.",
    de: "NutriWise liest deine Kassenbons und vergleicht sie mit deinem tatsächlichen Bedarf — Eisen, Protein, Calcium, Kalorien. Bestätige in Sekunden, was du wirklich gegessen hast, und dein Coach wird jede Woche treffsicherer.",
  },
  "landing.registerCta": { en: "New here? Get started", de: "Neu hier? Jetzt starten" },
  "landing.loginCta": {
    en: "I already have an account — go to dashboard",
    de: "Ich habe schon ein Konto — weiter zum Dashboard",
  },
  "landing.subtext": { en: "Takes about 90 seconds. No credit card needed.", de: "Dauert ca. 90 Sekunden. Keine Kreditkarte nötig." },
  "landing.imageCaption": {
    en: "Fresh, whole ingredients — the same ones your gap analysis is built on.",
    de: "Frische, unverarbeitete Lebensmittel — dieselben, auf denen deine Bedarfsanalyse basiert.",
  },

  // Account picker (AccountPickerStep.tsx) — demo-only, see file docstring
  "accountPicker.title": { en: "Whose account is this?", de: "Wessen Konto ist das?" },
  "accountPicker.body": {
    en: "Demo accounts for this presentation. Pick one to load its saved data.",
    de: "Demo-Konten für diese Präsentation. Wähle eins, um dessen gespeicherte Daten zu laden.",
  },
  "accountPicker.select": { en: "Select", de: "Auswählen" },
  "accountPicker.loading": { en: "Loading…", de: "Wird geladen…" },
  "accountPicker.loadFailed": { en: "Could not load this account.", de: "Konto konnte nicht geladen werden." },
  "accountPicker.back": { en: "Back", de: "Zurück" },

  // Nav / shell
  "nav.dashboard": { en: "Dashboard", de: "Dashboard" },
  "nav.onboarding": { en: "Onboarding", de: "Onboarding" },
  "nav.userProfile": { en: "My Profile", de: "Nutzerprofil" },
  "nav.upload": { en: "Upload", de: "Hochladen" },
  "nav.review": { en: "Review", de: "Prüfen" },
  "nav.pantry": { en: "Pantry", de: "Lager" },
  "nav.results": { en: "Results", de: "Ergebnisse" },
  "footer.tagline": {
    en: "NutriWise · estimated from your shopping habits, not actual intake",
    de: "NutriWise · geschätzt aus deinem Einkaufsverhalten, nicht dem tatsächlichen Verzehr",
  },
  "footer.deleteData": { en: "Delete my data", de: "Meine Daten löschen" },

  // Consent banner
  "consent.badge": { en: "Before you start", de: "Bevor es losgeht" },
  "consent.title": { en: "Not medical advice.", de: "Keine medizinische Beratung." },
  "consent.body": {
    en: "NutriWise estimates your nutrition from what you buy, not what you actually eat. It isn't a diagnosis, a meal plan, or medical advice — always consult a professional for that.",
    de: "NutriWise schätzt deine Ernährung aus dem, was du kaufst, nicht aus dem, was du tatsächlich isst. Das ist keine Diagnose, kein Ernährungsplan und keine medizinische Beratung — dafür wende dich immer an eine Fachperson.",
  },
  "consent.bullet1": {
    en: "Every result is estimated from your shopping habits, not actual intake.",
    de: "Jedes Ergebnis basiert auf deinem Einkaufsverhalten, nicht auf tatsächlichem Verzehr.",
  },
  "consent.bullet2": {
    en: "Your receipt and profile answers are processed only to generate this recommendation.",
    de: "Dein Kassenbon und deine Profilangaben werden nur zur Erstellung dieser Empfehlung verarbeitet.",
  },
  "consent.bullet3": {
    en: 'You can permanently delete your receipt and profile at any time via "Delete my data" in the footer.',
    de: 'Du kannst deinen Kassenbon und dein Profil jederzeit über "Meine Daten löschen" im Footer dauerhaft löschen.',
  },
  "consent.bullet4": { en: "Nothing is shared with third parties.", de: "Es wird nichts an Dritte weitergegeben." },
  "consent.accept": { en: "I understand, continue", de: "Verstanden, weiter" },

  // User profile (edit) page
  "profile.step": { en: "My Profile", de: "Nutzerprofil" },
  "profile.title": { en: "About you.", de: "Über dich." },
  "profile.body": {
    en: "A few quiet details. Used only to shape your recommendations.",
    de: "Ein paar ruhige Angaben. Werden nur genutzt, um deine Empfehlungen zu formen.",
  },
  "profile.loading": { en: "Loading…", de: "Wird geladen…" },
  "profile.loadFailed": { en: "Could not load your profile.", de: "Profil konnte nicht geladen werden." },
  "profile.saveFailed": { en: "Could not save your changes.", de: "Änderungen konnten nicht gespeichert werden." },
  "profile.save": { en: "Save profile", de: "Profil speichern" },
  "profile.saving": { en: "Saving…", de: "Wird gespeichert…" },
  "profile.saved": { en: "Saved.", de: "Gespeichert." },
  "profile.selectPlaceholder": { en: "— select —", de: "— auswählen —" },
  "profile.noneOption": { en: "Prefer not to say / none", de: "Keine Angabe / keine" },
  "profile.quickNoteTitle": { en: "A quick note", de: "Ein kurzer Hinweis" },
  "profile.emptyTitle": { en: "No profile yet.", de: "Noch kein Profil." },
  "profile.emptyBody": {
    en: "Complete onboarding first, then your answers show up here to edit anytime.",
    de: "Schließe zuerst das Onboarding ab — danach erscheinen deine Antworten hier zur Bearbeitung.",
  },
  "profile.goToOnboarding": { en: "Go to onboarding", de: "Zum Onboarding" },

  // Upload step
  "upload.step": { en: "Step 3 · Receipt", de: "Schritt 3 · Kassenbon" },
  "upload.title": { en: "Bring in a receipt.", de: "Lade einen Kassenbon hoch." },
  "upload.body": {
    en: "Upload a photo of a grocery receipt, or paste its text if a photo isn't handy — OCR can be unreliable, so pasting always works.",
    de: "Lade ein Foto deines Kassenbons hoch, oder füge den Text ein, falls kein Foto zur Hand ist — OCR ist nicht immer zuverlässig, Einfügen funktioniert immer.",
  },
  "upload.tabPhoto": { en: "Upload photo", de: "Foto hochladen" },
  "upload.tabText": { en: "Paste text", de: "Text einfügen" },
  "upload.dropUploading": { en: "Uploading…", de: "Wird hochgeladen…" },
  "upload.dropTitle": {
    en: "Drop a receipt photo here or click to upload",
    de: "Kassenbon-Foto hier ablegen oder klicken zum Hochladen",
  },
  "upload.dropHint": { en: "JPG, PNG or WEBP", de: "JPG, PNG oder WEBP" },
  "upload.pasteLabel": { en: "Paste receipt text", de: "Kassenbon-Text einfügen" },
  "upload.analyzing": { en: "Analyzing…", de: "Wird analysiert…" },
  "upload.analyzeButton": { en: "Analyze pasted receipt", de: "Eingefügten Kassenbon analysieren" },
  "upload.pasteInstead": { en: "Paste the receipt text instead →", de: "Stattdessen Text einfügen →" },
  "upload.uploadFailed": { en: "Upload failed.", de: "Hochladen fehlgeschlagen." },
  "upload.itemsSuffix": { en: "items", de: "Artikel" },
  "upload.uncertainTag": { en: "uncertain", de: "unsicher" },
  "upload.reviewButton": { en: "Review items →", de: "Artikel prüfen →" },

  // Onboarding baseline upload (OnboardingUploadStep.tsx) — deliberately
  // separate copy from the generic "upload" namespace above: this is the
  // chat's continuation, not the standalone re-upload page.
  "onboardingUpload.progressProfile": { en: "Profile", de: "Profil" },
  "onboardingUpload.progressReceipt": { en: "Baseline receipt", de: "Baseline-Kassenbon" },
  "onboardingUpload.badge": { en: "ALMOST THERE", de: "GLEICH GESCHAFFT" },
  "onboardingUpload.titleLine1": { en: "One last thing —", de: "Eine letzte Sache —" },
  "onboardingUpload.titleLine2": { en: "your baseline.", de: "deine Baseline." },
  "onboardingUpload.greetingWithName": {
    en: "Great, {name}! Upload your first receipt so I can see what's already in your kitchen — this becomes the baseline everything else compares against.",
    de: "Perfekt, {name}! Lade deinen ersten Kassenbon hoch, damit ich sehe, was bei dir schon in der Küche steht — das wird die Baseline, mit der alles Weitere verglichen wird.",
  },
  "onboardingUpload.greeting": {
    en: "Upload your first receipt so I can see what's already in your kitchen — this becomes the baseline everything else compares against.",
    de: "Lade deinen ersten Kassenbon hoch, damit ich sehe, was bei dir schon in der Küche steht — das wird die Baseline, mit der alles Weitere verglichen wird.",
  },
  "onboardingUpload.skip": { en: "I'll do this later", de: "Das mache ich später" },

  // Review step
  "review.step": { en: "Step 4 · Review", de: "Schritt 4 · Prüfen" },
  "review.title": { en: "Check what we found.", de: "Prüfe, was wir gefunden haben." },
  "review.body": {
    en: "Nothing is hidden — uncertain or unmatched items are shown too. Fix anything that looks wrong before it feeds your nutrition snapshot.",
    de: "Nichts wird versteckt — auch unsichere oder nicht zugeordnete Artikel werden angezeigt. Korrigiere alles, was falsch aussieht, bevor es in deine Nährwert-Übersicht einfließt.",
  },
  "review.loading": { en: "Loading…", de: "Wird geladen…" },
  "review.loadFailed": { en: "Failed to load receipt.", de: "Kassenbon konnte nicht geladen werden." },
  "review.noItems": { en: "No items were parsed from this receipt.", de: "Aus diesem Kassenbon wurden keine Artikel erkannt." },
  "review.edit": { en: "Edit", de: "Bearbeiten" },
  "review.save": { en: "Save", de: "Speichern" },
  "review.saving": { en: "Saving…", de: "Wird gespeichert…" },
  "review.cancel": { en: "Cancel", de: "Abbrechen" },
  "review.continueButton": { en: "Continue to profile →", de: "Weiter zum Profil →" },
  "review.namePlaceholder": { en: "Name", de: "Name" },
  "review.quantityPlaceholder": { en: "Quantity", de: "Menge" },
  "review.unitPlaceholder": { en: "Unit", de: "Einheit" },
  "review.categoryPlaceholder": { en: "Category", de: "Kategorie" },
  "review.confidence.unknown": { en: "unknown", de: "unbekannt" },
  "review.confidence.confident": { en: "confident", de: "sicher" },
  "review.confidence.uncertain": { en: "uncertain", de: "unsicher" },
  "review.confidence.low": { en: "low confidence", de: "geringe Sicherheit" },
  "review.rawPrefix": { en: "raw:", de: "roh:" },
  "review.uncategorized": { en: "uncategorized", de: "unkategorisiert" },

  // Results step
  "results.step": { en: "Step 5 · Results", de: "Schritt 5 · Ergebnisse" },
  "results.title": { en: "Your basket, aggregated.", de: "Dein Einkaufskorb, zusammengefasst." },
  "results.body": {
    en: "Combines every receipt you've uploaded so far — not just the last one.",
    de: "Fasst alle bisher hochgeladenen Kassenbons zusammen — nicht nur den letzten.",
  },
  "results.refresh": { en: "Refresh", de: "Aktualisieren" },
  "results.loading": { en: "Loading…", de: "Wird geladen…" },
  "results.loadFailed": { en: "Failed to load results.", de: "Ergebnisse konnten nicht geladen werden." },
  "results.basedOnPrefix": { en: "Based on", de: "Basierend auf" },
  "results.receiptsSuffix": { en: "receipt(s),", de: "Kassenbon(s)," },
  "results.itemsSuffix": { en: "items", de: "Artikel" },
  "results.matchedVia": { en: "matched via OpenFoodFacts ·", de: "über OpenFoodFacts zugeordnet ·" },
  "results.estimatedByCategory": { en: "estimated by category", de: "nach Kategorie geschätzt" },
  "results.noData": { en: "no data", de: "keine Daten" },
  "results.nutritionSnapshot": { en: "Nutrition snapshot", de: "Nährwert-Übersicht" },
  "results.topGaps": { en: "Top gaps", de: "Wichtigste Lücken" },
  "results.candidatesChecked": { en: "candidates checked", de: "Kandidaten geprüft" },
  "results.candidatesConsidered": { en: "candidates considered", de: "Kandidaten berücksichtigt" },
  "results.whyNothing": { en: "Why nothing was suggested", de: "Warum nichts vorgeschlagen wurde" },
  "results.allowed": { en: "allowed", de: "erlaubt" },
  "results.blocked": { en: "blocked:", de: "blockiert:" },
  "results.recipesWith": { en: "Recipes with", de: "Rezepte mit" },
  "results.feedbackQuestion": { en: "Would you consider buying this next time?", de: "Würdest du das nächstes Mal kaufen?" },
  "results.feedbackThanks": { en: "Thanks — that's saved.", de: "Danke — das wurde gespeichert." },
  "results.feedbackError": { en: "Could not save your feedback.", de: "Feedback konnte nicht gespeichert werden." },
  "results.feedbackCommentPlaceholder": { en: "Optional comment", de: "Optionaler Kommentar" },
  "results.feedback.yes": { en: "yes", de: "ja" },
  "results.feedback.maybe": { en: "maybe", de: "vielleicht" },
  "results.feedback.no": { en: "no", de: "nein" },
  "results.progressTitle": { en: "Progress since last receipt", de: "Fortschritt seit dem letzten Kassenbon" },
  "results.confidence.high": { en: "high", de: "hoch" },
  "results.confidence.medium": { en: "medium", de: "mittel" },
  "results.confidence.low": { en: "low", de: "gering" },
  "results.trend.improving": { en: "improving", de: "verbessert sich" },
  "results.trend.stable": { en: "stable", de: "stabil" },
  "results.trend.declining": { en: "declining", de: "verschlechtert sich" },
  "results.trend.insufficient_data": { en: "insufficient data", de: "zu wenig Daten" },
  "results.improved": { en: "improved", de: "verbessert" },
  "results.worse": { en: "worse", de: "verschlechtert" },
  "results.absoluteGaps": { en: "Nutrient gaps (Bedarf vs. Ist)", de: "Nährstoff-Lücken (Bedarf vs. Ist)" },
  "results.nutrientStatus": { en: "Nutrient status", de: "Nährstoff-Status" },
  "results.showDetails": { en: "Show details", de: "Details anzeigen" },
  "results.hideDetails": { en: "Hide details", de: "Details ausblenden" },
  "results.absoluteGapsNoneFound": {
    en: "Nothing flagged — your confirmed eating looks on track across every tracked nutrient.",
    de: "Nichts auffällig — dein bestätigter Konsum sieht bei allen erfassten Nährstoffen gut aus.",
  },
  "results.absoluteGapsNoData": {
    en: "Not enough data yet — confirm what you've eaten in your pantry to see this.",
    de: "Noch nicht genug Daten — bestätige im Lager, was du gegessen hast, um das zu sehen.",
  },
  "results.pantryRecipes": { en: "Recipes from your pantry", de: "Rezepte aus deinem Lager" },
  "results.healthScore": { en: "Health score", de: "Health Score" },
  "results.healthScore.great": { en: "great", de: "sehr gut" },
  "results.healthScore.good": { en: "good", de: "gut" },
  "results.healthScore.needs_improvement": { en: "needs improvement", de: "ausbaufähig" },
  "results.healthScore.poor": { en: "poor", de: "schwach" },
  "results.easySwaps": { en: "Easy changes to add", de: "Einfache Ergänzungen" },
  "results.targets": { en: "targets", de: "wirkt gegen" },
  "results.cost.low": { en: "low cost", de: "günstig" },
  "results.cost.medium": { en: "medium cost", de: "mittel" },
  "results.cost.high": { en: "higher cost", de: "teurer" },
  "results.conflicts": { en: "Worth double-checking", de: "Lohnt sich nachzufragen" },
  "results.conflictsIntro": {
    en: "These purchases don't match what you told us about your diet — did something change, or was this for someone else?",
    de: "Diese Einkäufe passen nicht zu deinen Angaben zur Ernährung — hat sich etwas geändert, oder war das für jemand anderen?",
  },
  "results.conflictChanged": { en: "My diet changed — update profile", de: "Hat sich geändert — Profil bearbeiten" },
  "results.conflictSomeoneElse": { en: "Was for someone else", de: "War für jemand anderen" },
  "results.absoluteProgress": { en: "This week vs. last week", de: "Diese Woche vs. letzte Woche" },
  "results.pantryMatch": { en: "Use what you have", de: "Nutze, was du hast" },
  "results.pantryMatchUrgent": { en: "Use soon", de: "Bald verbrauchen" },
  "results.coach": { en: "Your Nutri-Coach", de: "Dein Nutri-Coach" },

  // Pantry (Lager-Bestand) page
  "pantry.step": { en: "Pantry", de: "Lager" },
  "pantry.title": { en: "What's still around.", de: "Was noch da ist." },
  "pantry.body": {
    en: "Every receipt adds to this list. Confirm what you actually ate or threw out, so estimates reflect real consumption, not just what you bought.",
    de: "Jeder Kassenbon ergänzt diese Liste. Bestätige, was du tatsächlich gegessen oder weggeworfen hast, damit Schätzungen den echten Verzehr abbilden — nicht nur den Einkauf.",
  },
  "pantry.loading": { en: "Loading…", de: "Wird geladen…" },
  "pantry.loadFailed": { en: "Could not load your pantry.", de: "Lager konnte nicht geladen werden." },
  "pantry.empty": {
    en: "Nothing here yet — upload a receipt to start building your pantry.",
    de: "Noch nichts hier — lade einen Kassenbon hoch, um dein Lager zu füllen.",
  },
  "pantry.consumed": { en: "Ate it", de: "Gegessen" },
  "pantry.remove": { en: "No longer have it", de: "Nicht mehr vorhanden" },
  "pantry.quantityLabel": { en: "Quantity", de: "Menge" },
  "pantry.previousDay": { en: "Previous day", de: "Vorheriger Tag" },
  "pantry.nextDay": { en: "Next day", de: "Nächster Tag" },
  "pantry.today": { en: "Today", de: "Heute" },
  "pantry.dayLogTitle": { en: "Logged for this day", de: "Für diesen Tag erfasst" },
  "pantry.manualLogTitle": { en: "Add something else", de: "Sonstiges hinzufügen" },
  "pantry.manualLogBody": {
    en: "Food that never came from a receipt — a restaurant meal, a snack bought elsewhere.",
    de: "Lebensmittel, die nie auf einem Kassenbon standen — z. B. ein Restaurant-Essen oder ein Snack unterwegs.",
  },
  "pantry.manualLogNamePlaceholder": { en: "What did you eat?", de: "Was hast du gegessen?" },
  "pantry.manualLogAdd": { en: "Add", de: "Hinzufügen" },
  "pantry.matchedGood": { en: "matched to real nutrition data", de: "echten Nährwerten zugeordnet" },
  "pantry.matchedRough": { en: "only a rough category estimate", de: "nur eine grobe Kategorie-Schätzung" },
  "pantry.whyItMatters": {
    en: "Confirming daily keeps your nutrient estimates accurate — the coach can only see what you've told it.",
    de: "Tägliches Bestätigen hält deine Nährstoff-Schätzungen genau — der Coach sieht nur, was du ihm sagst.",
  },
  "pantry.reminderPrefix": { en: "You haven't confirmed anything in", de: "Du hast seit" },
  "pantry.reminderSuffix": {
    en: "days — your estimates are getting less accurate.",
    de: "Tagen nichts bestätigt — deine Schätzungen werden ungenauer.",
  },
};

export function t(key: string, lang: Lang): string {
  return STRINGS[key]?.[lang] ?? key;
}

interface LanguageContextValue {
  language: Lang;
  setLanguage: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Lang>(
    () => (localStorage.getItem(LANGUAGE_KEY) as Lang | null) ?? "en",
  );

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  const value: LanguageContextValue = {
    language,
    setLanguage: setLanguageState,
    t: (key: string) => t(key, language),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
