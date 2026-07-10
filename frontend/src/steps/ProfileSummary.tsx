import { useEffect, useState } from "react";
import { Card, Field, PrimaryButton, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage, type Lang } from "@/lib/i18n";
import { getProfile, updateProfile, ApiError } from "@/lib/api";
import { STEPS, type StepDef } from "@/steps/ChatOnboardingStep";
import type { Profile, ProfileCreate } from "@/types/api";

// "My Profile" — a single editable form for everything onboarding
// (ChatOnboardingStep) collected, styled as one grid instead of the
// chat's one-question-at-a-time flow. Reuses STEPS from the chat so
// the options/labels aren't duplicated, only laid out differently.

type Draft = Record<string, string | string[]>;

function toDraft(profile: Profile): Draft {
  const draft: Draft = {};
  for (const step of STEPS) {
    const raw = (profile as unknown as Record<string, unknown>)[step.key];
    draft[step.key] = step.kind === "multi" ? ((raw as string[]) ?? []) : String(raw ?? "");
  }
  return draft;
}

function buildPatch(draft: Draft): Partial<ProfileCreate> {
  const patch: Record<string, unknown> = {};
  for (const step of STEPS) {
    const value = draft[step.key];
    if (step.kind === "multi") {
      patch[step.key] = (value as string[]).filter((v) => v !== "none");
    } else if (step.kind === "number") {
      patch[step.key] = value ? Number(value) : null;
    } else if (step.key === "age_range") {
      patch.age_range = value && value !== "undisclosed" ? value : null;
    } else if (step.key === "digestion" || step.key === "veg_frequency" || step.key === "gender") {
      patch[step.key] = (value as string) || null;
    } else if (step.key === "name") {
      patch.name = (value as string).trim() || null;
    } else {
      patch[step.key] = value;
    }
  }
  return patch as Partial<ProfileCreate>;
}

function toggleMulti(list: string[], value: string): string[] {
  if (value === "none") return list.includes("none") ? [] : ["none"];
  if (list.includes(value)) return list.filter((v) => v !== value);
  return [...list.filter((v) => v !== "none"), value];
}

const CHIP_CLS = (selected: boolean) =>
  cn(
    "rounded-xl px-3.5 py-2 text-sm font-medium tracking-tight ring-1 transition-colors",
    selected ? "bg-ink text-canvas ring-ink" : "bg-zinc-50 text-ink/60 ring-black/5 hover:text-ink",
  );

function ChoiceSelect({
  step,
  value,
  lang,
  onChange,
}: {
  step: StepDef;
  value: string;
  lang: Lang;
  onChange: (v: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <select
      className={cn(inputCls, "appearance-none")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {step.optional ? <option value="">{t("profile.selectPlaceholder")}</option> : null}
      {step.options!.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label[lang]}
        </option>
      ))}
    </select>
  );
}

function MultiChips({
  step,
  value,
  lang,
  onChange,
}: {
  step: StepDef;
  value: string[];
  lang: Lang;
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {step.options!.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(toggleMulti(value, opt.value))}
          className={CHIP_CLS(value.includes(opt.value))}
        >
          {opt.label[lang]}
        </button>
      ))}
    </div>
  );
}

export function ProfileSummary({ profileId }: { profileId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const lang: Lang = language;

  async function load() {
    setLoadError(null);
    try {
      const p = await getProfile(profileId);
      setProfile(p);
      setDraft(toDraft(p));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : t("profile.loadFailed"));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  function setField(key: string, value: string | string[]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateProfile(profileId, buildPatch(draft));
      setProfile(updated);
      setDraft(toDraft(updated));
      if (typeof draft.language === "string" && draft.language) setLanguage(draft.language as Lang);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const symptomsStep = STEPS.find((s) => s.key === "symptoms")!;
  const allergiesStep = STEPS.find((s) => s.key === "allergies")!;
  const activityStep = STEPS.find((s) => s.key === "activity_level")!;
  const gridSteps = STEPS.filter(
    (s) =>
      (s.kind === "choice" && s.key !== "activity_level") || s.kind === "text" || s.kind === "number",
  );
  const activityValue = draft ? (draft.activity_level as string) : "";

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("profile.step")}</p>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">{t("profile.title")}</h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("profile.body")}</p>
      </header>

      {loadError ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">{loadError}</div>
      ) : null}

      {!profile && !loadError ? <p className="text-sm text-ink/50">{t("profile.loading")}</p> : null}

      {profile && draft ? (
        <Card className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {gridSteps.map((step) => (
              <Field key={step.key} label={(step.shortLabel ?? step.prompt)[lang]}>
                {step.kind === "text" || step.kind === "number" ? (
                  <input
                    className={inputCls}
                    type={step.kind === "number" ? "number" : "text"}
                    value={draft[step.key] as string}
                    onChange={(e) => setField(step.key, e.target.value)}
                    placeholder={step.placeholder?.[lang]}
                  />
                ) : (
                  <ChoiceSelect
                    step={step}
                    value={draft[step.key] as string}
                    lang={lang}
                    onChange={(v) => setField(step.key, v)}
                  />
                )}
              </Field>
            ))}
          </div>

          <Field label={(activityStep.shortLabel ?? activityStep.prompt)[lang]}>
            <div className="flex flex-wrap gap-2">
              {activityStep.options!.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setField("activity_level", opt.value)}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-sm font-medium tracking-tight ring-1 transition-colors",
                    activityValue === opt.value
                      ? "bg-ink text-canvas ring-ink"
                      : "bg-zinc-50 text-ink/60 ring-black/5 hover:text-ink",
                  )}
                >
                  {opt.label[lang]}
                </button>
              ))}
            </div>
          </Field>

          <Field label={(allergiesStep.shortLabel ?? allergiesStep.prompt)[lang]}>
            <MultiChips
              step={allergiesStep}
              value={draft.allergies as string[]}
              lang={lang}
              onChange={(v) => setField("allergies", v)}
            />
          </Field>

          <div className="space-y-2">
            <Field label={(symptomsStep.shortLabel ?? symptomsStep.prompt)[lang]}>
              <MultiChips
                step={symptomsStep}
                value={draft.symptoms as string[]}
                lang={lang}
                onChange={(v) => setField("symptoms", v)}
              />
            </Field>
            {symptomsStep.disclaimer ? (
              <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-black/5">
                <p className="text-xs font-medium uppercase tracking-widest text-ink/40">
                  {t("profile.quickNoteTitle")}
                </p>
                <p className="mt-1 text-xs text-ink/60">{symptomsStep.disclaimer[lang]}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-black/5 pt-6">
            <div className="flex items-center gap-3">
              <PrimaryButton type="button" disabled={saving} onClick={handleSave} className="w-auto px-8">
                {saving ? t("profile.saving") : t("profile.save")}
              </PrimaryButton>
              {saved && !saving ? <span className="text-xs text-emerald-600">{t("profile.saved")}</span> : null}
            </div>
            {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
          </div>
        </Card>
      ) : null}
    </section>
  );
}
