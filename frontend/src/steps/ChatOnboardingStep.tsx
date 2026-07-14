import { useEffect, useRef, useState } from "react";
import { Card, PrimaryButton, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage, type Lang } from "@/lib/i18n";
import { createProfile, updateProfile, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Profile, ProfileCreate } from "@/types/api";

// Chat-style Level-1 onboarding (E1-S5). Collects the inputs the Ideal
// Profile Engine (E2) needs — sex at birth, date of birth, height, weight,
// exercise frequency, daily movement, meals/snacks — alongside goal, diet,
// allergies and dislikes. Each answer gets a short, reassuring feedback
// reply (R-FEEDBACK). Progress is persisted incrementally so a half-done
// walk-through can be resumed on the next login (E1-S6).

export type Bi = { en: string; de: string };
export const bi = (en: string, de: string): Bi => ({ en, de });

export type StepKind = "choice" | "multi" | "text" | "number" | "date";
export type MultiKey = "allergies" | "symptoms" | "dislikes";

export interface Option {
  value: string;
  label: Bi;
}

export interface StepDef {
  key: string;
  prompt: Bi;
  hint?: Bi;
  shortLabel?: Bi;
  category?: Bi;
  // Reassuring reply shown after the answer (R-FEEDBACK).
  feedback?: Bi;
  disclaimer?: Bi;
  kind: StepKind;
  options?: Option[];
  placeholder?: Bi;
  optional?: boolean;
  // Only ask this step when the predicate holds (e.g. pregnancy for
  // female profiles only). Absent = always shown.
  showIf?: (answers: Record<string, unknown>) => boolean;
}

const SYMPTOM_DISCLAIMER = bi(
  "These symptoms may be related to nutritional gaps in your diet. This is not a medical diagnosis. Please consult a healthcare professional if symptoms persist.",
  "Diese Symptome können mit Nährstofflücken in deiner Ernährung zusammenhängen. Das ist keine medizinische Diagnose. Bitte wende dich an eine Fachperson, falls die Symptome anhalten.",
);

