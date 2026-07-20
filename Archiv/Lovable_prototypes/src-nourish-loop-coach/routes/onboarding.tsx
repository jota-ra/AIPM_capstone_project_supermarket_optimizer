import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { store } from "@/lib/store";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile · NutriWise" },
      { name: "description", content: "Tell us your goals, allergies and a little about you. Takes about 3 minutes." },
    ],
  }),
  component: Onboarding,
});

const steps = [
  {
    key: "goals",
    label: "Your goals",
    title: "What are you hoping to change?",
    sub: "Pick all that feel true. We'll weight your profile accordingly.",
    options: ["More steady energy", "Better sleep", "Build muscle", "Reduce inflammation", "General wellbeing", "Improve digestion"],
    multi: true,
  },
  {
    key: "diet",
    label: "Preferences",
    title: "Anything off the table?",
    sub: "Allergies and preferences. We'll never recommend recipes that conflict.",
    options: ["No restrictions", "Vegetarian", "Pescatarian", "Vegan", "Gluten-free", "Lactose-free", "Nut allergy"],
    multi: true,
  },
  {
    key: "bio",
    label: "About you",
    title: "A few basics",
    sub: "Used only to calculate your ideal nutrition targets.",
    options: [],
    multi: false,
  },
  {
    key: "activity",
    label: "Activity",
    title: "How active is your week?",
    sub: "Be honest — your future self will thank you.",
    options: ["Mostly sedentary", "Light (1–2 workouts)", "Moderate (3–4 workouts)", "Very active (5+ workouts)"],
    multi: false,
  },
  {
    key: "tastes",
    label: "Taste",
    title: "How much do you enjoy these?",
    sub: "Slide from 'never again' to 'love it'. We'll lean your recipes toward what you actually like.",
    options: [],
    multi: false,
  },
] as const;

const TASTE_ITEMS = [
  { k: "chicken", label: "Chicken" },
  { k: "fish", label: "Fish & seafood" },
  { k: "redMeat", label: "Red meat" },
  { k: "salad", label: "Leafy salads" },
  { k: "vegetables", label: "Cooked vegetables" },
  { k: "legumes", label: "Beans & lentils" },
  { k: "warmVsCold", label: "Warm dishes vs. cold dishes", minLabel: "Cold", maxLabel: "Warm" },
  { k: "spicy", label: "Spicy food" },
] as const;

type TasteKey = (typeof TASTE_ITEMS)[number]["k"];

