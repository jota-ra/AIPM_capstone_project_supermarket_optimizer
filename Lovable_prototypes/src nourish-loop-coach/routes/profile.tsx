import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { store, useStore, type Profile } from "@/lib/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile · NutriWise" },
      { name: "description", content: "Review and update your nutrition profile, goals, dietary preferences and bio basics." },
    ],
  }),
  component: ProfilePage,
});

const GOAL_OPTIONS = ["More steady energy", "Better sleep", "Build muscle", "Reduce inflammation", "General wellbeing", "Improve digestion"];
const DIET_OPTIONS = ["No restrictions", "Vegetarian", "Pescatarian", "Vegan", "Gluten-free", "Lactose-free", "Nut allergy"];
const ACTIVITY_OPTIONS = ["Mostly sedentary", "Light (1–2 workouts)", "Moderate (3–4 workouts)", "Very active (5+ workouts)"];

const TASTE_LABELS: Record<string, string> = {
  chicken: "Chicken",
  fish: "Fish & seafood",
  redMeat: "Red meat",
  salad: "Leafy salads",
  vegetables: "Cooked vegetables",
  legumes: "Beans & lentils",
  warmVsCold: "Warm vs. cold dishes",
  spicy: "Spicy food",
};

function ProfilePage() {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const userName = useStore((s) => s.userName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(profile);
  const [name, setName] = useState(userName);

  function toggle(field: "goals" | "diet" | "activity", opt: string, multi: boolean) {
    const current = draft[field];
    if (multi) {
      setDraft({
        ...draft,
        [field]: current.includes(opt) ? current.filter((o) => o !== opt) : [...current, opt],
      });
    } else {
      setDraft({ ...draft, [field]: [opt] });
    }
  }

  function save() {
    store.set({ profile: draft, userName: name.trim() || "Friend" });
    setEditing(false);
  }

  function startEdit() {
    setDraft(profile);
    setName(userName);
    setEditing(true);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-8">
        <div className="flex items-center gap-2">
          <span className="chip bg-sage/10 text-sage">Your profile</span>
        </div>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-full bg-sage/15 font-serif text-2xl font-semibold text-sage">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-serif text-3xl leading-tight md:text-4xl">{userName}</h1>
              <p className="mt-1 text-sm text-forest/65">
                Your ideal nutrition profile — we compare every receipt against this.
              </p>
            </div>
          </div>
          {!editing && (
            <button
              onClick={startEdit}
              className="rounded-full border border-forest/15 bg-card px-4 py-2 text-xs font-medium text-forest transition-colors hover:border-sage/40"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-8 space-y-6">
            <Section title="Display name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                className="w-full rounded-2xl border border-forest/10 bg-card px-4 py-3 font-serif text-xl outline-none focus:border-sage"
              />
            </Section>

            <EditGroup title="Goals" hint="Pick all that feel true."
              options={GOAL_OPTIONS} selected={draft.goals} multi
              onToggle={(o) => toggle("goals", o, true)} />

            <EditGroup title="Dietary preferences" hint="We'll never recommend conflicting recipes."
              options={DIET_OPTIONS} selected={draft.diet} multi
              onToggle={(o) => toggle("diet", o, true)} />

            <EditGroup title="Activity level" hint="Used to scale your daily targets."
              options={ACTIVITY_OPTIONS} selected={draft.activity} multi={false}
              onToggle={(o) => toggle("activity", o, false)} />

            <Section title="Body basics" hint="Only used to calculate your RDA. Stored on your device.">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { k: "age" as const, label: "Age", suffix: "yrs" },
                  { k: "weight" as const, label: "Weight", suffix: "kg" },
                  { k: "height" as const, label: "Height", suffix: "cm" },
                ].map((f) => (
                  <label key={f.k} className="block rounded-2xl border border-forest/10 bg-card p-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-forest/50">
                      {f.label}
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <input
                        inputMode="numeric"
                        value={draft[f.k]}
                        onChange={(e) =>
                          setDraft({ ...draft, [f.k]: e.target.value.replace(/[^0-9.]/g, "") })
                        }
                        className="w-full bg-transparent font-serif text-3xl outline-none"
                      />
                      <span className="text-xs text-forest/50">{f.suffix}</span>
                    </div>
                  </label>
                ))}
              </div>
            </Section>

            <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-3 border-t border-forest/5 bg-cream/95 px-5 py-4 backdrop-blur-md">
              <button
                onClick={() => setEditing(false)}
                className="rounded-full px-5 py-2.5 text-sm text-forest/70 hover:text-forest"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-full bg-sage px-6 py-2.5 text-sm font-medium text-cream shadow-lg shadow-sage/20 active:scale-95"
              >
                Save changes
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <ReadCard title="Goals" items={profile.goals} empty="No goals set yet" />
            <ReadCard title="Dietary preferences" items={profile.diet} empty="No preferences" />
            <ReadCard title="Activity" items={profile.activity} empty="Not set" />
            <div className="rounded-3xl border border-forest/5 bg-card p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-forest/50">
                Body basics
              </h3>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Stat label="Age" value={profile.age} suffix="yrs" />
                <Stat label="Weight" value={profile.weight} suffix="kg" />
                <Stat label="Height" value={profile.height} suffix="cm" />
              </div>
            </div>
            {profile.tastes && Object.keys(profile.tastes).length > 0 && (
              <div className="rounded-3xl border border-forest/5 bg-card p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-forest/50">
                  Taste preferences
                </h3>
                <div className="mt-3 space-y-2">
                  {Object.entries(profile.tastes).map(([k, v]) => {
                    const label = TASTE_LABELS[k] ?? k;
                    return (
                      <div key={k} className="flex items-center gap-3">
                        <span className="w-44 shrink-0 text-sm text-forest/75">{label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-forest/10 overflow-hidden">
                          <div className="h-full bg-sage" style={{ width: `${(v / 5) * 100}%` }} />
                        </div>
                        <span className="w-6 text-right text-xs text-forest/50">{v}/5</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-forest/50">
                  Update these by redoing onboarding — they steer your recipe suggestions.
                </p>
              </div>
            )}

            <div className="rounded-3xl border border-forest/5 bg-sage/5 p-5">
              <h3 className="font-serif text-lg">Privacy</h3>
              <p className="mt-1 text-sm text-forest/70">
                Your profile lives in this browser. We never sell data, and you can wipe everything
                in one tap.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/onboarding"
                  className="rounded-full border border-forest/15 bg-card px-4 py-2 text-xs font-medium hover:border-sage/40"
                >
                  Redo onboarding
                </Link>
                <button
                  onClick={() => {
                    if (confirm("Reset profile and uploads? This can't be undone.")) {
                      store.reset();
                      router.navigate({ to: "/" });
                    }
                  }}
                  className="rounded-full border border-terracotta/30 bg-terracotta/5 px-4 py-2 text-xs font-medium text-terracotta hover:bg-terracotta/10"
                >
                  Reset all data
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-forest/50">{title}</h3>
      {hint && <p className="mt-1 text-xs text-forest/55">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EditGroup({
  title, hint, options, selected, multi, onToggle,
}: {
  title: string; hint: string; options: string[]; selected: string[]; multi: boolean;
  onToggle: (o: string) => void;
}) {
  return (
    <Section title={title} hint={hint}>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={active}
              onClick={() => onToggle(opt)}
              className={`rounded-full border px-4 py-2 text-sm transition-all ${
                active
                  ? "border-sage bg-sage/10 text-sage"
                  : "border-forest/10 bg-card text-forest/70 hover:border-sage/40"
              }`}
            >
              {active && <span aria-hidden className="mr-1">✓</span>}
              {opt}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function ReadCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-3xl border border-forest/5 bg-card p-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-forest/50">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-forest/50">{empty}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((g) => (
            <span key={g} className="rounded-full bg-sage/10 px-3 py-1.5 text-sm text-sage">
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-2xl bg-clay p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-forest/50">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-serif text-2xl">{value || "—"}</span>
        <span className="text-xs text-forest/50">{suffix}</span>
      </div>
    </div>
  );
}
