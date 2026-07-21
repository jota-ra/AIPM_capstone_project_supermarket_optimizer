import { Card } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage, nutrientLabel } from "@/lib/i18n";
import type { NutritionAnalysis, AnalysisBar } from "@/types/api";

// E7 results view: the ideal-vs-status-quo health score with its honest
// confidence badge (BR-HS4), per-nutrient closeness bars (BR-HS2), and the
// 3-tier item grouping (BR-G). Additive to the existing density snapshot.

const BAND_TONE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-100 text-amber-700 ring-amber-200",
  low: "bg-red-100 text-red-700 ring-red-200",
};

function closenessTone(c: number | null): string {
  if (c === null) return "bg-zinc-200";
  if (c >= 85) return "bg-emerald-500";
  if (c >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function Bar({ bar }: { bar: AnalysisBar }) {
  const { language } = useLanguage();
  const pct = bar.bar_pct;
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium tracking-tight text-ink/80">
          {nutrientLabel(bar.nutrient, language)}
          {bar.kind === "ceiling" ? <span className="ml-1 text-ink/40">(max)</span> : null}
          {bar.weight === 0 && bar.kind === "target" ? <span className="ml-1 text-ink/30">·</span> : null}
        </span>
        <span className="text-ink/50">
          {bar.intake ?? "—"} / {bar.reference ?? "—"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={cn("h-full rounded-full transition-all", closenessTone(bar.closeness))}
          style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
        />
      </div>
    </li>
  );
}

const GROUP_ORDER = ["Healthy", "OK", "Unhealthy", "not enough data"] as const;
const GROUP_TONE: Record<string, string> = {
  Healthy: "text-emerald-700",
  OK: "text-amber-700",
  Unhealthy: "text-red-700",
  "not enough data": "text-ink/40",
};

export function AnalysisCard({ analysis }: { analysis: NutritionAnalysis }) {
  const { t } = useLanguage();

  if (!analysis.has_ideal_profile) {
    return (
      <Card className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("analysis.title")}</p>
        <p className="text-sm text-ink/60">{t("analysis.needProfile")}</p>
      </Card>
    );
  }

  const scored = analysis.bars.filter((b) => b.in_score);
  const microBars = analysis.bars.filter((b) => b.weight === 0 && b.kind === "target");
  const ceilingBars = analysis.bars.filter((b) => b.kind === "ceiling");
  const band = analysis.confidence.band ?? "low";

  return (
    <Card className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("analysis.title")}</p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold tracking-tight text-ink">{analysis.score ?? "—"}</span>
            <span className="text-sm text-ink/40">/ 100</span>
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ring-1", BAND_TONE[band])}>
              {t(`analysis.band.${band}`)}
            </span>
          </div>
          {analysis.on_target ? (
            <p className="text-sm text-emerald-600">{t("analysis.onTarget")}</p>
          ) : null}
        </div>
      </header>

      <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-ink/50 ring-1 ring-black/5">
        {t("analysis.microsGated")}
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("analysis.macros")}</p>
        <ul className="space-y-3">
          {scored.map((b) => <Bar key={b.nutrient} bar={b} />)}
          {ceilingBars.map((b) => <Bar key={b.nutrient} bar={b} />)}
        </ul>
      </div>

      {microBars.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("analysis.micros")}</p>
          <ul className="space-y-3">{microBars.map((b) => <Bar key={b.nutrient} bar={b} />)}</ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("analysis.grouping")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GROUP_ORDER.map((tier) => {
            const items = analysis.grouping[tier] ?? [];
            return (
              <div key={tier} className="rounded-xl bg-zinc-50 p-3 ring-1 ring-black/5">
                <p className={cn("text-[11px] font-semibold uppercase tracking-widest", GROUP_TONE[tier])}>
                  {t(`analysis.tier.${tier === "not enough data" ? "grey" : tier.toLowerCase()}`)} · {items.length}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {items.slice(0, 6).map((it, i) => (
                    <li key={i} className="truncate text-xs text-ink/60">{it.name}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