export const STEPS: StepDef[] = [
  {
    key: "name",
    prompt: bi("What should we call you?", "Wie sollen wir dich nennen?"),
    shortLabel: bi("Name", "Name"),
    category: bi("Personal", "Persönlich"),
    kind: "text",
    placeholder: bi("Your name", "Dein Name"),
    feedback: bi("Lovely to meet you! 🌱", "Schön, dich kennenzulernen! 🌱"),
  },
  {
    key: "form_of_address",
    prompt: bi("How would you like me to address you?", "Wie möchtest du angesprochen werden?"),
    shortLabel: bi("Form of address", "Anrede"),
    category: bi("Personal", "Persönlich"),
    kind: "choice",
    options: [
      { value: "informal_du", label: bi("Casually (du)", "Locker (du)") },
      { value: "formal_sie", label: bi("Formally (Sie)", "Förmlich (Sie)") },
      { value: "neutral", label: bi("No preference", "Keine Präferenz") },
    ],
    feedback: bi("Got it — I'll keep that in mind.", "Alles klar — merke ich mir."),
  },
  {
    key: "goal",
    prompt: bi("What is your main health goal?", "Was ist dein wichtigstes Gesundheitsziel?"),
    shortLabel: bi("Goal", "Ziel"),
    category: bi("Goal", "Ziel"),
    hint: bi(
      "This helps us prioritize what matters most for you.",
      "Das hilft uns zu priorisieren, was für dich am wichtigsten ist.",
    ),
    kind: "choice",
    options: [
      { value: "build_muscle", label: bi("🏋️ Build muscle & strength", "🏋️ Muskeln & Kraft aufbauen") },
      { value: "more_energy", label: bi("⚡ More energy & less fatigue", "⚡ Mehr Energie & weniger Müdigkeit") },
      { value: "lose_weight_gradually", label: bi("⚖️ Lose weight gradually", "⚖️ Schrittweise Gewicht verlieren") },
      { value: "eat_balanced", label: bi("🥗 Eat more balanced & healthy", "🥗 Ausgewogener & gesünder essen") },
      { value: "better_focus", label: bi("🧠 Better focus & mental clarity", "🧠 Bessere Konzentration & Klarheit") },
      { value: "better_sleep", label: bi("😴 Better sleep & recovery", "😴 Besserer Schlaf & Erholung") },
    ],
    feedback: bi("Great goal — we'll build everything around it.", "Tolles Ziel — wir richten alles danach aus."),
  },
  {
    key: "dietary_pattern",
    prompt: bi(
      "How would you describe your current eating style?",
      "Wie würdest du deine aktuelle Ernährungsweise beschreiben?",
    ),
    shortLabel: bi("Eating style", "Ernährungsstil"),
    category: bi("Diet", "Ernährung"),
    hint: bi(
      "Choose the one that fits best — you can be more specific later.",
      "Wähle die passendste Option — du kannst später genauer werden.",
    ),
    kind: "choice",
    options: [
      { value: "high_protein", label: bi("🥩 High protein", "🥩 Eiweißreich") },
      { value: "low_carb_keto", label: bi("🥦 Low carb / Keto", "🥦 Low Carb / Keto") },
      { value: "low_fat", label: bi("🫙 Low fat", "🫙 Fettarm") },
      { value: "vegan", label: bi("🌿 Plant-based / Vegan", "🌿 Pflanzenbasiert / Vegan") },
      { value: "vegetarian", label: bi("🥗 Vegetarian", "🥗 Vegetarisch") },
      { value: "omnivore", label: bi("🍽️ No specific diet — I eat everything", "🍽️ Keine bestimmte Ernährungsweise") },
      { value: "gluten_free", label: bi("🌾 Gluten-free", "🌾 Glutenfrei") },
      { value: "lactose_free", label: bi("🥛 Lactose-free", "🥛 Laktosefrei") },
    ],
    feedback: bi("Noted — we'll only ever suggest things that fit this.", "Notiert — wir schlagen nur Passendes vor."),
  },
  {
    key: "sex",
    prompt: bi("What is your sex at birth?", "Was ist dein Geschlecht bei Geburt?"),
    shortLabel: bi("Sex at birth", "Geschlecht bei Geburt"),
    category: bi("Personalization", "Personalisierung"),
    hint: bi(
      "Used to calculate your energy baseline (BMR).",
      "Wird zur Berechnung deines Grundumsatzes (BMR) genutzt.",
    ),
    kind: "choice",
    options: [
      { value: "female", label: bi("Female", "Weiblich") },
      { value: "male", label: bi("Male", "Männlich") },
      { value: "prefer_not_to_say", label: bi("Prefer not to say", "Keine Angabe") },
    ],
    feedback: bi("Thanks — this makes your targets more accurate.", "Danke — das macht deine Ziele genauer."),
  },
  {
    key: "date_of_birth",
    prompt: bi("What's your date of birth?", "Wann bist du geboren?"),
    shortLabel: bi("Date of birth", "Geburtsdatum"),
    category: bi("Personalization", "Personalisierung"),
    hint: bi(
      "Age affects your energy needs and nutrient targets.",
      "Das Alter beeinflusst deinen Energiebedarf und deine Nährstoffziele.",
    ),
    kind: "date",
    feedback: bi("Perfect — your targets will stay right as you age.", "Perfekt — deine Ziele bleiben mit dem Alter aktuell."),
  },
  {
    key: "height_cm",
    prompt: bi("What's your height, in cm?", "Wie groß bist du, in cm?"),
    shortLabel: bi("Height (cm)", "Größe (cm)"),
    category: bi("Personalization", "Personalisierung"),
    placeholder: bi("e.g. 170", "z.B. 170"),
    kind: "number",
    feedback: bi("Thanks!", "Danke!"),
  },
  {
    key: "weight_kg",
    prompt: bi("And your weight, in kg?", "Und dein Gewicht, in kg?"),
    shortLabel: bi("Weight (kg)", "Gewicht (kg)"),
    category: bi("Personalization", "Personalisierung"),
    hint: bi(
      "Together with height and activity, this personalizes your protein target.",
      "Zusammen mit Größe und Aktivität personalisiert das dein Protein-Ziel.",
    ),
    placeholder: bi("e.g. 68", "z.B. 68"),
    kind: "number",
    feedback: bi("No judgement here — just math for better targets. 💚", "Keine Wertung — nur Mathe für bessere Ziele. 💚"),
  },
  {
    key: "exercise_frequency",
    prompt: bi("How often do you exercise in a typical week?", "Wie oft trainierst du in einer typischen Woche?"),
    shortLabel: bi("Exercise frequency", "Trainingshäufigkeit"),
    category: bi("Activity", "Aktivität"),
    kind: "choice",
    options: [
      { value: "none", label: bi("🛋️ Rarely / never", "🛋️ Selten / nie") },
      { value: "one_two", label: bi("🚶 1–2× per week", "🚶 1–2× pro Woche") },
      { value: "three_four", label: bi("🏃 3–4× per week", "🏃 3–4× pro Woche") },
      { value: "five_six", label: bi("💪 5–6× per week", "💪 5–6× pro Woche") },
      { value: "daily_athlete", label: bi("🏅 Daily / athlete", "🏅 Täglich / Leistungssport") },
    ],
    feedback: bi("Great — this sets your energy needs.", "Super — das bestimmt deinen Energiebedarf."),
  },
  {
    key: "daily_movement",
    prompt: bi("How much do you move during a normal day?", "Wie viel bewegst du dich an einem normalen Tag?"),
    shortLabel: bi("Daily movement", "Alltagsbewegung"),
    category: bi("Activity", "Aktivität"),
    hint: bi(
      "Everyday movement outside of workouts (walking, standing, chores).",
      "Alltagsbewegung außerhalb des Trainings (Gehen, Stehen, Hausarbeit).",
    ),
    kind: "choice",
    options: [
      { value: "mostly_sitting", label: bi("🪑 Mostly sitting", "🪑 Überwiegend sitzend") },
      { value: "mixed", label: bi("🔀 A mix of sitting & moving", "🔀 Mix aus Sitzen & Bewegen") },
      { value: "mostly_standing", label: bi("🧍 Mostly on my feet", "🧍 Überwiegend auf den Beinen") },
      { value: "physical_labor", label: bi("🏗️ Physical labor", "🏗️ Körperliche Arbeit") },
    ],
    feedback: bi("Thanks — every bit of movement counts.", "Danke — jede Bewegung zählt."),
  },
  {
    key: "meals_per_day",
    prompt: bi("How many main meals do you eat a day?", "Wie viele Hauptmahlzeiten isst du am Tag?"),
    shortLabel: bi("Meals / day", "Mahlzeiten / Tag"),
    category: bi("Diet", "Ernährung"),
    placeholder: bi("e.g. 3", "z.B. 3"),
    kind: "number",
    feedback: bi("Good to know — helps us read your receipts.", "Gut zu wissen — hilft beim Lesen deiner Bons."),
  },
  {
    key: "snacks_per_day",
    prompt: bi("And how many snacks, roughly?", "Und wie viele Snacks, ungefähr?"),
    shortLabel: bi("Snacks / day", "Snacks / Tag"),
    category: bi("Diet", "Ernährung"),
    placeholder: bi("e.g. 1", "z.B. 1"),
    kind: "number",
    feedback: bi("Snacks are part of the picture too. 🍎", "Snacks gehören auch dazu. 🍎"),
  },
  {
    key: "pregnancy_status",
    prompt: bi("Are you currently pregnant or breastfeeding?", "Bist du aktuell schwanger oder stillst du?"),
    shortLabel: bi("Pregnancy", "Schwangerschaft"),
    category: bi("Personalization", "Personalisierung"),
    hint: bi(
      "This meaningfully changes some nutrient targets (e.g. iron, folate).",
      "Das verändert einige Nährstoffziele deutlich (z.B. Eisen, Folat).",
    ),
    kind: "choice",
    optional: true,
    showIf: (a) => a.sex === "female",
    options: [
      { value: "none", label: bi("No", "Nein") },
      { value: "pregnant", label: bi("Pregnant", "Schwanger") },
      { value: "breastfeeding", label: bi("Breastfeeding", "Stillend") },
    ],
    feedback: bi("Thank you for sharing — we'll adjust accordingly.", "Danke — wir passen es entsprechend an."),
  },
  {
    key: "allergies",
    prompt: bi("Do you avoid any of these foods?", "Vermeidest du eines dieser Lebensmittel?"),
    shortLabel: bi("Foods to avoid", "Zu vermeidende Lebensmittel"),
    category: bi("Safety", "Sicherheit"),
    hint: bi(
      "Select all that apply — we'll never recommend something you can't eat.",
      "Wähle alle zutreffenden aus — wir empfehlen nie etwas, das du nicht essen kannst.",
    ),
    kind: "multi",
    options: [
      { value: "meat", label: bi("🥩 Meat", "🥩 Fleisch") },
      { value: "fish", label: bi("🐟 Fish & seafood", "🐟 Fisch & Meeresfrüchte") },
      { value: "dairy", label: bi("🥛 Dairy", "🥛 Milchprodukte") },
      { value: "eggs", label: bi("🥚 Eggs", "🥚 Eier") },
      { value: "gluten", label: bi("🌾 Gluten", "🌾 Gluten") },
      { value: "nuts", label: bi("🥜 Nuts", "🥜 Nüsse") },
      { value: "none", label: bi("🚫 None of the above", "🚫 Nichts davon") },
    ],
    feedback: bi("Locked in — these are off the table for good.", "Gespeichert — die sind dauerhaft tabu."),
  },
  {
    key: "dislikes",
    prompt: bi("Anything you simply don't like to eat?", "Gibt es etwas, das du einfach nicht magst?"),
    shortLabel: bi("Dislikes", "Abneigungen"),
    category: bi("Diet", "Ernährung"),
    hint: bi(
      "Optional — we'll deprioritize these, but they're not a hard rule like allergies.",
      "Optional — wir stellen diese hinten an, aber sie sind keine feste Regel wie Allergien.",
    ),
    kind: "multi",
    optional: true,
    options: [
      { value: "mushrooms", label: bi("🍄 Mushrooms", "🍄 Pilze") },
      { value: "olives", label: bi("🫒 Olives", "🫒 Oliven") },
      { value: "liver", label: bi("🥩 Liver / offal", "🥩 Leber / Innereien") },
      { value: "seafood", label: bi("🦐 Seafood", "🦐 Meeresfrüchte") },
      { value: "spicy", label: bi("🌶️ Very spicy food", "🌶️ Sehr scharfes Essen") },
      { value: "none", label: bi("🚫 Nothing in particular", "🚫 Nichts Bestimmtes") },
    ],
    feedback: bi("Noted — I'll steer around those.", "Notiert — ich mache einen Bogen darum."),
  },
  {
    key: "symptoms",
    prompt: bi("How do you feel on most days?", "Wie fühlst du dich an den meisten Tagen?"),
    shortLabel: bi("How you feel", "Wie du dich fühlst"),
    category: bi("Health signals", "Gesundheit"),
    hint: bi(
      "Select all that apply — this helps us find the most relevant gaps for you.",
      "Wähle alle zutreffenden aus — das hilft uns, die relevantesten Lücken für dich zu finden.",
    ),
    disclaimer: SYMPTOM_DISCLAIMER,
    kind: "multi",
    optional: true,
    options: [
      { value: "fatigue", label: bi("😴 Often tired or low energy", "😴 Oft müde oder wenig Energie") },
      { value: "brain_fog", label: bi("🧠 Trouble concentrating", "🧠 Konzentrationsprobleme") },
      { value: "mood_swings", label: bi("😤 Mood swings or irritability", "😤 Stimmungsschwankungen") },
      { value: "poor_sleep", label: bi("💤 Poor sleep quality", "💤 Schlechte Schlafqualität") },
      { value: "muscle_weakness", label: bi("💪 Muscle weakness / slow recovery", "💪 Muskelschwäche / langsame Erholung") },
      { value: "often_cold", label: bi("🥶 Often cold, even indoors", "🥶 Oft kalt, sogar drinnen") },
      { value: "hair_nails", label: bi("💇 Hair loss or brittle nails", "💇 Haarausfall oder brüchige Nägel") },
      { value: "heart_palpitations", label: bi("🫀 Heart palpitations occasionally", "🫀 Gelegentliches Herzklopfen") },
      { value: "none", label: bi("😊 I feel great — no issues", "😊 Mir geht's gut — keine Probleme") },
    ],
    feedback: bi("Thanks for sharing — this stays private.", "Danke fürs Teilen — das bleibt privat."),
  },
  {
    key: "digestion",
    prompt: bi("How would you describe your digestion?", "Wie würdest du deine Verdauung beschreiben?"),
    shortLabel: bi("Digestion", "Verdauung"),
    category: bi("Health signals", "Gesundheit"),
    kind: "choice",
    optional: true,
    options: [
      { value: "fine", label: bi("✅ Works fine, no issues", "✅ Funktioniert gut, keine Probleme") },
      { value: "bloated", label: bi("🫧 Often bloated after meals", "🫧 Oft aufgebläht nach dem Essen") },
      { value: "slow", label: bi("🐢 Slow digestion / constipation", "🐢 Langsame Verdauung / Verstopfung") },
      { value: "sensitive", label: bi("⚡ Sensitive stomach", "⚡ Empfindlicher Magen") },
    ],
    feedback: bi("Good to know — fiber can help here.", "Gut zu wissen — Ballaststoffe können helfen."),
  },
  {
    key: "veg_frequency",
    prompt: bi("How often do you eat fruit and vegetables?", "Wie oft isst du Obst und Gemüse?"),
    shortLabel: bi("Fruit & veg frequency", "Obst- & Gemüse-Häufigkeit"),
    category: bi("Diet", "Ernährung"),
    kind: "choice",
    optional: true,
    options: [
      { value: "every_meal", label: bi("🌿 Every meal", "🌿 Bei jeder Mahlzeit") },
      { value: "once_daily", label: bi("🥗 Once a day", "🥗 Einmal täglich") },
      { value: "few_times_week", label: bi("🥕 A few times a week", "🥕 Ein paar Mal pro Woche") },
      { value: "rarely", label: bi("🍟 Rarely", "🍟 Selten") },
    ],
    feedback: bi("Perfect — that's the last question. 🎉", "Perfekt — das war die letzte Frage. 🎉"),
  },
];

