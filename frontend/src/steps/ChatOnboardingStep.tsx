import { useEffect, useRef, useState } from "react";
import { Card, PrimaryButton, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage, type Lang } from "@/lib/i18n";
import { createProfile, ApiError } from "@/lib/api";
import type { ProfileCreate } from "@/types/api";

// Chat-style onboarding. Language is no longer asked here — it's chosen
// once on the landing page and stays changeable from the header (see
// AppShell.tsx) — so this chat starts directly with "what should we
// call you?".

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
  // Short grouping tag shown above the question ("why am I being asked
  // this") — purely presentational, doesn't affect toProfileCreate.
  category?: Bi;
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
    key: "name",
    prompt: bi("What should we call you?", "Wie sollen wir dich nennen?"),
    shortLabel: bi("Name", "Name"),
    category: bi("Personal", "Persönlich"),
    kind: "text",
    placeholder: bi("Your name", "Dein Name"),
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
    category: bi("Activity", "Aktivität"),
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
  },
  {
    key: "age_range",
    prompt: bi("How old are you?", "Wie alt bist du?"),
    shortLabel: bi("Age", "Alter"),
    category: bi("Personalization", "Personalisierung"),
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
    category: bi("Personalization", "Personalisierung"),
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
    category: bi("Personalization", "Personalisierung"),
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
    category: bi("Personalization", "Personalisierung"),
    placeholder: bi("e.g. 170", "z.B. 170"),
    kind: "number",
    optional: true,
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
    category: bi("Health signals", "Gesundheit"),
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
    category: bi("Diet", "Ernährung"),
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
const CREATING_LABEL = bi(
  "All set — creating your profile, then let's upload your first receipt as a baseline…",
  "Alles klar — dein Profil wird erstellt, danach lädst du deinen ersten Kassenbon als Baseline hoch…",
);
const CREATE_PROFILE_FAILED = bi("Could not create profile.", "Profil konnte nicht erstellt werden.");
const BADGE_LABEL = bi("PERSONALIZING YOUR PLAN", "DEIN PLAN WIRD PERSONALISIERT");
const TITLE_LINE_1 = bi("Let's get to know", "Lass uns dich");
const TITLE_LINE_2 = bi("you.", "kennenlernen.");
const QUESTION_COUNTER = bi("Question", "Frage");
const QUESTION_COUNTER_OF = bi("of", "von");
const WHY_TOGGLE_LABEL = bi("Why do we ask this? Learn more here.", "Warum fragen wir das? Erfahre mehr hier.");
const EDIT_LABEL = bi("Edit", "Bearbeiten");
const SAVE_LABEL = bi("Save", "Speichern");
const CANCEL_LABEL = bi("Cancel", "Abbrechen");

type Answers = {
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

function toProfileCreate(a: Answers, language: Lang): ProfileCreate {
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
    language,
  };
}

// Small persona avatar leading the chat — sage green matches the
// landing/account-picker pages' accent (LandingStep.tsx), so the
// "coach" feels like the same character across the pre-onboarding flow.
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

// Lets the user correct an already-answered question from the history
// list without restarting the chat — every profile field is independent
// (no question's options depend on an earlier answer), so changing one
// in place is safe and doesn't require re-asking anything after it.
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
    step.kind === "multi" ? [...(value as string[])] : [],
  );
  const [textDraft, setTextDraft] = useState<string>(
    step.kind === "text" || step.kind === "number" ? String(value ?? "") : "",
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
        type={step.kind === "number" ? "number" : "text"}
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
  onProfileCreated: (profileId: string, name: string | null) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [stepIndex, setStepIndex] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const { language } = useLanguage();
  const historyRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Bug fix: this used to be `stepIndex >= STEPS.length`, but stepIndex
  // never actually reaches STEPS.length — the last question calls
  // submit() directly instead of advancing (see goNext below), so this
  // was permanently false and the "creating your profile…" bubble was
  // dead code. A failed submit left the last question's buttons merely
  // disabled-then-re-enabled with no visible "try again" moment. Tying
  // `done` to `saving` instead means: while the request is in flight,
  // show only the "creating…" bubble (no stale, about-to-be-wrong
  // buttons); on failure, the question and its options reappear fully
  // enabled, right next to the error message — an obvious, working retry.
  const done = saving;
  const current = STEPS[stepIndex];
  // Language is set once on the landing page (or the header toggle, see
  // AppShell.tsx) — no per-question fallback needed anymore.
  const lang: Lang = language;

  // UX fix: the current question + its answer options must always be
  // fully visible without the user having to scroll. Scrolling the whole
  // *page* to top (an earlier attempt) backfired — it revealed the
  // header/badge again and left the chat itself below the fold, so the
  // user had to scroll down after every single answer. Instead, scroll
  // the progress+chat block itself into view (block: "start"), which
  // brings the current question right to the top of the viewport —
  // scrolling past the (static, already-seen) header if needed, never
  // away from the chat. The past-answers history keeps its own small
  // internal scroll, pinned to its latest entry.
  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [stepIndex, done]);

  function setAnswer<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function advance() {
    setDraftText("");
    setShowWhy(false);
    setEditingKey(null);
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
      const profile = await createProfile(toProfileCreate(finalAnswers, language));
      onProfileCreated(profile.profile_id, profile.name ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : CREATE_PROFILE_FAILED[language]);
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
  const progressPct = Math.round((Math.min(stepIndex, STEPS.length) / STEPS.length) * 100);

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
                {QUESTION_COUNTER[lang]} {stepIndex + 1} {QUESTION_COUNTER_OF[lang]} {STEPS.length}
              </span>
              {current.category ? <span>{current.category[lang]}</span> : null}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}

      <Card className="space-y-4">
        {/* Past Q&A only — scrolls internally, pinned to its latest
            entry (see the useEffect above), capped small so it can
            never push the current question or its answer options
            below the fold. */}
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

        {/* Current question + disclaimer: never inside a scroll
            container, so it — and its answer options below — are
            always fully visible on one screen. */}
        <div
          className={cn(
            "space-y-1",
            answeredSteps.length > 0 && "border-t border-black/5 pt-4",
          )}
        >
          {!done ? (
            <>
              <ChatBubble from="bot">{current.prompt[lang]}</ChatBubble>
              {/* The instruction/hint stays plainly visible under the
                  question — never hidden behind a toggle. */}
              {current.hint ? <p className="pl-9 text-xs text-ink/40">{current.hint[lang]}</p> : null}
              {/* Only the (longer, legal) disclaimer is the collapsible
                  info field — the "i" button expands the yellow box. */}
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
}