function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [bio, setBio] = useState({ age: "32", weight: "68", height: "172" });
  const [tastes, setTastes] = useState<Record<TasteKey, number>>(() =>
    TASTE_ITEMS.reduce((acc, t) => ({ ...acc, [t.k]: 3 }), {} as Record<TasteKey, number>),
  );

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const stepPicks = picks[current.key] ?? [];

  function toggle(opt: string) {
    if (current.multi) {
      const has = stepPicks.includes(opt);
      setPicks({
        ...picks,
        [current.key]: has ? stepPicks.filter((o) => o !== opt) : [...stepPicks, opt],
      });
    } else {
      setPicks({ ...picks, [current.key]: [opt] });
    }
  }

  function next() {
    if (isLast) {
      store.set({
        onboarded: true,
        profile: {
          goals: picks.goals ?? [],
          diet: picks.diet ?? [],
          activity: picks.activity ?? [],
          age: bio.age,
          weight: bio.weight,
          height: bio.height,
          tastes,
        },
      });
      router.navigate({ to: "/dashboard" });
    } else {
      setStep(step + 1);
    }
  }

  const bioValid = [["age",18,90],["weight",35,250],["height",120,230]].every(([k,min,max]) => {
    const v = Number(bio[k as "age"|"weight"|"height"]); return !Number.isNaN(v) && v >= (min as number) && v <= (max as number);
  });
  const canAdvance =
    current.key === "bio" ? bioValid : current.key === "tastes" ? true : stepPicks.length > 0;

  return (
    <div className="min-h-screen bg-cream text-forest">
      <header className="sticky top-0 z-10 bg-cream/85 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <button
            onClick={() => (step === 0 ? router.navigate({ to: "/" }) : setStep(step - 1))}
            className="text-sm text-forest/60 hover:text-forest"
          >
            ← Back
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-forest/50">
            Step {step + 1} of {steps.length}
          </span>
        </div>
        <div className="mx-auto mt-3 flex max-w-xl gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-sage" : "bg-forest/10"}`}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 pb-32 pt-8">
        <div className="flex items-center gap-2">
          <span className="chip bg-sage/10 text-sage">{current.label}</span>
          <span className="chip bg-clay text-forest/60">~3 min total</span>
        </div>
        <h1 className="mt-3 text-balance font-serif text-3xl leading-tight md:text-4xl">
          {current.title}
        </h1>
        <p className="mt-2 text-forest/70">{current.sub}</p>

        {step === 0 && (
          <div className="mt-5 rounded-2xl border border-forest/5 bg-card p-4 text-sm text-forest/70">
            <p className="font-medium text-forest">What happens after this?</p>
            <p className="mt-1 text-forest/65">
              We build your ideal nutrition profile, then ask for a recent grocery receipt to
              compare against. No accounts, no tracking — your data stays on your device.
            </p>
          </div>
        )}

        <div className="mt-8 space-y-3">
          {current.key === "tastes" ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-sage/5 p-3 text-xs text-forest/65">
                <strong className="text-sage">Why we ask:</strong> Recipes that match your taste are
                the ones you'll actually cook. Slide each one — there are no wrong answers.
              </div>
              <fieldset className="space-y-2.5">
                <legend className="sr-only">Food preferences</legend>
                {TASTE_ITEMS.map((t) => {
                  const min = "minLabel" in t ? t.minLabel : "Never";
                  const max = "maxLabel" in t ? t.maxLabel : "Love it";
                  const val = tastes[t.k];
                  const inputId = `taste-${t.k}`;
                  const labels = ["Never", "Rarely", "Sometimes", "Often", "Love it"];
                  const display = "minLabel" in t
                    ? val <= 2 ? min : val >= 4 ? max : "Either"
                    : labels[val - 1];
                  return (
                    <div key={t.k} className="rounded-2xl border border-forest/10 bg-card p-4">
                      <div className="flex items-baseline justify-between">
                        <label htmlFor={inputId} className="font-medium">
                          {t.label}
                        </label>
                        <span className="text-xs font-medium text-sage">{display}</span>
                      </div>
                      <input
                        id={inputId}
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={val}
                        onChange={(e) =>
                          setTastes({ ...tastes, [t.k]: Number(e.target.value) })
                        }
                        aria-valuetext={display}
                        className="mt-3 w-full accent-sage"
                      />
                      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-forest/40">
                        <span>{min}</span>
                        <span>{max}</span>
                      </div>
                    </div>
                  );
                })}
              </fieldset>
            </div>
          ) : current.key === "bio" ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-sage/5 p-3 text-xs text-forest/65">
                <strong className="text-sage">Why we ask:</strong> Age, weight and height are used
                only to calculate your daily nutrient targets (RDA). Stored locally on your device.
              </div>
              <fieldset className="grid grid-cols-3 gap-3">
                <legend className="sr-only">Your body basics</legend>
                {[
                  { k: "age" as const, label: "Age", suffix: "yrs", min: 18, max: 90, hint: "18–90" },
                  { k: "weight" as const, label: "Weight", suffix: "kg", min: 35, max: 250, hint: "35–250" },
                  { k: "height" as const, label: "Height", suffix: "cm", min: 120, max: 230, hint: "120–230" },
                ].map((f) => {
                  const raw = bio[f.k];
                  const val = Number(raw);
                  const empty = raw === "";
                  const numeric = !empty && !Number.isNaN(val);
                  const outOfRange = numeric && (val < f.min || val > f.max);
                  const invalid = empty || !numeric || outOfRange;
                  const showError = !empty && invalid;
                  const valid = numeric && !outOfRange;
                  const inputId = `bio-${f.k}`;
                  const errorId = `${inputId}-error`;
                  const message = empty
                    ? `${f.label} is required`
                    : !numeric
                      ? `Please enter a number`
                      : val < f.min
                        ? `Minimum is ${f.min} ${f.suffix}`
                        : `Maximum is ${f.max} ${f.suffix}`;
                  return (
                    <div
                      key={f.k}
                      className={`relative rounded-2xl border p-4 transition-colors ${
                        showError
                          ? "border-terracotta bg-terracotta/5"
                          : valid
                            ? "border-sage/40 bg-card"
                            : "border-forest/10 bg-card"
                      }`}
                    >
                      <label
                        htmlFor={inputId}
                        className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-forest/50"
                      >
                        <span>
                          {f.label} <span className="text-terracotta">*</span>
                        </span>
                        {valid && <span aria-hidden className="text-sage">✓</span>}
                      </label>
                      <div className="mt-1 flex items-baseline gap-1">
                        <input
                          id={inputId}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="–"
                          aria-required="true"
                          aria-invalid={showError}
                          aria-describedby={showError ? errorId : `${inputId}-hint`}
                          value={raw}
                          onChange={(e) =>
                            setBio({ ...bio, [f.k]: e.target.value.replace(/[^0-9.]/g, "") })
                          }
                          className="w-full bg-transparent font-serif text-3xl outline-none placeholder:text-forest/20"
                        />
                        <span className="text-xs text-forest/50">{f.suffix}</span>
                      </div>
                      {showError ? (
                        <span id={errorId} role="alert" className="mt-1 block text-[10px] text-terracotta">
                          {message}
                        </span>
                      ) : (
                        <span id={`${inputId}-hint`} className="mt-1 block text-[10px] text-forest/40">
                          Typical {f.hint} {f.suffix}
                        </span>
                      )}
                    </div>
                  );
                })}
              </fieldset>
              <p className="text-[11px] text-forest/50">
                All three fields are required to estimate your daily targets accurately.
              </p>
            </div>
          ) : (
            <>
              {current.key === "diet" && (
                <p className="-mt-2 mb-1 text-xs text-forest/55">
                  Pick "No restrictions" if none apply. You can change these anytime in Settings.
                </p>
              )}
              <div
                role={current.multi ? "group" : "radiogroup"}
                aria-label={current.title}
                className="space-y-3"
              >
                {current.options.map((opt) => {
                  const active = stepPicks.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      role={current.multi ? "checkbox" : "radio"}
                      aria-checked={active}
                      onClick={() => toggle(opt)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                        active
                          ? "border-sage bg-sage/5 ring-1 ring-sage"
                          : "border-forest/10 bg-card hover:border-sage/40"
                      }`}
                    >
                      <span className="font-medium">{opt}</span>
                      <span
                        aria-hidden
                        className={`grid size-6 place-items-center rounded-full text-xs transition-colors ${
                          active ? "bg-sage text-cream" : "border border-forest/20"
                        }`}
                      >
                        {active ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              {current.multi && (
                <p className="mt-2 text-[11px] text-forest/50" aria-live="polite">
                  {stepPicks.length === 0
                    ? "Select at least one to continue."
                    : `${stepPicks.length} selected`}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-forest/5 bg-cream/95 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          <span className="text-xs text-forest/50">
            {current.multi ? "Choose any" : "Choose one"}
          </span>
          <button
            disabled={!canAdvance}
            onClick={next}
            className="rounded-full bg-sage px-8 py-3 font-medium text-cream shadow-lg shadow-sage/20 transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-forest/20 disabled:shadow-none"
          >
            {isLast ? "Finish setup →" : "Continue →"}
          </button>
        </div>
      </footer>
    </div>
  );
}