const SKIP_LABEL = bi(
  "Skip for now (use a neutral profile with no exclusions)",
  "Für jetzt überspringen (neutrales Profil ohne Ausschlüsse)",
);
const SEND_LABEL = bi("Send", "Senden");
const CONTINUE_LABEL = bi("Continue", "Weiter");
const SKIP_QUESTION_LABEL = bi("Skip this one", "Diese Frage überspringen");
const CREATING_LABEL = bi(
  "All set — saving your profile, then let's upload your first receipt as a baseline…",
  "Alles klar — dein Profil wird gespeichert, danach lädst du deinen ersten Kassenbon hoch…",
);
const CREATE_PROFILE_FAILED = bi("Could not save profile.", "Profil konnte nicht gespeichert werden.");
const BADGE_LABEL = bi("PERSONALIZING YOUR PLAN", "DEIN PLAN WIRD PERSONALISIERT");
const TITLE_LINE_1 = bi("Let's get to know", "Lass uns dich");
const TITLE_LINE_2 = bi("you.", "kennenlernen.");
const QUESTION_COUNTER = bi("Question", "Frage");
const QUESTION_COUNTER_OF = bi("of", "von");
const WHY_TOGGLE_LABEL = bi("Why do we ask this? Learn more here.", "Warum fragen wir das? Erfahre mehr hier.");
const CANCEL_LABEL = bi("Cancel", "Abbrechen");
const SAVE_LABEL = bi("Save", "Speichern");
const EDIT_LABEL = bi("Edit", "Bearbeiten");
const RANGE_ERROR = bi("Please enter a realistic value.", "Bitte einen realistischen Wert eingeben.");

