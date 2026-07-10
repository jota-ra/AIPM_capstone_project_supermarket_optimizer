import { useState } from "react";
import { Card, PrimaryButton, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage, type Lang } from "@/lib/i18n";
import { createProfile, ApiError } from "@/lib/api";
import type { ProfileCreate } from "@/types/api";

// Chat-style onboarding: 7 questions total (language + name up front,
// then the 5 profile questions). The very first answer (language)
// switches the rest of this chat — and the whole app — immediately,
// via LanguageProvider (see lib/i18n.tsx).

export type Bi = { en: string; de: string };
export const bi = (en: string, de: string): Bi => ({ en, de });

export type StepKind = "choice" | "multi" | "text" | "number";
export type MultiKey = "allergies" | "symptoms";

export interface Option {
  value: string;
  label: Bi;
}

export interface StepDef {
  key: string;
  prompt: Bi;
  hint?: Bi;
  // Compact label for the My Profile grid form (ProfileSummary.tsx) —
  // the chat's `prompt` is a full conversational sentence, too long for
  // a form field label. Falls back to `prompt` if not set.
  shortLabel?: Bi;
  // Mandatory disclaimer (Q6): must appear wherever this app links
  // self-reported symptoms to a recommendation.
  disclaimer?: Bi;
  kind: StepKind;
  options?: Option[];
  placeholder?: Bi;
  optional?: boolean;
}

const SYMPTOM_DISCLAIMER = bi(
  "These symptoms may be related to nutritional gaps in your diet. This is not a medical diagnosis. Please consult a healthcare professional if symptoms persist.",
  "Diese Symptome können mit Nährstofflücken in deiner Ernährung zusammenhängen. Das ist keine medizinische Diagnose. Bitte wende dich an eine Fachperson, falls die Symptome anhalten.",
);

