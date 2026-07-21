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
  // Auth (E1 sign-up / login / age gate, AuthScreen.tsx)
  "auth.welcomeBack": { en: "Welcome back.", de: "Willkommen zurück." },
  "auth.createSubtitle": { en: "Create your account.", de: "Erstelle dein Konto." },
  "auth.login": { en: "Log in", de: "Anmelden" },
  "auth.signup": { en: "Sign up", de: "Registrieren" },
  "auth.email": { en: "Email", de: "E-Mail" },
  "auth.password": { en: "Password", de: "Passwort" },
  "auth.dob": { en: "Date of birth", de: "Geburtsdatum" },
  "auth.ageHint": { en: "You must be at least {age}.", de: "Du musst mindestens {age} sein." },
  "auth.pleaseWait": { en: "Please wait…", de: "Bitte warten…" },
  "auth.createAccount": { en: "Create account", de: "Konto erstellen" },
  "auth.or": { en: "or", de: "oder" },
  "auth.google": { en: "Continue with Google", de: "Mit Google fortfahren" },
  "auth.disclaimer": {
    en: "Nährbert provides general nutrition information, not medical advice.",
    de: "Nährbert bietet allgemeine Ernährungsinformationen, keine medizinische Beratung.",
  },
  "auth.errNoDob": { en: "Please enter your date of birth.", de: "Bitte gib dein Geburtsdatum ein." },
  "auth.errUnderage": {
    en: "You must be at least {age} to use Nährbert.",
    de: "Du musst mindestens {age} Jahre alt sein, um Nährbert zu nutzen.",
  },
  "auth.noticeConfirm": {
    en: "Account created — check your email to confirm, then log in.",
    de: "Konto erstellt — bestätige deine E-Mail und melde dich dann an.",
  },
  "auth.errGeneric": { en: "Something went wrong.", de: "Etwas ist schiefgelaufen." },
  "auth.noticeExists": {
    en: "This email already has an account — please log in.",
    de: "Für diese E-Mail existiert bereits ein Konto — bitte melde dich an.",
  },

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
  // Menu restructure: Dashboard + Results merged into one "Overview" home
  // (nav.results relabeled); Upload merged into Pantry ("Lager" stays);
  // the day-log/diary half of the old Pantry page split out into its own
  // "Tagebuch" destination. "Review" and "Upload" are no longer nav
  // pills — Review is still a real, reachable step (right after an
  // upload), just not a permanent menu destination; Upload's UI now
  // lives inside Pantry itself.
  "nav.userProfile": { en: "My Profile", de: "Nutzerprofil" },
  "nav.pantry": { en: "My Pantry", de: "Vorrat" },
  "nav.results": { en: "Insights", de: "Analyse" },
  "nav.diary": { en: "My Day", de: "Tag" },
  "nav.notifications": { en: "Notifications", de: "Mitteilungen" },
  "footer.tagline": {
    en: "NutriWise · estimated from your shopping habits, not actual intake",
    de: "NutriWise · geschätzt aus deinem Einkaufsverhalten, nicht dem tatsächlichen Verzehr",
  },
  "common.loading": { en: "Loading…", de: "Wird geladen…" },
  "footer.deleteData": { en: "Delete my account", de: "Konto löschen" },
  "footer.deleteConfirm": {
    en: "Permanently delete your account and ALL your data — receipts, pantry, profile and health answers? You'll be signed out. This cannot be undone.",
    de: "Dein Konto und ALLE deine Daten — Kassenbons, Vorrat, Profil und Gesundheitsangaben — endgültig löschen? Du wirst abgemeldet. Das kann nicht rückgängig gemacht werden.",
  },
  "footer.deleteFailed": { en: "Could not delete your account.", de: "Konto konnte nicht gelöscht werden." },
  "review.uploadFirst": { en: "Upload a receipt first.", de: "Lade zuerst einen Kassenbon hoch." },
  "review.goToPantry": { en: "Go to pantry", de: "Zum Lager" },
  "footer.privacy": { en: "Privacy policy", de: "Datenschutz" },
  "footer.imprint": { en: "Imprint", de: "Impressum" },
  "footer.help": { en: "Help & FAQ", de: "Hilfe & FAQ" },
  "footer.placeholderNotice": {
    en: "Not built for this demo yet.",
    de: "Für diese Demo noch nicht gebaut.",
  },

  // Notifications (NotificationsStep.tsx) — built from real signals
  // already computed elsewhere (pantry reminder, coach message, weekly
  // trend, latest receipt status), no separate backend endpoint.
  "notifications.title": { en: "Notifications", de: "Mitteilungen" },
  "notifications.body": {
    en: "Reminders and insights from your coach, all in one place.",
    de: "Erinnerungen und Erkenntnisse deines Coaches, an einem Ort.",
  },
  "notifications.markAllRead": { en: "Mark all as read", de: "Alle als gelesen markieren" },
  "notifications.empty": { en: "You're all caught up.", de: "Du bist auf dem neuesten Stand." },
  "notifications.loading": { en: "Loading…", de: "Wird geladen…" },
  "notifications.loadFailed": { en: "Could not load your notifications.", de: "Mitteilungen konnten nicht geladen werden." },
  "notifications.reminderTitle": {
    en: "You haven't confirmed your pantry in a while.",
    de: "Du hast dein Lager länger nicht bestätigt.",
  },
  "notifications.reminderDetail": {
    en: "{days} days since your last confirmation — estimates are getting less accurate.",
    de: "{days} Tage seit deiner letzten Bestätigung — Schätzungen werden ungenauer.",
  },
  "notifications.insightTitle": { en: "New insight from your coach", de: "Neue Erkenntnis von deinem Coach" },
  "notifications.progressTitle": { en: "This week's trend", de: "Trend diese Woche" },
  "notifications.receiptTitle": { en: "Your latest receipt", de: "Dein letzter Kassenbon" },
  "notifications.receiptProcessed": { en: "Analyzed and added to your pantry.", de: "Analysiert und ins Lager übernommen." },
  "notifications.receiptUploaded": { en: "Uploaded, analysis in progress.", de: "Hochgeladen, Analyse läuft." },

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
    en: 'You can permanently delete your receipt and profile at any time via "Delete or reset my data" in the footer.',
    de: 'Du kannst deinen Kassenbon und dein Profil jederzeit über "Daten löschen oder zurücksetzen" im Footer dauerhaft löschen.',
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
  "profile.userId": { en: "User ID", de: "Nutzer-ID" },
  "profile.logout": { en: "Log out", de: "Abmelden" },

  // E12 — data & privacy (GDPR: export / consent / delete)
  "privacy.title": { en: "Your data & privacy", de: "Deine Daten & Privatsphäre" },
  "privacy.body": {
    en: "You're in control of your data. Export it, withdraw health-data consent, or delete your account entirely.",
    de: "Du hast die Kontrolle über deine Daten. Exportiere sie, widerrufe die Einwilligung zu Gesundheitsdaten oder lösche dein Konto vollständig.",
  },
  "privacy.consentTitle": { en: "Health-data consent", de: "Einwilligung Gesundheitsdaten" },
  "privacy.consentActive": {
    en: "Granted — your symptom answers personalize recommendations.",
    de: "Erteilt — deine Symptom-Angaben personalisieren die Empfehlungen.",
  },
  "privacy.consentInactive": {
    en: "Not active — no health data is being processed.",
    de: "Nicht aktiv — es werden keine Gesundheitsdaten verarbeitet.",
  },
  "privacy.revoke": { en: "Revoke consent", de: "Einwilligung widerrufen" },
  "privacy.revoking": { en: "Revoking…", de: "Wird widerrufen…" },
  "privacy.revokeFailed": { en: "Could not revoke consent.", de: "Einwilligung konnte nicht widerrufen werden." },
  "privacy.exportTitle": { en: "Export my data", de: "Meine Daten exportieren" },
  "privacy.exportBody": {
    en: "Download everything we hold (profile, receipts, targets) as a JSON file.",
    de: "Lade alles herunter, was wir speichern (Profil, Kassenbons, Ziele), als JSON-Datei.",
  },
  "privacy.exportButton": { en: "Download (JSON)", de: "Herunterladen (JSON)" },
  "privacy.exporting": { en: "Preparing…", de: "Wird vorbereitet…" },
  "privacy.exportFailed": { en: "Could not export your data.", de: "Daten konnten nicht exportiert werden." },
  "privacy.deleteTitle": { en: "Delete my account", de: "Konto löschen" },
  "privacy.deleteBody": {
    en: "Permanently erase your account and all personal data. This cannot be undone.",
    de: "Lösche dein Konto und alle personenbezogenen Daten endgültig. Das kann nicht rückgängig gemacht werden.",
  },
  "privacy.deleteButton": { en: "Delete account", de: "Konto löschen" },

  // E7 analysis (ideal vs status-quo)
  "analysis.title": { en: "Your nutrition score", de: "Dein Ernährungs-Score" },
  "analysis.needProfile": {
    en: "Complete your profile (sex, date of birth, height, weight) to unlock your personalized score.",
    de: "Vervollständige dein Profil (Geschlecht, Geburtsdatum, Größe, Gewicht), um deinen persönlichen Score freizuschalten.",
  },
  "analysis.onTarget": { en: "On target — no notable gaps.", de: "Im Zielbereich — keine nennenswerten Lücken." },
  "analysis.microsGated": {
    en: "Score is based on calories & macros. Micronutrients are shown but not yet scored (pending dietitian sign-off).",
    de: "Der Score basiert auf Kalorien & Makros. Mikronährstoffe werden angezeigt, aber noch nicht bewertet (vorbehaltlich diätologischer Freigabe).",
  },
  "analysis.macros": { en: "Calories & macros", de: "Kalorien & Makros" },
  "analysis.micros": { en: "Micronutrients (not scored yet)", de: "Mikronährstoffe (noch nicht bewertet)" },
  "analysis.grouping": { en: "Your items", de: "Deine Artikel" },
  "analysis.band.high": { en: "High confidence", de: "Hohe Sicherheit" },
  "analysis.band.medium": { en: "Medium confidence", de: "Mittlere Sicherheit" },
  "analysis.band.low": { en: "Low confidence", de: "Geringe Sicherheit" },
  "analysis.tier.healthy": { en: "Healthy", de: "Gesund" },
  "analysis.tier.ok": { en: "OK", de: "OK" },
  "analysis.tier.unhealthy": { en: "Unhealthy", de: "Ungesund" },
  "analysis.tier.grey": { en: "Not enough data", de: "Zu wenig Daten" },

  // E8 Next-Cart
  "nextcart.title": { en: "Your next cart", de: "Dein nächster Einkauf" },
  "nextcart.primary": { en: "Top pick", de: "Top-Empfehlung" },
  "nextcart.alternatives": { en: "Alternatives", de: "Alternativen" },
  "nextcart.reduce": { en: "Consider reducing", de: "Weniger davon" },
  "nextcart.noGaps": { en: "Your basket looks balanced — nothing to add right now.", de: "Dein Korb wirkt ausgewogen — momentan nichts zu ergänzen." },
  "nextcart.noSuitable": { en: "No suitable recommendation — every candidate conflicts with your profile.", de: "Keine passende Empfehlung — alle Kandidaten widersprechen deinem Profil." },
  "nextcart.notMedical": {
    en: "Not medical advice. For persistent symptoms, please consult a healthcare professional.",
    de: "Keine medizinische Beratung. Bei anhaltenden Beschwerden wende dich bitte an eine Fachkraft.",
  },

  // E9 Level-2 functional questionnaire + consent
  "level2.title": { en: "How you feel (optional)", de: "Wie du dich fühlst (optional)" },
  "level2.inviteTitle": { en: "Make recommendations smarter?", de: "Empfehlungen schlauer machen?" },
  "level2.inviteBody": {
    en: "Answer a few optional questions about how you feel to personalize your recommendations. You can skip this anytime.",
    de: "Beantworte ein paar optionale Fragen dazu, wie du dich fühlst, um deine Empfehlungen zu personalisieren. Jederzeit überspringbar.",
  },
  "level2.inviteCta": { en: "Sure, let's do it", de: "Klar, los" },
  "level2.inviteDismiss": { en: "Not now", de: "Jetzt nicht" },
  "level2.consentBody": {
    en: "These are health-related answers (GDPR Art. 9). We only process them with your explicit consent, and only to re-prioritize nutrients we already track.",
    de: "Das sind gesundheitsbezogene Angaben (DSGVO Art. 9). Wir verarbeiten sie nur mit deiner ausdrücklichen Einwilligung — allein, um bereits erfasste Nährstoffe neu zu priorisieren.",
  },
  "level2.consentBullet1": { en: "Stored with a timestamp and consent version.", de: "Gespeichert mit Zeitstempel und Einwilligungs-Version." },
  "level2.consentBullet2": { en: "You can withdraw consent anytime; the app stays fully usable.", de: "Du kannst die Einwilligung jederzeit widerrufen; die App bleibt voll nutzbar." },
  "level2.consentBullet3": { en: "Never sold, never used to diagnose.", de: "Wird nie verkauft, nie zur Diagnose genutzt." },
  "level2.notMedicalAdvice": {
    en: "This is not medical advice and never diagnoses a cause — persistent symptoms belong with a professional.",
    de: "Dies ist keine medizinische Beratung und diagnostiziert nie eine Ursache — anhaltende Beschwerden gehören zu einer Fachkraft.",
  },
  "level2.grant": { en: "I consent", de: "Ich willige ein" },
  "level2.decline": { en: "No thanks", de: "Nein danke" },
  "level2.submit": { en: "Save answers", de: "Antworten speichern" },
  "level2.skip": { en: "— skip —", de: "— überspringen —" },
  "level2.q.l2_bowel_frequency": { en: "Bowel movements per week", de: "Stuhlgang pro Woche" },
  "level2.q.l2_bloating": { en: "Bloating", de: "Blähungen" },
  "level2.q.l2_hunger": { en: "Hunger through the day", de: "Hunger über den Tag" },
  "level2.q.l2_energy": { en: "Afternoon energy", de: "Energie am Nachmittag" },
  "level2.q.l2_sleep": { en: "Sleep quality", de: "Schlafqualität" },
  "level2.q.l2_hydration": { en: "Daily hydration", de: "Tägliche Flüssigkeit" },
  "level2.q.l2_alcohol": { en: "Alcohol", de: "Alkohol" },
  "level2.q.l2_muscle_soreness": { en: "Muscle soreness (if active)", de: "Muskelkater (falls aktiv)" },
  "level2.opt.normal": { en: "Normal", de: "Normal" },
  "level2.opt.less_than_3_per_week": { en: "Less than 3×/week", de: "Weniger als 3×/Woche" },
  "level2.opt.none": { en: "None", de: "Keine" },
  "level2.opt.sometimes": { en: "Sometimes", de: "Manchmal" },
  "level2.opt.often_daily": { en: "Often / daily", de: "Oft / täglich" },
  "level2.opt.most_of_day": { en: "Most of the day", de: "Fast den ganzen Tag" },
  "level2.opt.fine": { en: "Fine", de: "Gut" },
  "level2.opt.afternoon_crash": { en: "Afternoon crash", de: "Nachmittagstief" },
  "level2.opt.poor": { en: "Poor", de: "Schlecht" },
  "level2.opt.enough": { en: "Enough", de: "Ausreichend" },
  "level2.opt.low": { en: "Low", de: "Wenig" },
  "level2.opt.occasional": { en: "Occasional", de: "Gelegentlich" },
  "level2.opt.weekly_plus": { en: "Weekly or more", de: "Wöchentlich+" },
  "level2.opt.active_sore": { en: "Yes, and I train", de: "Ja, und ich trainiere" },
  "household.daysToShop": { en: "Days until your next shop", de: "Tage bis zum nächsten Einkauf" },
  "household.homeCooked": { en: "How often do you cook at home?", de: "Wie oft kochst du zu Hause?" },
  "household.hc.rarely": { en: "Rarely", de: "Selten" },
  "household.hc.sometimes": { en: "Sometimes", de: "Manchmal" },
  "household.hc.often": { en: "Often", de: "Oft" },
  "household.hc.daily": { en: "Daily", de: "Täglich" },

  // Household & consumption attribution (E6)
  "household.title": { en: "Household & eating", de: "Haushalt & Verzehr" },
  "household.body": {
    en: "Helps estimate how much of the groceries are actually yours, and how much of your eating the receipts capture.",
    de: "Hilft zu schätzen, wie viel der Einkäufe wirklich deine sind und wie viel deines Essens die Belege erfassen.",
  },
  "household.shared": { en: "Groceries shared with others?", de: "Einkäufe mit anderen geteilt?" },
  "household.sharedYes": { en: "Yes", de: "Ja" },
  "household.sharedNo": { en: "No, just me", de: "Nein, nur ich" },
  "household.size": { en: "People in household (incl. you)", de: "Personen im Haushalt (inkl. dir)" },
  "household.mealsOutside": { en: "How often do you eat out?", de: "Wie oft isst du auswärts?" },
  "household.receiptsComplete": { en: "How much of your shopping do these receipts cover?", de: "Wie viel deines Einkaufs decken diese Belege ab?" },
  "household.mo.never": { en: "Never", de: "Nie" },
  "household.mo.rarely": { en: "Rarely", de: "Selten" },
  "household.mo.sometimes": { en: "Sometimes", de: "Manchmal" },
  "household.mo.often": { en: "Often", de: "Oft" },
  "household.mo.daily": { en: "Daily", de: "Täglich" },
  "household.rc.all": { en: "All of it", de: "Alles" },
  "household.rc.most": { en: "Most", de: "Das meiste" },
  "household.rc.some": { en: "Some", de: "Einen Teil" },
  "household.rc.few": { en: "Only a little", de: "Nur wenig" },

  // Ideal Profile Engine (E2) — daily targets card
  "targets.title": { en: "Your daily targets", de: "Deine Tagesziele" },
  "targets.body": {
    en: "Personalized from your body and activity. Recomputed whenever you change your profile.",
    de: "Personalisiert aus Körperdaten und Aktivität. Wird bei jeder Profiländerung neu berechnet.",
  },
  "targets.calories": { en: "Calories", de: "Kalorien" },
  "targets.protein": { en: "Protein", de: "Protein" },
  "targets.fat": { en: "Fat", de: "Fett" },
  "targets.carbs": { en: "Carbs", de: "Kohlenhydrate" },
  "targets.fiber": { en: "Fiber", de: "Ballaststoffe" },
  "targets.kcal": { en: "kcal", de: "kcal" },
  "targets.energyTitle": { en: "How your calories break down", de: "So setzen sich deine Kalorien zusammen" },
  "targets.bmr": { en: "BMR", de: "Grundumsatz" },
  "targets.neat": { en: "Daily movement", de: "Alltagsbewegung" },
  "targets.eat": { en: "Exercise", de: "Sport" },
  "targets.tef": { en: "Digestion", de: "Verdauung" },
  "targets.tdee": { en: "Total (TDEE)", de: "Gesamt (TDEE)" },
  "targets.microsTitle": { en: "Micronutrient targets", de: "Mikronährstoff-Ziele" },
  "targets.microsNote": {
    en: "Starter values from DGE reference intakes — pending dietitian sign-off.",
    de: "Startwerte aus DGE-Referenzwerten — vorbehaltlich diätologischer Freigabe.",
  },
  "targets.constrained": {
    en: "Your protein target alone meets your calorie goal, so fat is at its minimum and carbs are 0.",
    de: "Dein Proteinziel erreicht allein schon dein Kalorienziel — Fett steht am Minimum und Kohlenhydrate bei 0.",
  },
  "targets.empty": {
    en: "Add your sex, date of birth, height and weight below to see your personalized targets.",
    de: "Ergänze unten Geschlecht, Geburtsdatum, Größe und Gewicht, um deine persönlichen Ziele zu sehen.",
  },

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
  "upload.dropHint": { en: "JPG, PNG, WEBP or PDF · several at once", de: "JPG, PNG, WEBP oder PDF · mehrere gleichzeitig" },
  "upload.pasteLabel": { en: "Paste receipt text", de: "Kassenbon-Text einfügen" },
  "upload.analyzing": { en: "Analyzing…", de: "Wird analysiert…" },
  "upload.analyzeButton": { en: "Analyze pasted receipt", de: "Eingefügten Kassenbon analysieren" },
  "upload.pasteInstead": { en: "Paste the receipt text instead →", de: "Stattdessen Text einfügen →" },
  "upload.uploadFailed": { en: "Upload failed.", de: "Hochladen fehlgeschlagen." },
  // E3-S5 typed extraction errors
  "upload.errRateLimited": {
    en: "The scanner is rate-limited right now. Please try again in a little while.",
    de: "Der Scanner ist gerade ausgelastet (Limit erreicht). Bitte versuche es in Kürze erneut.",
  },
  "upload.errUnavailable": {
    en: "The scanning service is temporarily unavailable. Please try again later.",
    de: "Der Scan-Dienst ist vorübergehend nicht erreichbar. Bitte später erneut versuchen.",
  },
  "upload.errInvalid": {
    en: "We couldn't read any grocery items from this file. Try a clearer photo or paste the text.",
    de: "Auf dieser Datei waren keine Artikel lesbar. Versuche ein klareres Foto oder füge den Text ein.",
  },
  "upload.itemsSuffix": { en: "items", de: "Artikel" },
  "upload.uncertainTag": { en: "uncertain", de: "unsicher" },
  "upload.reviewButton": { en: "Review items →", de: "Artikel prüfen →" },
  "upload.progress": { en: "Processing {done} of {total}…", de: "Verarbeite {done} von {total}…" },
  "upload.multiDone": { en: "{ok} of {total} receipts processed", de: "{ok} von {total} Belegen verarbeitet" },

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
  "review.nextReceiptButton": { en: "Next receipt →", de: "Nächster Kassenbon →" },
  "review.pageOf": { en: "Receipt {index} of {total}", de: "Kassenbon {index} von {total}" },
  "review.unknownStore": { en: "Receipt", de: "Kassenbon" },
  "review.receiptImageAlt": { en: "Uploaded receipt", de: "Hochgeladener Kassenbon" },
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
  // E5 — manual search, pick, no-match
  "review.fixMatch": { en: "Wrong product? Search", de: "Falsches Produkt? Suchen" },
  "review.searchPlaceholder": { en: "Search OpenFoodFacts + BLS…", de: "OpenFoodFacts + BLS durchsuchen…" },
  "review.searchButton": { en: "Search", de: "Suchen" },
  "review.searching": { en: "Searching…", de: "Wird gesucht…" },
  "review.noResults": { en: "No nutrition-bearing products found. Try a shorter term.", de: "Keine Produkte mit Nährwerten gefunden. Versuche einen kürzeren Begriff." },
  "review.useThis": { en: "Use this", de: "Übernehmen" },
  "review.noMatch": { en: "No match found", de: "Kein Treffer" },
  "review.noMatchLogged": { en: "Logged — thanks.", de: "Notiert — danke." },
  "review.noMatchFailed": { en: "Could not log this.", de: "Konnte nicht notiert werden." },
  "review.picked": { en: "Saved & learned for next time.", de: "Gespeichert & für nächstes Mal gelernt." },
  "review.pickFailed": { en: "Could not save this match.", de: "Treffer konnte nicht gespeichert werden." },
  "review.close": { en: "Close", de: "Schließen" },

  // Not-food marking (E3-S4 follow-up — Gemini's semantic non-food
  // classification is gone, so this is the manual safety net).
  "review.markNonFood": { en: "Not food", de: "Kein Lebensmittel" },
  "review.markingNonFood": { en: "Marking…", de: "Wird markiert…" },
  "review.markNonFoodFailed": { en: "Could not mark this as non-food.", de: "Konnte nicht als kein Lebensmittel markiert werden." },
  "review.notFoodLabel": { en: "not food", de: "kein Lebensmittel" },
  "review.notFoodBadge": { en: "Not food", de: "Kein Lebensmittel" },

  // Results step — now also the merged "Overview"/home page (formerly
  // DashboardStep.tsx's mockup): greeting, inactivity reminder, and the
  // trend/recipe cards promoted out of the details-only section below.
  "results.step": { en: "Overview", de: "Übersicht" },
  "results.title": { en: "Your basket, aggregated.", de: "Dein Einkaufskorb, zusammengefasst." },
  "results.body": {
    en: "Combines every receipt you've uploaded so far — not just the last one.",
    de: "Fasst alle bisher hochgeladenen Kassenbons zusammen — nicht nur den letzten.",
  },
  "results.refresh": { en: "Refresh", de: "Aktualisieren" },
  // FR-11.3 upload action + FR-11.4 counter on the dashboard hub.
  "results.uploadReceipt": { en: "Upload a receipt", de: "Kassenbon hochladen" },
  "results.receiptsCounter": { en: "receipts", de: "Kassenbons" },
  "results.itemsCounter": { en: "items", de: "Artikel" },
  "results.greetingFallback": { en: "Welcome back", de: "Willkommen zurück" },
  // E1 baseline-upload gate: greyed-out placeholder shown instead of the
  // health score / gaps / next cart until 50 food items are uploaded.
  "results.gapsTitle": { en: "Current profile & gaps", de: "Aktuelles Profil & Lücken" },
  "results.gapsLocked": {
    en: "This unlocks once your baseline receipts are in — for now, here's what's needed.",
    de: "Das schaltet sich frei, sobald deine Baseline-Kassenbons erfasst sind — hier siehst du, was noch fehlt.",
  },
  "results.gapsProgress": { en: "{count} of {target} food items uploaded", de: "{count} von {target} Lebensmitteln hochgeladen" },
  "results.gapsUploadCta": { en: "Upload receipts", de: "Kassenzettel hochladen" },
  "results.reminderText": {
    en: "You haven't confirmed anything in {days} days — your estimates are getting less accurate.",
    de: "Du hast seit {days} Tagen nichts bestätigt — deine Schätzungen werden ungenauer.",
  },
  "results.reminderCta": { en: "Confirm now", de: "Jetzt bestätigen" },
  "results.noDataNotice": {
    en: "No data yet — upload your first receipt to see your Insights.",
    de: "Noch keine Daten — lade deinen ersten Kassenbon hoch, um deine Insights zu sehen.",
  },
  "results.noDataCta": { en: "Upload a receipt", de: "Kassenbon hochladen" },
  "results.noDataPlaceholderCoach": {
    en: "I can't tell you anything yet — I need at least one receipt first.",
    de: "Ich kann dir noch nichts sagen — dafür brauche ich zuerst mindestens einen Kassenbon.",
  },
  "results.noDataPlaceholderScore": {
    en: "Appears once there's enough data.",
    de: "Erscheint, sobald genug Daten vorhanden sind.",
  },
  "results.noDataPlaceholderNextCart": {
    en: "No recommendation possible yet.",
    de: "Noch keine Empfehlung möglich.",
  },
  "results.loading": { en: "Loading…", de: "Wird geladen…" },
  "results.loadFailed": { en: "Failed to load results.", de: "Ergebnisse konnten nicht geladen werden." },
  "results.basedOnPrefix": { en: "Based on", de: "Basierend auf" },
  "results.receiptsSuffix": { en: "receipt(s),", de: "Kassenbon(s)," },
  "results.itemsSuffix": { en: "items", de: "Artikel" },
  "results.matchedVia": { en: "matched via OpenFoodFacts ·", de: "über OpenFoodFacts zugeordnet ·" },
  "results.estimatedByCategory": { en: "estimated by category", de: "nach Kategorie geschätzt" },
  "results.noData": { en: "no data", de: "keine Daten" },
  // Gap status + trend direction words (detail + progress views), E13.
  "status.low": { en: "low", de: "niedrig" },
  "status.high": { en: "high", de: "hoch" },
  "status.ok": { en: "ok", de: "ok" },
  "status.info": { en: "info", de: "Info" },
  "results.perDay": { en: "per day", de: "pro Tag" },
  "delta.up": { en: "up", de: "höher" },
  "delta.down": { en: "down", de: "niedriger" },
  "delta.flat": { en: "flat", de: "gleich" },
  "delta.unknown": { en: "n/a", de: "k. A." },
  "results.nutritionSnapshot": { en: "Nutrition snapshot", de: "Nährwert-Übersicht" },
  "results.topGaps": { en: "Top gaps", de: "Wichtigste Lücken" },
  "results.candidatesChecked": { en: "candidates checked", de: "Kandidaten geprüft" },
  "results.candidatesConsidered": { en: "candidates considered", de: "Kandidaten berücksichtigt" },
  "results.nextCart": { en: "Next Cart", de: "Nächster Einkauf" },
  "results.feedbackLabel": { en: "Feedback", de: "Feedback" },
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
  "results.logInDiary": { en: "Log in Diary →", de: "Im Tagebuch eintragen →" },
  "results.viewInsights": { en: "View Insights →", de: "Insights ansehen →" },
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
  // Pantry ("Lager") — menu restructure: this is now inventory + adding
  // new receipts merged into one page. Confirming consumption day-by-day
  // moved out into its own "Tagebuch" (diary.*, below).
  "pantry.step": { en: "Pantry", de: "Lager" },
  "pantry.title": { en: "What's still around.", de: "Was noch da ist." },
  "pantry.body": {
    en: "Every receipt adds to this list. Upload a new one below, or correct/remove what's no longer accurate.",
    de: "Jeder Kassenbon ergänzt diese Liste. Lade unten einen neuen hoch oder korrigiere/entferne, was nicht mehr stimmt.",
  },
  "pantry.uploadSectionTitle": { en: "Add a new receipt", de: "Neuen Kassenbon hinzufügen" },
  "pantry.loading": { en: "Loading…", de: "Wird geladen…" },
  "pantry.loadFailed": { en: "Could not load your pantry.", de: "Lager konnte nicht geladen werden." },
  "pantry.empty": {
    en: "Nothing here yet — upload a receipt to start building your pantry.",
    de: "Noch nichts hier — lade einen Kassenbon hoch, um dein Lager zu füllen.",
  },
  "pantry.emptyUploadCta": { en: "Upload your first receipt", de: "Ersten Kassenbon hochladen" },
  "pantry.consumed": { en: "Ate it", de: "Gegessen" },
  "pantry.remove": { en: "No longer have it", de: "Nicht mehr vorhanden" },
  "pantry.quantityLabel": { en: "Quantity", de: "Menge" },
  "pantry.matchedGood": { en: "matched to real nutrition data", de: "echten Nährwerten zugeordnet" },
  "pantry.matchedRough": { en: "only a rough category estimate", de: "nur eine grobe Kategorie-Schätzung" },
  "pantry.expiresIn": { en: "expires in {days}d", de: "läuft in {days}T ab" },
  "pantry.expiresToday": { en: "expires today", de: "läuft heute ab" },
  "pantry.expiredAgo": { en: "expired {days}d ago", de: "seit {days}T abgelaufen" },
  "pantry.category.dairy": { en: "Dairy", de: "Milchprodukte" },
  "pantry.category.grain": { en: "Grains & bread", de: "Getreide & Brot" },
  "pantry.category.vegetable": { en: "Vegetables", de: "Gemüse" },
  "pantry.category.fruit": { en: "Fruit", de: "Obst" },
  "pantry.category.protein": { en: "Protein", de: "Protein" },
  "pantry.category.snack": { en: "Snacks", de: "Snacks" },
  "pantry.category.drink": { en: "Drinks", de: "Getränke" },
  "pantry.category.other": { en: "Other", de: "Sonstiges" },

  // Diary ("Tagebuch") — day-by-day confirmation of what was actually
  // eaten, split out of the old combined Pantry page (DiaryStep.tsx).
  // Eaten / consumption feedback (E10, EatenFeedbackCard.tsx)
  "eaten.titleA": { en: "Before your next shop", de: "Bevor du neu einkaufst" },
  "eaten.titleB": { en: "How did your last shop go?", de: "Wie war dein letzter Einkauf?" },
  "eaten.body": {
    en: "Tell us what happened to your last shop. Anything you threw away is left out of your intake estimate.",
    de: "Sag uns, was aus deinem letzten Einkauf wurde. Was du weggeworfen hast, zählt nicht zu deiner Aufnahme.",
  },
  "eaten.itemEaten": { en: "Ate it", de: "Gegessen" },
  "eaten.itemHave": { en: "Still have", de: "Noch da" },
  "eaten.itemThrown": { en: "Threw away", de: "Weggeworfen" },
  "eaten.submit": { en: "Save", de: "Speichern" },
  "eaten.saving": { en: "Saving…", de: "Wird gespeichert…" },
  "eaten.skip": { en: "Skip", de: "Überspringen" },
  "eaten.error": { en: "Could not save your feedback.", de: "Feedback konnte nicht gespeichert werden." },

  "diary.step": { en: "Diary", de: "Tagebuch" },
  "diary.title": { en: "What did you eat?", de: "Was hast du gegessen?" },
  "diary.body": {
    en: "Pick from what's in your pantry, or add something that never came from a receipt.",
    de: "Wähle aus deinem Lagerbestand, oder ergänze etwas, das nie auf einem Kassenbon stand.",
  },
  "diary.whyItMatters": {
    en: "Confirming daily keeps your nutrient estimates accurate — the coach can only see what you've told it.",
    de: "Tägliches Bestätigen hält deine Nährstoff-Schätzungen genau — der Coach sieht nur, was du ihm sagst.",
  },
  "diary.pickFromPantryTitle": { en: "From your pantry", de: "Aus deinem Lager" },
  "diary.pickFromPantryEmpty": {
    en: "Your pantry is empty — upload a receipt first, or add something manually below.",
    de: "Dein Lager ist leer — lade zuerst einen Kassenbon hoch oder ergänze unten manuell etwas.",
  },
  "diary.previousDay": { en: "Previous day", de: "Vorheriger Tag" },
  "diary.nextDay": { en: "Next day", de: "Nächster Tag" },
  "diary.today": { en: "Today", de: "Heute" },
  "diary.dayLogTitle": { en: "Logged for this day", de: "Für diesen Tag erfasst" },
  "diary.manualLogTitle": { en: "Add something else", de: "Sonstiges hinzufügen" },
  "diary.manualLogBody": {
    en: "Food that never came from a receipt — a restaurant meal, a snack bought elsewhere.",
    de: "Lebensmittel, die nie auf einem Kassenbon standen — z. B. ein Restaurant-Essen oder ein Snack unterwegs.",
  },
  "diary.manualLogNamePlaceholder": { en: "What did you eat?", de: "Was hast du gegessen?" },
  "diary.manualLogAdd": { en: "Add", de: "Hinzufügen" },
};