type Answers = {
  name: string;
  form_of_address: string;
  goal: string;
  dietary_pattern: string;
  sex: string;
  date_of_birth: string;
  height_cm: string;
  weight_kg: string;
  exercise_frequency: string;
  daily_movement: string;
  meals_per_day: string;
  snacks_per_day: string;
  pregnancy_status: string;
  allergies: string[];
  dislikes: string[];
  symptoms: string[];
  digestion: string;
  veg_frequency: string;
};

const INITIAL_ANSWERS: Answers = {
  name: "",
  form_of_address: "neutral",
  goal: "eat_balanced",
  dietary_pattern: "omnivore",
  sex: "",
  date_of_birth: "",
  height_cm: "",
  weight_kg: "",
  exercise_frequency: "",
  daily_movement: "",
  meals_per_day: "",
  snacks_per_day: "",
  pregnancy_status: "",
  allergies: [],
  dislikes: [],
  symptoms: [],
  digestion: "",
  veg_frequency: "",
};

// Derive the legacy fields the rest of the app still reads (BR-compatible)
// from the new Level-1 answers, so downstream code (recommender,
// nutrition_personalization) keeps working unchanged.
const _ACTIVITY_FROM_EXERCISE: Record<string, ProfileCreate["activity_level"]> = {
  none: "mostly_sitting",
  one_two: "light_activity",
  three_four: "moderately_active",
  five_six: "very_active",
  daily_athlete: "very_active",
};
const _GENDER_FROM_SEX: Record<string, ProfileCreate["gender"]> = {
  female: "female",
  male: "male",
  prefer_not_to_say: "other",
};