export const STEPS: StepDef[] = [
  {
    key: "language",
    prompt: bi("First — which language do you prefer?", "Zuerst — welche Sprache bevorzugst du?"),
    shortLabel: bi("Language", "Sprache"),
    kind: "choice",
    options: [
      { value: "en", label: bi("English", "English") },
      { value: "de", label: bi("Deutsch", "Deutsch") },
    ],
  },
  {
    key: "name",
    prompt: bi("What should we call you?", "Wie sollen wir dich nennen?"),
    shortLabel: bi("Name", "Name"),
    kind: "text",
    placeholder: bi("Your name", "Dein Name"),
  },
  {
    key: "goal",
    prompt: bi("What is your main health goal?", "Was ist dein wichtigstes Gesundheitsziel?"),
    shortLabel: bi("Goal", "Ziel"),
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
  },
  {
    key: "dietary_pattern",
    prompt: bi(
      "How would you describe your current eating style?",
      "Wie würdest du deine aktuelle Ernährungsweise beschreiben?",
    ),
    shortLabel: bi("Eating style", "Ernährungsstil"),
    hint: bi(
      "Choose the one that fits best — you can be more specific later.",
      "Wähle die passendste Option — du kannst später genauer werden.",
    ),
    kind: "choice",
    options: [
      { value: "high_protein", label: bi("🥩 High protein (lots of meat, eggs, dairy)", "🥩 Eiweißreich (viel Fleisch, Eier, Milchprodukte)") },
      { value: "low_carb_keto", label: bi("🥦 Low carb / Keto", "🥦 Low Carb / Keto") },
      { value: "low_fat", label: bi("🫙 Low fat", "🫙 Fettarm") },
      { value: "vegan", label: bi("🌿 Plant-based / Vegan", "🌿 Pflanzenbasiert / Vegan") },
      { value: "vegetarian", label: bi("🥗 Vegetarian", "🥗 Vegetarisch") },
      { value: "omnivore", label: bi("🍽️ No specific diet — I eat everything", "🍽️ Keine bestimmte Ernährungsweise — ich esse alles") },
      { value: "gluten_free", label: bi("🌾 Gluten-free", "🌾 Glutenfrei") },
      { value: "lactose_free", label: bi("🥛 Lactose-free", "🥛 Laktosefrei") },
    ],
  },
  {
    key: "activity_level",
    prompt: bi("How active are you on a typical week?", "Wie aktiv bist du in einer typischen Woche?"),
    shortLabel: bi("Activity level", "Aktivitätslevel"),
    kind: "choice",
    options: [
      { value: "mostly_sitting", label: bi("🛋️ Mostly sitting (office, home)", "🛋️ Überwiegend sitzend (Büro, zu Hause)") },
      { value: "light_activity", label: bi("🚶 Light activity (walks, occasional gym)", "🚶 Leichte Aktivität (Spaziergänge, gelegentlich Fitness)") },
      { value: "moderately_active", label: bi("🏃 Moderately active (3-4x sport per week)", "🏃 Mäßig aktiv (3-4x Sport pro Woche)") },
      { value: "very_active", label: bi("💪 Very active (daily training / physical job)", "💪 Sehr aktiv (täglich Training / körperliche Arbeit)") },
    ],
  },
  {
    key: "allergies",
    prompt: bi("Do you avoid any of these foods?", "Vermeidest du eines dieser Lebensmittel?"),
    shortLabel: bi("Foods to avoid", "Zu vermeidende Lebensmittel"),
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
  },
  {
    key: "age_range",
    prompt: bi("How old are you?", "Wie alt bist du?"),
    shortLabel: bi("Age", "Alter"),
    hint: bi(
      "Age affects how your body processes nutrients.",
      "Das Alter beeinflusst, wie dein Körper Nährstoffe verarbeitet.",
    ),
    kind: "choice",
    optional: true,
    options: [
      { value: "under_25", label: bi("Under 25", "Unter 25") },
      { value: "25-35", label: bi("25–35", "25–35") },
      { value: "36-45", label: bi("36–45", "36–45") },
      { value: "46-55", label: bi("46–55", "46–55") },
      { value: "55+", label: bi("55+", "55+") },
      { value: "undisclosed", label: bi("Prefer not to say", "Keine Angabe") },
    ],
  },
  {
    key: "gender",
    prompt: bi("How do you describe your gender?", "Wie beschreibst du dein Geschlecht?"),
    shortLabel: bi("Gender", "Geschlecht"),
    hint: bi(
      "Used only to calculate your personalized nutrition targets.",
      "Wird nur genutzt, um deine persönlichen Nährstoffziele zu berechnen.",
    ),
    kind: "choice",
    optional: true,
    options: [
      { value: "female", label: bi("Female", "Weiblich") },
      { value: "male", label: bi("Male", "Männlich") },
      { value: "other", label: bi("Other", "Divers") },
    ],
  },
  {
    key: "weight_kg",
    prompt: bi("What's your weight, in kg?", "Wie viel wiegst du, in kg?"),
    shortLabel: bi("Weight (kg)", "Gewicht (kg)"),
    hint: bi(
      "Together with height and activity, this personalizes your protein target.",
      "Zusammen mit Größe und Aktivität personalisiert das dein Protein-Ziel.",
    ),
    placeholder: bi("e.g. 68", "z.B. 68"),
    kind: "number",
    optional: true,
  },
  {
    key: "height_cm",
    prompt: bi("And your height, in cm?", "Und deine Größe, in cm?"),
    shortLabel: bi("Height (cm)", "Größe (cm)"),
    placeholder: bi("e.g. 170", "z.B. 170"),
    kind: "number",
    optional: true,
  },
  {
    key: "symptoms",
    prompt: bi("How do you feel on most days?", "Wie fühlst du dich an den meisten Tagen?"),
    shortLabel: bi("How you feel", "Wie du dich fühlst"),
    hint: bi(
      "Select all that apply — this helps us find the most relevant gaps for you.",
      "Wähle alle zutreffenden aus — das hilft uns, die relevantesten Lücken für dich zu finden.",
    ),
    disclaimer: SYMPTOM_DISCLAIMER,
    kind: "multi",
    optional: true,
    options: [
      { value: "fatigue", label: bi("😴 Often tired or low energy", "😴 Oft müde oder wenig Energie") },
      { value: "brain_fog", label: bi("🧠 Trouble concentrating or brain fog", "🧠 Konzentrationsprobleme oder Denknebel") },
      { value: "mood_swings", label: bi("😤 Mood swings or irritability", "😤 Stimmungsschwankungen oder Reizbarkeit") },
      { value: "poor_sleep", label: bi("💤 Poor sleep quality", "💤 Schlechte Schlafqualität") },
      { value: "muscle_weakness", label: bi("💪 Muscle weakness or slow recovery", "💪 Muskelschwäche oder langsame Erholung") },
      { value: "often_cold", label: bi("🥶 Often cold, even indoors", "🥶 Oft kalt, sogar drinnen") },
      { value: "hair_nails", label: bi("💇 Hair loss or brittle nails", "💇 Haarausfall oder brüchige Nägel") },
      { value: "heart_palpitations", label: bi("🫀 Heart palpitations occasionally", "🫀 Gelegentliches Herzklopfen") },
      { value: "none", label: bi("😊 I feel great — no issues", "😊 Mir geht's gut — keine Probleme") },
    ],
  },
  {
    key: "digestion",
    prompt: bi("How would you describe your digestion?", "Wie würdest du deine Verdauung beschreiben?"),
    shortLabel: bi("Digestion", "Verdauung"),
    kind: "choice",
    optional: true,
    options: [
      { value: "fine", label: bi("✅ Works fine, no issues", "✅ Funktioniert gut, keine Probleme") },
      { value: "bloated", label: bi("🫧 Often bloated after meals", "🫧 Oft aufgebläht nach dem Essen") },
      { value: "slow", label: bi("🐢 Slow digestion / constipation", "🐢 Langsame Verdauung / Verstopfung") },
      { value: "sensitive", label: bi("⚡ Sensitive stomach / frequent discomfort", "⚡ Empfindlicher Magen / häufiges Unwohlsein") },
    ],
  },
  {
    key: "veg_frequency",
    prompt: bi("How often do you eat fruit and vegetables?", "Wie oft isst du Obst und Gemüse?"),
    shortLabel: bi("Fruit & veg frequency", "Obst- & Gemüse-Häufigkeit"),
    kind: "choice",
    optional: true,
    options: [
      { value: "every_meal", label: bi("🌿 Every meal", "🌿 Bei jeder Mahlzeit") },
      { value: "once_daily", label: bi("🥗 Once a day", "🥗 Einmal täglich") },
      { value: "few_times_week", label: bi("🥕 A few times a week", "🥕 Ein paar Mal pro Woche") },
      { value: "rarely", label: bi("🍟 Rarely", "🍟 Selten") },
    ],
  },
];

