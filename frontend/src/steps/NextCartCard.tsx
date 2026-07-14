import { Card } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";
import type { StructuredNextCart, ScoredRecommendation } from "@/types/api";

// E8: the structured Next-Cart recommendation — 1 primary + ≤2 alternatives
// + ≤2 reduce, or a no-suitable / balanced state. Closes E7's "drop/add" gap.

function Rec({ rec, primary }: { rec: ScoredRecommendation; primary?: boolean }) {
  return (
    <div className={primary ? "rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200" : "rounded-xl bg-zinc-50 p-3 ring-1 ring-black/5"}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={primary ? "text-base font-semibold tracking-tight text-ink" : "text-sm font-medium text-ink/80"}>
          {rec.item}
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-widest text-ink/40">{rec.targets_gap}</span>
      </div>
      {rec.rationale ? <p className="mt-1 text-xs text-ink/60">{rec.rationale}</p> : null}
    </div>
  );
}

export function NextCartCard({ rec }: { rec: StructuredNextCart }) {
  const { t } = useLanguage();

  return (
    <Card className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-widest text-ink/40">{t("nextcart.title")}</p>

      {rec.status !== "recommended" ? (
        <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-ink/60 ring-1 ring-black/5">
          {rec.status === "no_gaps" ? t("nextcart.noGaps") : t("nextcart.noSuitable")}
        </p>
      ) : null}

      {rec.primary ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">{t("nextcart.primary")}</p>
            <Rec rec={rec.primary} primary />
          </div>

          {rec.alternatives.length ? (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink/40">{t("nextcart.alternatives")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {rec.alternatives.map((a) => <Rec key={a.item} rec={a} />)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {rec.reduce.length ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-700">{t("nextcart.reduce")}</p>
          <div className="flex flex-wrap gap-2">
            {rec.reduce.map((name) => (
              <span key={name} className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700 ring-1 ring-red-200">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