function ageRangeFromDob(dob: string): ProfileCreate["age_range"] {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  if (age < 25) return "under_25";
  if (age <= 35) return "25-35";
  if (age <= 45) return "36-45";
  if (age <= 55) return "46-55";
  return "55+";
}

function toProfileCreate(a: Answers, language: Lang): ProfileCreate {
  const dislikes = a.dislikes.filter((v) => v !== "none");
  return {
    goal: a.goal as ProfileCreate["goal"],
    dietary_pattern: a.dietary_pattern as ProfileCreate["dietary_pattern"],
    // Derived legacy fields (kept for downstream compatibility).
    activity_level: _ACTIVITY_FROM_EXERCISE[a.exercise_frequency] ?? "moderately_active",
    gender: a.sex ? _GENDER_FROM_SEX[a.sex] ?? "other" : null,
    age_range: ageRangeFromDob(a.date_of_birth),
    exclusions: dislikes,
    name: a.name.trim() || null,
    // Level-1 fields (E1).
    form_of_address: (a.form_of_address || null) as ProfileCreate["form_of_address"],
    sex: (a.sex || null) as ProfileCreate["sex"],
    date_of_birth: a.date_of_birth || null,
    height_cm: a.height_cm ? Number(a.height_cm) : null,
    weight_kg: a.weight_kg ? Number(a.weight_kg) : null,
    exercise_frequency: (a.exercise_frequency || null) as ProfileCreate["exercise_frequency"],
    daily_movement: (a.daily_movement || null) as ProfileCreate["daily_movement"],
    pregnancy_status: (a.pregnancy_status || null) as ProfileCreate["pregnancy_status"],
    meals_per_day: a.meals_per_day ? Number(a.meals_per_day) : null,
    snacks_per_day: a.snacks_per_day ? Number(a.snacks_per_day) : null,
    dislikes,
    allergies: a.allergies.filter((v) => v !== "none"),
    symptoms: a.symptoms.filter((v) => v !== "none"),
    digestion: (a.digestion || null) as ProfileCreate["digestion"],
    veg_frequency: (a.veg_frequency || null) as ProfileCreate["veg_frequency"],
    language,
  };
}

// Map a stored (possibly partial) profile back to chat answers, so a
// half-finished onboarding can be resumed where it left off (E1-S6).
function profileToAnswers(p: Profile): Answers {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    ...INITIAL_ANSWERS,
    name: s(p.name),
    form_of_address: s(p.form_of_address) || "neutral",
    goal: s(p.goal) || INITIAL_ANSWERS.goal,
    dietary_pattern: s(p.dietary_pattern) || INITIAL_ANSWERS.dietary_pattern,
    sex: s(p.sex),
    date_of_birth: s(p.date_of_birth),
    height_cm: s(p.height_cm),
    weight_kg: s(p.weight_kg),
    exercise_frequency: s(p.exercise_frequency),
    daily_movement: s(p.daily_movement),
    meals_per_day: s(p.meals_per_day),
    snacks_per_day: s(p.snacks_per_day),
    pregnancy_status: s(p.pregnancy_status),
    allergies: p.allergies ?? [],
    dislikes: p.dislikes ?? [],
    symptoms: p.symptoms ?? [],
    digestion: s(p.digestion),
    veg_frequency: s(p.veg_frequency),
  };
}

