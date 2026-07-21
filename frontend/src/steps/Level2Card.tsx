import { useState } from "react";
import { Card, PrimaryButton, Field, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { submitLevel2 } from "@/lib/api";

// E9: consent-gated Level-2 questionnaire. Consent (GDPR Art. 9) is asked
// first; declining keeps the app fully usable (multipliers stay 1.0). The
// answers only re-prioritize already-tracked nutrients — never a diagnosis.

const QUESTIONS: { key: string; options: string[] }[] = [
  { key: "l2_bowel_frequency", options: ["normal", "less_than_3_per_week"] },
  { key: "l2_bloating", options: ["none", "sometimes", "often_daily"] },
  { key: "l2_hunger", options: ["normal", "most_of_day"] },
  { key: "l2_energy", options: ["fine", "afternoon_crash"] },
  { key: "l2_sleep", options: ["fine", "poor"] },
  { key: "l2_hydration", options: ["enough", "low"] },
  { key: "l2_alcohol", options: ["none", "occasional", "weekly_plus"] },
  { key: "l2_muscle_soreness", options: ["none", "active_sore"] },
];

export function Level2Card({
  profileId,
  onDone,
}: {
  profileId: string;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const [stage, setStage] = useState<"consent" | "questions">("consent");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function decline() {
    setBusy(true);
    try {
      await submitLevel2(profileId, { consent: false });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      await submitLevel2(profileId, { consent: true, ...answers });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (stage === "consent") {
    return (
      <Card className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("level2.title")}</p>
        <p className="max-w-[56ch] text-sm text-ink/70">{t("level2.consentBody")}</p>
        <ul className="space-y-1 text-xs text-ink/60">
          <li>· {t("level2.consentBullet1")}</li>
          <li>· {t("level2.consentBullet2")}</li>
          <li>· {t("level2.consentBullet3")}</li>
        </ul>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          {t("level2.notMedicalAdvice")}
        </p>
        <div className="flex gap-2">
          <PrimaryButton type="button" disabled={busy} onClick={() => setStage("questions")} className="w-auto px-6">
            {t("level2.grant")}
          </PrimaryButton>
          <button type="button" disabled={busy} onClick={decline}
            className="rounded-full bg-zinc-100 px-6 py-2 text-sm font-medium tracking-tight text-ink ring-1 ring-black/5">
            {t("level2.decline")}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("level2.title")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {QUESTIONS.map((q) => (
          <Field key={q.key} label={t(`level2.q.${q.key}`)}>
            <select
              className={cn(inputCls, "appearance-none")}
              value={answers[q.key] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
            >
              <option value="">{t("level2.skip")}</option>
              {q.options.map((o) => (
                <option key={o} value={o}>{t(`level2.opt.${o}`)}</option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      <p className="text-xs text-ink/50">{t("level2.notMedicalAdvice")}</p>
      <PrimaryButton type="button" disabled={busy} onClick={submit} className="w-auto px-8">
        {busy ? t("profile.saving") : t("level2.submit")}
      </PrimaryButton>
    </Card>
  );
}
