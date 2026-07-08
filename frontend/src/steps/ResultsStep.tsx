import { useEffect, useState } from "react";
import { SectionLabel, Card } from "@/components/AppShell";
import { getNutritionSnapshot, getNextCart, ApiError } from "@/lib/api";
import type { DimensionSnapshot, NextCartRecommendation, NutritionSnapshot } from "@/types/api";

const STATUS_TONE: Record<DimensionSnapshot["status"], string> = {
  low: "bg-amber-500",
  high: "bg-red-500",
  ok: "bg-emerald-500",
  info: "bg-zinc-400",
};

const CONFIDENCE_TONE: Record<string, string> = {
  high: "text-emerald-600",
  medium: "text-amber-600",
  low: "text-red-600",
};

function DimensionBar({ dim }: { dim: DimensionSnapshot }) {
  const pct = dim.ratio !== null ? Math.min(dim.ratio, 1.4) / 1.4 * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium capitalize tracking-tight">{dim.dimension}</p>
        <p className="text-xs text-ink/50">
          {dim.value !== null ? `${dim.value} ${dim.unit}` : "no data"}
        </p>
      </div>
      {dim.ratio !== null ? (
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full ${STATUS_TONE[dim.status]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      <p className="text-xs text-ink/50">{dim.what_this_means}</p>
    </div>
  );
}

function NextCartCard({ rec }: { rec: NextCartRecommendation }) {
  if (rec.status === "no_gaps") {
    return (
      <Card className="space-y-2">
        <SectionLabel>Next Cart</SectionLabel>
        <p className="text-lg font-medium tracking-tight">{rec.message}</p>
      </Card>
    );
  }

  if (rec.status === "no_suitable_candidate") {
    return (
      <Card className="space-y-3">
        <SectionLabel>Next Cart</SectionLabel>
        <p className="text-lg font-medium tracking-tight">{rec.message}</p>
        {rec.evaluated_candidates.length > 0 ? (
          <details className="text-xs text-ink/50">
            <summary className="cursor-pointer">
              Why nothing was suggested ({rec.evaluated_candidates.length} candidates checked)
            </summary>
            <ul className="mt-2 space-y-1">
              {rec.evaluated_candidates.map((c, i) => (
                <li key={i}>
                  · {c.item} — {c.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Next Cart · {rec.action_type}</SectionLabel>
        <span className={`text-[11px] uppercase tracking-widest ${CONFIDENCE_TONE[rec.confidence]}`}>
          {rec.confidence} confidence
        </span>
      </div>
      <p className="text-2xl font-medium tracking-tight">{rec.item}</p>
      <ul className="space-y-1.5">
        {rec.reasoning.map((r, i) => (
          <li key={i} className="text-sm text-ink/70">
            · {r}
          </li>
        ))}
      </ul>
      {rec.evaluated_candidates.length > 1 ? (
        <details className="text-xs text-ink/45">
          <summary className="cursor-pointer">
            {rec.evaluated_candidates.length} candidates considered
          </summary>
          <ul className="mt-2 space-y-1">
            {rec.evaluated_candidates.map((c, i) => (
              <li key={i}>
                · {c.item} — {c.allowed ? "allowed" : `blocked: ${c.reason}`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

export function ResultsStep({ profileId }: { profileId: string | null }) {
  const [snapshot, setSnapshot] = useState<NutritionSnapshot | null>(null);
  const [recommendation, setRecommendation] = useState<NextCartRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [snap, rec] = await Promise.all([
        getNutritionSnapshot(),
        getNextCart(profileId ?? undefined),
      ]);
      setSnapshot(snap);
      setRecommendation(rec);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load results.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <SectionLabel>Step 4 · Results</SectionLabel>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          Your basket, aggregated.
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">
          Combines every receipt you've uploaded so far — not just the last
          one.
        </p>
        <button
          type="button"
          onClick={load}
          className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200"
        >
          Refresh
        </button>
      </header>

      {loading ? <p className="text-sm text-ink/50">Loading…</p> : null}

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {snapshot ? (
        <>
          <div className="rounded-2xl bg-zinc-50 px-5 py-4 text-xs text-ink/60 ring-1 ring-black/5">
            {snapshot.disclaimer}
          </div>

          <Card className="space-y-1">
            <div className="flex items-center justify-between">
              <SectionLabel>
                Based on {snapshot.receipts_analyzed} receipt(s), {snapshot.items_analyzed} items
              </SectionLabel>
              <span className={`text-[11px] uppercase tracking-widest ${CONFIDENCE_TONE[snapshot.confidence]}`}>
                {snapshot.confidence} confidence
              </span>
            </div>
            <p className="text-xs text-ink/50">
              {snapshot.profile.items_matched} matched via OpenFoodFacts ·{" "}
              {snapshot.profile.items_fallback} estimated by category
            </p>
          </Card>

          <Card className="space-y-6">
            <SectionLabel>Nutrition snapshot</SectionLabel>
            {snapshot.dimensions.map((dim) => (
              <DimensionBar key={dim.dimension} dim={dim} />
            ))}
          </Card>

          {snapshot.gaps.length > 0 ? (
            <div className="space-y-4">
              <SectionLabel>Top gaps</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-1">
                {snapshot.gaps.map((gap) => (
                  <Card key={gap.dimension} className="space-y-1">
                    <p className="text-sm font-medium capitalize tracking-tight">
                      {gap.dimension} — {gap.status}
                    </p>
                    <p className="text-sm text-ink/70">{gap.message}</p>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {recommendation ? <NextCartCard rec={recommendation} /> : null}
    </section>
  );
}