// Out-of-range guard (E1-S5). Only applies to the numeric questions —
// free-text answers like name (and the date field) are never range-checked.
const _NUMERIC_KEYS = new Set(["height_cm", "weight_kg", "meals_per_day", "snacks_per_day"]);

function rangeError(key: string, value: string): Bi | null {
  if (!value || !_NUMERIC_KEYS.has(key)) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return RANGE_ERROR;
  if (key === "height_cm" && (n < 100 || n > 250)) return RANGE_ERROR;
  if (key === "weight_kg" && (n < 30 || n > 300)) return RANGE_ERROR;
  if ((key === "meals_per_day" || key === "snacks_per_day") && (n < 0 || n > 12)) return RANGE_ERROR;
  return null;
}

function BotAvatar() {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm ring-2 ring-white"
    >
      🌱
    </span>
  );
}

function ChatBubble({ from, children }: { from: "bot" | "user"; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-end gap-2", from === "user" ? "justify-end" : "justify-start")}>
      {from === "bot" ? <BotAvatar /> : null}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          from === "user" ? "bg-ink text-canvas" : "bg-zinc-100 text-ink",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function InlineAnswerEditor({
  step,
  value,
  lang,
  onSave,
  onCancel,
}: {
  step: StepDef;
  value: unknown;
  lang: Lang;
  onSave: (value: string | string[]) => void;
  onCancel: () => void;
}) {
  const [multiDraft, setMultiDraft] = useState<string[]>(
    step.kind === "multi" ? [...((value as string[]) ?? [])] : [],
  );
  const [textDraft, setTextDraft] = useState<string>(
    step.kind === "multi" ? "" : String(value ?? ""),
  );

  if (step.kind === "choice") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {step.options!.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSave(opt.value)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-medium tracking-tight ring-1 transition-colors",
              opt.value === value
                ? "bg-ink text-canvas ring-ink"
                : "bg-zinc-50 text-ink/60 ring-black/5 hover:text-ink",
            )}
          >
            {opt.label[lang]}
          </button>
        ))}
        <button type="button" onClick={onCancel} className="text-xs text-ink/40 hover:text-ink">
          {CANCEL_LABEL[lang]}
        </button>
      </div>
    );
  }

  if (step.kind === "multi") {
    function toggle(v: string) {
      setMultiDraft((prev) => {
        if (v === "none") return prev.includes("none") ? [] : ["none"];
        if (prev.includes(v)) return prev.filter((x) => x !== v);
        return [...prev.filter((x) => x !== "none"), v];
      });
    }
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {step.options!.map((opt) => {
            const selected = multiDraft.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-medium tracking-tight ring-1 transition-colors",
                  selected ? "bg-ink text-canvas ring-ink" : "bg-zinc-50 text-ink/60 ring-black/5 hover:text-ink",
                )}
              >
                {opt.label[lang]}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onSave(multiDraft)}
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium tracking-tight text-canvas"
          >
            {SAVE_LABEL[lang]}
          </button>
          <button type="button" onClick={onCancel} className="text-xs text-ink/40 hover:text-ink">
            {CANCEL_LABEL[lang]}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className={inputCls}
        type={step.kind === "number" ? "number" : step.kind === "date" ? "date" : "text"}
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSave(textDraft.trim())}
        autoFocus
      />
      <button
        type="button"
        onClick={() => onSave(textDraft.trim())}
        className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-xs font-medium tracking-tight text-canvas"
      >
        {SAVE_LABEL[lang]}
      </button>
      <button type="button" onClick={onCancel} className="shrink-0 text-xs text-ink/40 hover:text-ink">
        {CANCEL_LABEL[lang]}
      </button>
    </div>
  );
}

export function answerLabel(step: StepDef, answers: Record<string, unknown>, lang: Lang): string {
  const value = answers[step.key];
  if (step.kind === "choice") {
    return step.options?.find((o) => o.value === value)?.label[lang] ?? String(value ?? "—");
  }
  if (step.kind === "multi") {
    const list = (value as string[]) ?? [];
    if (list.length === 0) return "—";
    return list.map((v) => step.options?.find((o) => o.value === v)?.label[lang] ?? v).join(", ");
  }
  return (value as string) || "—";
}