const SKIP_LABEL = bi(
  "Skip for now (use a neutral profile with no exclusions)",
  "Für jetzt überspringen (neutrales Profil ohne Ausschlüsse verwenden)",
);
const SEND_LABEL = bi("Send", "Senden");
const CONTINUE_LABEL = bi("Continue", "Weiter");
const SKIP_QUESTION_LABEL = bi("Skip this one", "Diese Frage überspringen");
const CREATING_LABEL = bi("All set — creating your profile…", "Alles klar — dein Profil wird erstellt…");
const SUBTITLE = bi(
  "A short chat instead of a form. This is what keeps recommendations personal — and safe, if you have allergies.",
  "Ein kurzer Chat statt eines Formulars. So bleiben Empfehlungen persönlich — und sicher, falls du Allergien hast.",
);
const TITLE = bi("Let's get to know you.", "Lass uns dich kennenlernen.");
const STEP_LABEL = bi("Onboarding", "Onboarding");

type Answers = {
  language: Lang;
  name: string;
  goal: string;
  dietary_pattern: string;
  activity_level: string;
  allergies: string[];
  age_range: string;
  gender: string;
  weight_kg: string;
  height_cm: string;
  symptoms: string[];
  digestion: string;
  veg_frequency: string;
};

const INITIAL_ANSWERS: Answers = {
  language: "en",
  name: "",
  goal: "eat_balanced",
  dietary_pattern: "omnivore",
  activity_level: "moderately_active",
  allergies: [],
  age_range: "",
  gender: "",
  weight_kg: "",
  height_cm: "",
  symptoms: [],
  digestion: "",
  veg_frequency: "",
};

function toProfileCreate(a: Answers): ProfileCreate {
  return {
    goal: a.goal as ProfileCreate["goal"],
    activity_level: a.activity_level as ProfileCreate["activity_level"],
    dietary_pattern: a.dietary_pattern as ProfileCreate["dietary_pattern"],
    exclusions: [],
    name: a.name.trim() || null,
    allergies: a.allergies.filter((v) => v !== "none"),
    age_range: a.age_range && a.age_range !== "undisclosed" ? (a.age_range as ProfileCreate["age_range"]) : null,
    gender: (a.gender || null) as ProfileCreate["gender"],
    weight_kg: a.weight_kg ? Number(a.weight_kg) : null,
    height_cm: a.height_cm ? Number(a.height_cm) : null,
    symptoms: a.symptoms.filter((v) => v !== "none"),
    digestion: (a.digestion || null) as ProfileCreate["digestion"],
    veg_frequency: (a.veg_frequency || null) as ProfileCreate["veg_frequency"],
    language: a.language,
  };
}