export function t(key: string, lang: Lang): string {
  return STRINGS[key]?.[lang] ?? key;
}

// E13: display names for the raw nutrient/dimension keys the backend emits
// (bars, gap/dimension labels). The backend spells nutrient nouns inline in
// its localized prose; the frontend localizes the standalone key labels here.
const NUTRIENT_LABELS: Record<string, { en: string; de: string }> = {
  fiber: { en: "Fiber", de: "Ballaststoffe" },
  protein: { en: "Protein", de: "Protein" },
  carbs: { en: "Carbs", de: "Kohlenhydrate" },
  fat: { en: "Fat", de: "Fett" },
  saturated_fat: { en: "Saturated fat", de: "Gesättigte Fettsäuren" },
  sugar: { en: "Sugar", de: "Zucker" },
  calories: { en: "Calories", de: "Kalorien" },
  processed: { en: "Processed", de: "Verarbeitung" },
  iron_mg: { en: "Iron", de: "Eisen" },
  calcium_mg: { en: "Calcium", de: "Calcium" },
  magnesium_mg: { en: "Magnesium", de: "Magnesium" },
  zinc_mg: { en: "Zinc", de: "Zink" },
  vitamin_c_mg: { en: "Vitamin C", de: "Vitamin C" },
  vitamin_d_ug: { en: "Vitamin D", de: "Vitamin D" },
  vitamin_b12_ug: { en: "Vitamin B12", de: "Vitamin B12" },
  folate_ug: { en: "Folate", de: "Folat" },
  potassium_mg: { en: "Potassium", de: "Kalium" },
  iodine_ug: { en: "Iodine", de: "Jod" },
};

export function nutrientLabel(key: string, lang: Lang): string {
  const entry = NUTRIENT_LABELS[key];
  if (entry) return entry[lang];
  // Fallback for an unmapped key: drop the unit suffix, de-underscore, capitalize.
  const base = key.replace(/_(mg|ug|µg|g|kcal)$/i, "").replace(/_/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// R-LANG: the active language is the user's explicit stored choice if any,
// otherwise the device locale when it's German or English, otherwise
// English. `navigator.language` is e.g. "de", "de-DE", "en-GB" — we only
// key off the primary subtag.
function detectDefaultLanguage(): Lang {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === "en" || stored === "de") return stored;
  const locale = (typeof navigator !== "undefined" ? navigator.language : "") || "";
  return locale.toLowerCase().startsWith("de") ? "de" : "en";
}

// For the rare spot outside a component (native `confirm`/`alert`
// dialogs in App.tsx, which fire from a plain event handler, not
// render) that needs the current language without the `useLanguage`
// hook — same resolution the LanguageProvider itself uses below.
export function getStoredLanguage(): Lang {
  return detectDefaultLanguage();
}

interface LanguageContextValue {
  language: Lang;
  setLanguage: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Lang>(detectDefaultLanguage);

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
