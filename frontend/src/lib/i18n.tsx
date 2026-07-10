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
  // Nav / shell
  "nav.onboarding": { en: "Onboarding", de: "Onboarding" },
  "nav.userProfile": { en: "My Profile", de: "Nutzerprofil" },
  "nav.upload": { en: "Upload", de: "Hochladen" },
  "nav.review": { en: "Review", de: "Prüfen" },
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
