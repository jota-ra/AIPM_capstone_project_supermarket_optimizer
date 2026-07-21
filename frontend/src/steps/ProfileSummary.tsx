import { useEffect, useState } from "react";
import { Card, Field, PrimaryButton, SectionLabel, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage, type Lang } from "@/lib/i18n";
import { getProfile, updateProfile, exportMyData, ApiError } from "@/lib/api";
import { STEPS, type StepDef } from "@/steps/ChatOnboardingStep";
import { TargetsCard } from "@/components/TargetsCard";
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

// Required fields must never be nulled out; every other empty value maps
// to null so an unset optional enum/date doesn't send "" (which would fail
// the backend enum validation).
const _REQUIRED_KEYS = new Set(["goal", "dietary_pattern"]);

function buildPatch(draft: Draft): Partial<ProfileCreate> {
  const patch: Record<string, unknown> = {};
  for (const step of STEPS) {
    const value = draft[step.key];
    if (step.kind === "multi") {
      patch[step.key] = (value as string[]).filter((v) => v !== "none");
    } else if (step.kind === "number") {
      patch[step.key] = value ? Number(value) : null;
    } else if (step.key === "name") {
      patch.name = (value as string).trim() || null;
    } else if (_REQUIRED_KEYS.has(step.key)) {
      patch[step.key] = value;
    } else {
      // choice / text / date — empty means "not set".
      patch[step.key] = (value as string)?.trim() ? (value as string).trim() : null;
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

// E6-S1: household attribution + eating-outside inputs. Saved directly to
// the profile; the backend turns them into user_share (BR-I2), the
// confidence discount (BR-C4) and the eating-occasion coverage (BR-I6).
function HouseholdCard({ profileId, profile }: { profileId: string; profile: Profile }) {
  const { t } = useLanguage();
  const [shared, setShared] = useState<boolean>(profile.groceries_shared ?? false);
  const [size, setSize] = useState<string>(profile.household_size ? String(profile.household_size) : "");
  const [mealsOutside, setMealsOutside] = useState<string>(profile.meals_outside ?? "");
  const [receiptsComplete, setReceiptsComplete] = useState<string>(profile.receipts_complete ?? "");
  const [daysToShop, setDaysToShop] = useState<string>(profile.days_to_shop ? String(profile.days_to_shop) : "");
  const [homeCooked, setHomeCooked] = useState<string>(profile.home_cooked_frequency ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile(profileId, {
        groceries_shared: shared,
        household_size: shared && size ? Number(size) : null,
        meals_outside: (mealsOutside || null) as ProfileCreate["meals_outside"],
        receipts_complete: (receiptsComplete || null) as ProfileCreate["receipts_complete"],
        days_to_shop: daysToShop ? Number(daysToShop) : null,
        home_cooked_frequency: (homeCooked || null) as ProfileCreate["home_cooked_frequency"],
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const MO = ["never", "rarely", "sometimes", "often", "daily"] as const;
  const RC = ["all", "most", "some", "few"] as const;
  const HC = ["rarely", "sometimes", "often", "daily"] as const;

  return (
    <Card className="space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("household.title")}</p>
        <p className="max-w-[56ch] text-sm text-ink/60">{t("household.body")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("household.shared")}>
          <div className="flex gap-2">
            {[
              { v: false, label: t("household.sharedNo") },
              { v: true, label: t("household.sharedYes") },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setShared(o.v)}
                className={CHIP_CLS(shared === o.v)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        {shared ? (
          <Field label={t("household.size")}>
            <input
              className={inputCls}
              type="number"
              min={1}
              max={20}
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </Field>
        ) : null}

        <Field label={t("household.mealsOutside")}>
          <select className={cn(inputCls, "appearance-none")} value={mealsOutside} onChange={(e) => setMealsOutside(e.target.value)}>
            <option value="">—</option>
            {MO.map((m) => (
              <option key={m} value={m}>{t(`household.mo.${m}`)}</option>
            ))}
          </select>
        </Field>

        <Field label={t("household.receiptsComplete")}>
          <select className={cn(inputCls, "appearance-none")} value={receiptsComplete} onChange={(e) => setReceiptsComplete(e.target.value)}>
            <option value="">—</option>
            {RC.map((r) => (
              <option key={r} value={r}>{t(`household.rc.${r}`)}</option>
            ))}
          </select>
        </Field>

        <Field label={t("household.daysToShop")}>
          <input className={inputCls} type="number" min={1} max={60} value={daysToShop} onChange={(e) => setDaysToShop(e.target.value)} />
        </Field>

        <Field label={t("household.homeCooked")}>
          <select className={cn(inputCls, "appearance-none")} value={homeCooked} onChange={(e) => setHomeCooked(e.target.value)}>
            <option value="">—</option>
            {HC.map((h) => (
              <option key={h} value={h}>{t(`household.hc.${h}`)}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <PrimaryButton type="button" disabled={saving} onClick={save} className="w-auto px-8">
          {saving ? t("profile.saving") : t("profile.save")}
        </PrimaryButton>
        {saved && !saving ? <span className="text-xs text-emerald-600">{t("profile.saved")}</span> : null}
      </div>
    </Card>
  );
}

// E12 — Data & privacy controls (GDPR): export (S2/portability), revoke
// health-data consent (S4), and delete the whole account (S3). All live in
// the profile screen, which is the canonical "Edit Profile" home for FR-12.
function PrivacyCard({
  profileId,
  consented,
  onChanged,
  onDeleteAccount,
}: {
  profileId: string;
  consented: boolean;
  onChanged: () => void;
  onDeleteAccount: () => void;
}) {
  const { t } = useLanguage();
  const [exporting, setExporting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doExport() {
    setExporting(true);
    setError(null);
    try {
      const data = await exportMyData();
      // Trigger a client-side download of the JSON bundle.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "naehrbert-my-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("privacy.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function revokeConsent() {
    setRevoking(true);
    setError(null);
    try {
      // F15: stop Level-2 processing (multipliers revert to 1.0 server-side)
      // and hide the invite; existing answers are kept (removable via delete
      // or retrievable via export).
      await updateProfile(profileId, { consent_level2: false });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("privacy.revokeFailed"));
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Card className="space-y-6">
      <header className="space-y-1">
        <SectionLabel>{t("privacy.title")}</SectionLabel>
        <p className="max-w-[56ch] text-sm text-ink/60">{t("privacy.body")}</p>
      </header>

      {/* S4 — health-data consent */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-tight text-ink">{t("privacy.consentTitle")}</p>
          <p className="mt-0.5 text-xs text-ink/55">
            {consented ? t("privacy.consentActive") : t("privacy.consentInactive")}
          </p>
        </div>
        {consented ? (
          <button
            type="button"
            onClick={revokeConsent}
            disabled={revoking}
            className="shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-tight text-ink/70 ring-1 ring-black/10 hover:bg-zinc-50 disabled:opacity-40"
          >
            {revoking ? t("privacy.revoking") : t("privacy.revoke")}
          </button>
        ) : null}
      </div>

      {/* S2 — data export */}
      <div className="flex items-center justify-between gap-4 border-t border-black/5 pt-6">
        <div>
          <p className="text-sm font-medium tracking-tight text-ink">{t("privacy.exportTitle")}</p>
          <p className="mt-0.5 text-xs text-ink/55">{t("privacy.exportBody")}</p>
        </div>
        <button
          type="button"
          onClick={doExport}
          disabled={exporting}
          className="shrink-0 rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200 disabled:opacity-40"
        >
          {exporting ? t("privacy.exporting") : t("privacy.exportButton")}
        </button>
      </div>

      {/* S3 — account deletion (full erasure) */}
      <div className="flex items-center justify-between gap-4 border-t border-black/5 pt-6">
        <div>
          <p className="text-sm font-medium tracking-tight text-ink">{t("privacy.deleteTitle")}</p>
          <p className="mt-0.5 text-xs text-ink/55">{t("privacy.deleteBody")}</p>
        </div>
        <button
          type="button"
          onClick={onDeleteAccount}
          className="shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-tight text-red-600 ring-1 ring-red-200 hover:bg-red-50"
        >
          {t("privacy.deleteButton")}
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </Card>
  );
}

export function ProfileSummary({
  profileId,
  onLogout,
  onDeleteAccount,
}: {
  profileId: string;
  onLogout: () => void;
  onDeleteAccount: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { language, t } = useLanguage();
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
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const symptomsStep = STEPS.find((s) => s.key === "symptoms")!;
  const allergiesStep = STEPS.find((s) => s.key === "allergies")!;
  const dislikesStep = STEPS.find((s) => s.key === "dislikes")!;
  const gridSteps = STEPS.filter(
    (s) => s.kind === "choice" || s.kind === "text" || s.kind === "number" || s.kind === "date",
  );

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("profile.step")}</p>
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium tracking-tight text-ink/50 ring-1 ring-black/10 transition-colors hover:bg-zinc-50 hover:text-ink"
          >
            {t("profile.logout")}
          </button>
        </div>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">{t("profile.title")}</h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("profile.body")}</p>
        <p className="font-mono text-[11px] text-ink/35">
          {t("profile.userId")}: {profileId}
        </p>
      </header>

      {loadError ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">{loadError}</div>
      ) : null}

      {!profile && !loadError ? <p className="text-sm text-ink/50">{t("profile.loading")}</p> : null}

      {profile && draft ? (
        <>
        <TargetsCard ideal={profile.ideal_profile} />
        <HouseholdCard profileId={profileId} profile={profile} />
        <Card className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {gridSteps.map((step) => (
              <Field key={step.key} label={(step.shortLabel ?? step.prompt)[lang]}>
                {step.kind === "text" || step.kind === "number" || step.kind === "date" ? (
                  <input
                    className={inputCls}
                    type={step.kind === "number" ? "number" : step.kind === "date" ? "date" : "text"}
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

          <Field label={(allergiesStep.shortLabel ?? allergiesStep.prompt)[lang]}>
            <MultiChips
              step={allergiesStep}
              value={draft.allergies as string[]}
              lang={lang}
              onChange={(v) => setField("allergies", v)}
            />
          </Field>

          <Field label={(dislikesStep.shortLabel ?? dislikesStep.prompt)[lang]}>
            <MultiChips
              step={dislikesStep}
              value={(draft.dislikes as string[]) ?? []}
              lang={lang}
              onChange={(v) => setField("dislikes", v)}
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

        {/* E12 — GDPR data & privacy controls (export / consent / delete). */}
        <PrivacyCard
          profileId={profileId}
          consented={profile.consent_level2 === true}
          onChanged={load}
          onDeleteAccount={onDeleteAccount}
        />
        </>
      ) : null}
    </section>
  );
}