export function ChatOnboardingStep({
  resumeProfile,
  resumeProfileId,
  onProfileCreated,
  onSkip,
}: {
  resumeProfile?: Profile | null;
  resumeProfileId?: string | null;
  onProfileCreated: (profileId: string, name: string | null) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>(
    resumeProfile ? profileToAnswers(resumeProfile) : INITIAL_ANSWERS,
  );
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<Bi | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const { language } = useLanguage();
  const lang: Lang = language;
  const historyRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const savedIdRef = useRef<string | null>(resumeProfileId ?? null);

  // Steps visible for the current answers (pregnancy only for female).
  const visibleSteps = STEPS.filter((s) => !s.showIf || s.showIf(answers));

  // Resume at the first unanswered visible step (E1-S6).
  const firstUnanswered = () => {
    const idx = visibleSteps.findIndex((s) => {
      const v = answers[s.key as keyof Answers];
      if (Array.isArray(v)) return false; // multis are never "blocking"
      return !v && !s.optional;
    });
    return idx === -1 ? 0 : idx;
  };
  const [stepIndex, setStepIndex] = useState<number>(resumeProfile ? firstUnanswered() : 0);

  const done = saving;
  const current = visibleSteps[Math.min(stepIndex, visibleSteps.length - 1)];

  // Prefill DOB from the age-gate value captured at sign-up (reconciles
  // E1-S3): the onboarding DOB is authoritative, but we don't ask twice.
  useEffect(() => {
    let cancelled = false;
    if (answers.date_of_birth) return;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const dob = (data.user?.user_metadata as { date_of_birth?: string } | undefined)?.date_of_birth;
      if (dob) setAnswers((prev) => (prev.date_of_birth ? prev : { ...prev, date_of_birth: dob }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [stepIndex, done]);

  function setAnswer<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  // Best-effort incremental persistence so progress survives a reload /
  // relogin (E1-S6). Failures are swallowed here — the authoritative save
  // is the final submit().
  async function persistProgress(next: Answers) {
    try {
      const payload = { ...toProfileCreate(next, language), profile_complete: false };
      if (savedIdRef.current) {
        await updateProfile(savedIdRef.current, payload);
      } else {
        const created = await createProfile(payload as ProfileCreate);
        savedIdRef.current = created.profile_id;
      }
    } catch {
      // ignore — retried implicitly on the next answer, and on submit
    }
  }

  function advance(next: Answers) {
    setDraftText("");
    setShowWhy(false);
    setInputError(null);
    setEditingKey(null);
    void persistProgress(next);
    setStepIndex((i) => i + 1);
  }

  function saveEdit(key: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setEditingKey(null);
  }

  async function submit(finalAnswers: Answers) {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...toProfileCreate(finalAnswers, language), profile_complete: true };
      if (savedIdRef.current) {
        const p = await updateProfile(savedIdRef.current, payload);
        onProfileCreated(savedIdRef.current, p.name ?? finalAnswers.name ?? null);
      } else {
        const p = await createProfile(payload as ProfileCreate);
        onProfileCreated(p.profile_id, p.name ?? null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : CREATE_PROFILE_FAILED[language]);
      setSaving(false);
    }
  }

  function goNext(nextAnswers: Answers) {
    // Recompute visibility with the just-set answer (e.g. sex) so a newly
    // hidden/shown pregnancy step is accounted for.
    const nextVisible = STEPS.filter((s) => !s.showIf || s.showIf(nextAnswers));
    if (stepIndex >= nextVisible.length - 1) {
      submit(nextAnswers);
    } else {
      advance(nextAnswers);
    }
  }

  function handleChoice(value: string) {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);
    goNext(next);
  }

  function handleTextSubmit() {
    const trimmed = draftText.trim();
    if (!trimmed && !current.optional) return;
    const err = rangeError(current.key, trimmed);
    if (err) {
      setInputError(err);
      return;
    }
    const next = { ...answers, [current.key]: trimmed };
    setAnswers(next);
    goNext(next);
  }

  function toggleMultiOption(key: MultiKey, value: string) {
    const list = answers[key];
    let nextList: string[];
    if (value === "none") nextList = list.includes("none") ? [] : ["none"];
    else if (list.includes(value)) nextList = list.filter((v) => v !== value);
    else nextList = [...list.filter((v) => v !== "none"), value];
    setAnswer(key, nextList);
  }

  function handleMultiContinue() {
    goNext(answers);
  }

  const answeredSteps = visibleSteps.slice(0, stepIndex);
  const progressPct = Math.round(
    (Math.min(stepIndex, visibleSteps.length) / visibleSteps.length) * 100,
  );

  return (
    <section className="space-y-5 px-6 pb-16">
      <header className="space-y-1.5 text-center">
        <span className="inline-block rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink/50">
          {BADGE_LABEL[lang]}
        </span>
        <h1 className="mx-auto max-w-xl text-balance text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
          {TITLE_LINE_1[lang]} <span className="text-accent">{TITLE_LINE_2[lang]}</span>
        </h1>
      </header>

      <div ref={chatRef} className="space-y-5 scroll-mt-6">
        {!done ? (
          <div className="mx-auto max-w-md space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-ink/40">
              <span>
                {QUESTION_COUNTER[lang]} {stepIndex + 1} {QUESTION_COUNTER_OF[lang]} {visibleSteps.length}
              </span>
              {current.category ? <span>{current.category[lang]}</span> : null}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        ) : null}

        <Card className="space-y-4">
          {answeredSteps.length > 0 ? (
            <div ref={historyRef} className="max-h-[22vh] space-y-3 overflow-y-auto pr-1">
              {answeredSteps.map((step) => (
                <div key={step.key} className="space-y-1">
                  <ChatBubble from="bot">{step.prompt[language]}</ChatBubble>
                  {editingKey === step.key ? (
                    <div className="pl-9">
                      <InlineAnswerEditor
                        step={step}
                        value={answers[step.key as keyof Answers]}
                        lang={language}
                        onSave={(value) => saveEdit(step.key, value)}
                        onCancel={() => setEditingKey(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <ChatBubble from="user">{answerLabel(step, answers, language)}</ChatBubble>
                      {/* Per-answer reassuring feedback (R-FEEDBACK). */}
                      {step.feedback ? (
                        <ChatBubble from="bot">{step.feedback[language]}</ChatBubble>
                      ) : null}
                      {!done ? (
                        <button
                          type="button"
                          onClick={() => setEditingKey(step.key)}
                          className="block w-full text-right text-[11px] font-medium text-ink/35 hover:text-ink"
                        >
                          {EDIT_LABEL[lang]}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className={cn("space-y-1", answeredSteps.length > 0 && "border-t border-black/5 pt-4")}>
            {!done ? (
              <>
                <ChatBubble from="bot">{current.prompt[lang]}</ChatBubble>
                {current.hint ? <p className="pl-9 text-xs text-ink/40">{current.hint[lang]}</p> : null}
                {current.disclaimer ? (
                  <div className="pl-9">
                    <button
                      type="button"
                      onClick={() => setShowWhy((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink/40 hover:text-ink"
                    >
                      <span className="flex size-3.5 items-center justify-center rounded-full ring-1 ring-ink/30 text-[9px]">
                        i
                      </span>
                      {WHY_TOGGLE_LABEL[lang]}
                    </button>
                    {showWhy ? (
                      <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">
                        {current.disclaimer[lang]}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <ChatBubble from="bot">{CREATING_LABEL[lang]}</ChatBubble>
            )}
          </div>

          {!done ? (
            <div className="space-y-3 border-t border-black/5 pt-4">
              {current.kind === "choice" ? (
                <div className="flex flex-wrap gap-2">
                  {current.options!.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={saving}
                      onClick={() => handleChoice(opt.value)}
                      className="rounded-xl bg-zinc-50 px-4 py-2.5 text-sm font-medium tracking-tight text-ink/70 ring-1 ring-black/5 transition-colors hover:bg-ink hover:text-canvas disabled:opacity-40"
                    >
                      {opt.label[lang]}
                    </button>
                  ))}
                </div>
              ) : null}

              {current.kind === "multi" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {current.options!.map((opt) => {
                      const selected = (answers[current.key as MultiKey] as string[]).includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleMultiOption(current.key as MultiKey, opt.value)}
                          className={cn(
                            "rounded-xl px-4 py-2.5 text-sm font-medium tracking-tight ring-1 transition-colors",
                            selected ? "bg-ink text-canvas ring-ink" : "bg-zinc-50 text-ink/60 ring-black/5 hover:text-ink",
                          )}
                        >
                          {opt.label[lang]}
                        </button>
                      );
                    })}
                  </div>
                  <PrimaryButton type="button" disabled={saving} onClick={handleMultiContinue}>
                    {CONTINUE_LABEL[lang]}
                  </PrimaryButton>
                </div>
              ) : null}

              {current.kind === "text" || current.kind === "number" || current.kind === "date" ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      type={current.kind === "number" ? "number" : current.kind === "date" ? "date" : "text"}
                      placeholder={current.placeholder?.[lang]}
                      value={draftText}
                      onChange={(e) => {
                        setDraftText(e.target.value);
                        setInputError(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleTextSubmit}
                      className="shrink-0 rounded-xl bg-ink px-5 py-3 text-sm font-medium tracking-tight text-canvas disabled:opacity-40"
                    >
                      {SEND_LABEL[lang]}
                    </button>
                  </div>
                  {inputError ? <p className="text-xs text-red-600">{inputError[lang]}</p> : null}
                </div>
              ) : null}

              {current.optional ? (
                <button
                  type="button"
                  onClick={() =>
                    current.kind === "multi" || current.kind === "choice"
                      ? goNext(answers)
                      : handleSkipText()
                  }
                  className="block text-xs font-medium tracking-tight text-ink/40 hover:text-ink"
                >
                  {SKIP_QUESTION_LABEL[lang]}
                </button>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      ) : null}

      <button
        type="button"
        onClick={onSkip}
        className="block w-full text-center text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
      >
        {SKIP_LABEL[lang]}
      </button>
    </section>
  );

  function handleSkipText() {
    setDraftText("");
    setInputError(null);
    goNext(answers);
  }
}