function ChatBubble({ from, children }: { from: "bot" | "user"; children: React.ReactNode }) {
  return (
    <div className={cn("flex", from === "user" ? "justify-end" : "justify-start")}>
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

export function answerLabel(step: StepDef, answers: Record<string, unknown>, lang: Lang): string {
  const value = answers[step.key];
  if (step.kind === "choice") {
    return step.options?.find((o) => o.value === value)?.label[lang] ?? String(value);
  }
  if (step.kind === "multi") {
    const list = value as string[];
    if (list.length === 0) return "—";
    return list
      .map((v) => step.options?.find((o) => o.value === v)?.label[lang] ?? v)
      .join(", ");
  }
  return (value as string) || "—";
}

export function ChatOnboardingStep({
  onProfileCreated,
  onSkip,
}: {
  onProfileCreated: (profileId: string) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [stepIndex, setStepIndex] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { language, setLanguage } = useLanguage();

  const done = stepIndex >= STEPS.length;
  const current = STEPS[stepIndex];
  // Before the language question is answered, fall back to the app's
  // current language (English by default) so the very first prompt
  // still renders in something sensible.
  const lang: Lang = stepIndex === 0 ? language : answers.language;

  function setAnswer<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function advance() {
    setDraftText("");
    setStepIndex((i) => i + 1);
  }

  async function submit(finalAnswers: Answers) {
    setSaving(true);
    setError(null);
    try {
      const profile = await createProfile(toProfileCreate(finalAnswers));
      onProfileCreated(profile.profile_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create profile.");
    } finally {
      setSaving(false);
    }
  }

  function goNext(nextAnswers: Answers) {
    if (stepIndex === STEPS.length - 1) {
      submit(nextAnswers);
    } else {
      advance();
    }
  }

  function handleChoice(value: string) {
    if (current.key === "language") {
      setLanguage(value as Lang);
    }
    const next = { ...answers, [current.key]: value };
    setAnswers(next);
    goNext(next);
  }

  function handleTextSubmit() {
    if (!draftText.trim() && !current.optional) return;
    const next = { ...answers, [current.key]: draftText.trim() };
    setAnswers(next);
    goNext(next);
  }

  function toggleMultiOption(key: MultiKey, value: string) {
    const list = answers[key];
    let nextList: string[];
    if (value === "none") {
      nextList = list.includes("none") ? [] : ["none"];
    } else if (list.includes(value)) {
      nextList = list.filter((v) => v !== value);
    } else {
      nextList = [...list.filter((v) => v !== "none"), value];
    }
    setAnswer(key, nextList);
  }

  function handleMultiContinue() {
    goNext(answers);
  }

  const answeredSteps = STEPS.slice(0, stepIndex);

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{STEP_LABEL[lang]}</p>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">{TITLE[lang]}</h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{SUBTITLE[lang]}</p>
      </header>

      <Card className="space-y-4">
        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {answeredSteps.map((step) => (
            <div key={step.key} className="space-y-2">
              <ChatBubble from="bot">{step.prompt[step.key === "language" ? "en" : answers.language]}</ChatBubble>
              <ChatBubble from="user">{answerLabel(step, answers, answers.language)}</ChatBubble>
            </div>
          ))}
          {!done ? (
            <div className="space-y-1">
              <ChatBubble from="bot">{current.prompt[lang]}</ChatBubble>
              {current.hint ? <p className="pl-1 text-xs text-ink/40">{current.hint[lang]}</p> : null}
              {current.disclaimer ? (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">
                  {current.disclaimer[lang]}
                </p>
              ) : null}
            </div>
          ) : null}
          {done ? <ChatBubble from="bot">{CREATING_LABEL[lang]}</ChatBubble> : null}
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
                    const selected = answers[current.key as MultiKey].includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleMultiOption(current.key as MultiKey, opt.value)}
                        className={cn(
                          "rounded-xl px-4 py-2.5 text-sm font-medium tracking-tight ring-1 transition-colors",
                          selected
                            ? "bg-ink text-canvas ring-ink"
                            : "bg-zinc-50 text-ink/60 ring-black/5 hover:text-ink",
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

            {current.kind === "text" || current.kind === "number" ? (
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  type={current.kind === "number" ? "number" : "text"}
                  placeholder={current.placeholder?.[lang]}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
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
            ) : null}

            {current.optional ? (
              <button
                type="button"
                onClick={() => (current.kind === "multi" ? handleMultiContinue() : handleTextSubmit())}
                className="block text-xs font-medium tracking-tight text-ink/40 hover:text-ink"
              >
                {SKIP_QUESTION_LABEL[lang]}
              </button>
            ) : null}
          </div>
        ) : null}
      </Card>

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
}
