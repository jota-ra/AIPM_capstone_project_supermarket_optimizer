import { Card } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import type { IdealProfile } from "@/types/api";

// One row: label on the left, the ideal amount on the right — a plain
// list instead of a grid of boxes.
function TargetRow({ label, value, unit, big }: { label: string; value: number; unit: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <p className={cn("text-ink/70", big ? "text-sm font-medium" : "text-sm")}>{label}</p>
      <p className={cn("shrink-0 font-medium tracking-tight text-ink", big ? "text-lg" : "text-base")}>
        {value}
        <span className="ml-1 text-xs font-normal text-ink/50">{unit}</span>
      </p>
    </div>
  );
}

// E2 — daily targets computed by the Ideal Profile Engine, attached to the
// profile response once the Level-1 biometrics are present. Shared between
// Profile Settings (ProfileSummary.tsx, where editing the inputs and saving
// recomputes it) and Insights (ResultsStep.tsx, read-only) — same numbers,
// same rendering, so the two pages never drift. Micronutrients are
// deliberately not shown here — they're starter/placeholder values pending
// dietitian verification (see backend services/ideal_profile.py), not
// something to present as a finished target yet.
export function TargetsCard({ ideal }: { ideal: IdealProfile | null | undefined }) {
  const { t } = useLanguage();

  return (
    <Card className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("targets.title")}</p>
        <p className="max-w-[56ch] text-sm text-ink/60">{t("targets.body")}</p>
      </header>

      {!ideal ? (
        <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-ink/60 ring-1 ring-black/5">
          {t("targets.empty")}
        </p>
      ) : (
        <>
          <div className="divide-y divide-black/5">
            <TargetRow label={t("targets.calories")} value={ideal.calories_kcal} unit={t("targets.kcal")} big />
            <TargetRow label={t("targets.protein")} value={ideal.protein_g} unit="g" big />
            <TargetRow label={t("targets.fat")} value={ideal.fat_g} unit="g" big />
            <TargetRow label={t("targets.carbs")} value={ideal.carbs_g} unit="g" big />
            <TargetRow label={t("targets.fiber")} value={ideal.fiber_g} unit="g" big />
          </div>

          {ideal.constrained ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-200">
              {t("targets.constrained")}
            </div>
          ) : null}

          <div className="space-y-1 border-t border-black/5 pt-3">
            <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("targets.energyTitle")}</p>
            <div className="divide-y divide-black/5">
              <TargetRow label={t("targets.bmr")} value={ideal.bmr_kcal} unit={t("targets.kcal")} />
              <TargetRow label={t("targets.neat")} value={ideal.neat_kcal} unit={t("targets.kcal")} />
              <TargetRow label={t("targets.eat")} value={ideal.eat_kcal} unit={t("targets.kcal")} />
              <TargetRow label={t("targets.tef")} value={ideal.tef_kcal} unit={t("targets.kcal")} />
              <TargetRow label={t("targets.tdee")} value={ideal.tdee_kcal} unit={t("targets.kcal")} />
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
