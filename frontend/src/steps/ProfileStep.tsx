import { useState, type FormEvent } from "react";
import { SectionLabel, Card, PrimaryButton, PillToggle, Field, inputCls } from "@/components/AppShell";
import { createProfile, ApiError } from "@/lib/api";
import type { ActivityLevel, AgeRange, DietaryPattern, Goal } from "@/types/api";

const GOALS: Goal[] = ["lose_weight", "gain_muscle", "eat_healthier", "more_energy", "maintain_weight"];
const AGE_RANGES: AgeRange[] = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const ACTIVITY_LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const DIETARY_PATTERNS: DietaryPattern[] = ["omnivore", "vegetarian", "vegan", "pescatarian"];

export function ProfileStep({
  onProfileCreated,
  onSkip,
}: {
  onProfileCreated: (profileId: string) => void;
  onSkip: () => void;
}) {
  const [goal, setGoal] = useState<Goal>("eat_healthier");
  const [ageRange, setAgeRange] = useState<AgeRange>("25-34");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [dietaryPattern, setDietaryPattern] = useState<DietaryPattern>("omnivore");
  const [exclusionsText, setExclusionsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const exclusions = exclusionsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const profile = await createProfile({
        goal,
        age_range: ageRange,
        activity_level: activityLevel,
        dietary_pattern: dietaryPattern,
        exclusions,
      });
      onProfileCreated(profile.profile_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <SectionLabel>Step 3 · Profile</SectionLabel>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          A few quick questions.
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">
          Under 90 seconds. This is what keeps recommendations from being
          generic — and from ever suggesting something you can't eat.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="space-y-6">
          <Field label="Goal">
            <PillToggle options={GOALS} value={goal} onChange={setGoal} />
          </Field>
          <Field label="Age range">
            <PillToggle options={AGE_RANGES} value={ageRange} onChange={setAgeRange} />
          </Field>
          <Field label="Activity level">
            <PillToggle options={ACTIVITY_LEVELS} value={activityLevel} onChange={setActivityLevel} />
          </Field>
          <Field label="Dietary pattern">
            <PillToggle options={DIETARY_PATTERNS} value={dietaryPattern} onChange={setDietaryPattern} />
          </Field>
          <Field label="Exclusions (optional, comma-separated)">
            <input
              className={inputCls}
              placeholder="e.g. peanuts, gluten"
              value={exclusionsText}
              onChange={(e) => setExclusionsText(e.target.value)}
            />
          </Field>
        </Card>

        {error ? (
          <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Saving…" : "Create profile"}
        </PrimaryButton>
        <button
          type="button"
          onClick={onSkip}
          className="block w-full text-center text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
        >
          Skip for now (use a neutral profile with no exclusions)
        </button>
      </form>
    </section>
  );
}
