import { useEffect, useState } from "react";
import { SectionLabel, Card, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { getNutritionSnapshot, getNextCart, submitFeedback, ApiError } from "@/lib/api";
import type {
  DimensionSnapshot,
  FeedbackResponseValue,
  NextCartRecommendation,
  NutritionSnapshot,
  ProgressReport,
} from "@/types/api";

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

function confidenceText(confidence: string, t: (key: string) => string): string {
  return t(`results.confidence.${confidence}`);
}

function DimensionBar({ dim }: { dim: DimensionSnapshot }) {
  const { t } = useLanguage();
  const pct = dim.ratio !== null ? Math.min(dim.ratio, 1.4) / 1.4 * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium capitalize tracking-tight">{dim.dimension}</p>
        <p className="text-xs text-ink/50">
          {dim.value !== null ? `${dim.value} ${dim.unit}` : t("results.noData")}
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
  const { t } = useLanguage();

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
              {t("results.whyNothing")} ({rec.evaluated_candidates.length} {t("results.candidatesChecked")})
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
          {confidenceText(rec.confidence, t)}
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
            {rec.evaluated_candidates.length} {t("results.candidatesConsidered")}
          </summary>
          <ul className="mt-2 space-y-1">
            {rec.evaluated_candidates.map((c, i) => (
              <li key={i}>
                · {c.item} — {c.allowed ? t("results.allowed") : `${t("results.blocked")} ${c.reason}`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {rec.recipes.length > 0 ? (
        <div className="space-y-3 border-t border-black/5 pt-4">
          <SectionLabel>{t("results.recipesWith")} {rec.item}</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-3">
            {rec.recipes.map((recipe, i) => (
              <div key={i} className="rounded-xl bg-zinc-50 p-3 ring-1 ring-black/5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium tracking-tight">{recipe.title}</p>
                  {recipe.prep_minutes != null ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-widest text-ink/40">
                      {recipe.prep_minutes}m
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-ink/60">{recipe.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

const TREND_TONE: Record<ProgressReport["trend"], string> = {
  improving: "text-emerald-600",
  stable: "text-ink/60",
  declining: "text-red-600",
  insufficient_data: "text-ink/40",
};

function ProgressCard({ progress }: { progress: ProgressReport }) {
  const { t } = useLanguage();
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>{t("results.progressTitle")}</SectionLabel>
        {progress.has_history ? (
          <span className={`text-[11px] uppercase tracking-widest ${TREND_TONE[progress.trend]}`}>
            {t(`results.trend.${progress.trend}`)}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-ink/70">{progress.message}</p>
      {progress.deltas.length > 0 ? (
        <ul className="space-y-1 text-xs text-ink/60">
          {progress.deltas.map((d) => (
            <li key={d.dimension} className="capitalize">
              · {d.dimension}: {d.before ?? "—"} → {d.after ?? "—"} ({d.direction}
              {d.is_improvement === true ? `, ${t("results.improved")}` : ""}
              {d.is_improvement === false ? `, ${t("results.worse")}` : ""})
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11px] text-ink/40">{progress.disclaimer}</p>
    </Card>
  );
}

const FEEDBACK_OPTIONS: readonly FeedbackResponseValue[] = ["yes", "maybe", "no"];

function FeedbackWidget({ recommendationId }: { recommendationId: string }) {
  const [choice, setChoice] = useState<FeedbackResponseValue | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  async function submit(response: FeedbackResponseValue) {
    setChoice(response);
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback({
        recommendation_id: recommendationId,
        response,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      // Bug fix: `choice` used to stay set on failure, so the clicked
      // button kept looking "selected" even though nothing was saved.
      setChoice(null);
      setError(e instanceof ApiError ? e.message : t("results.feedbackError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="space-y-1">
        <SectionLabel>Feedback</SectionLabel>
        <p className="text-sm text-ink/70">{t("results.feedbackThanks")}</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <SectionLabel>{t("results.feedbackQuestion")}</SectionLabel>
      <div className="flex gap-2">
        {FEEDBACK_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt}
            disabled={submitting}
            onClick={() => submit(opt)}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-medium tracking-tight capitalize ring-1 transition-colors disabled:opacity-40",
              choice === opt
                ? "bg-ink text-canvas ring-ink"
                : "bg-zinc-50 text-ink/60 ring-black/5 hover:text-ink",
            )}
          >
            {t(`results.feedback.${opt}`)}
          </button>
        ))}
      </div>
      <input
        className={inputCls}
        placeholder={t("results.feedbackCommentPlaceholder")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={submitting}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </Card>
  );
}

export function ResultsStep({ profileId }: { profileId: string | null }) {
  const [snapshot, setSnapshot] = useState<NutritionSnapshot | null>(null);
  const [recommendation, setRecommendation] = useState<NextCartRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [snap, rec] = await Promise.all([
        getNutritionSnapshot(profileId ?? undefined),
        getNextCart(profileId ?? undefined),
      ]);
      setSnapshot(snap);
      setRecommendation(rec);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("results.loadFailed"));
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
        <SectionLabel>{t("results.step")}</SectionLabel>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          {t("results.title")}
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("results.body")}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200"
        >
          {t("results.refresh")}
        </button>
      </header>

      {loading ? <p className="text-sm text-ink/50">{t("results.loading")}</p> : null}

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {snapshot ? (
        <div className="rounded-2xl bg-zinc-50 px-5 py-4 text-xs text-ink/60 ring-1 ring-black/5">
          {snapshot.disclaimer}
        </div>
      ) : null}

      {/*
        Story 7.2: the recommendation is the primary outcome and goes
        above the detailed nutrition breakdown, not after it.
      */}
      {recommendation ? <NextCartCard rec={recommendation} /> : null}

      {recommendation?.progress ? <ProgressCard progress={recommendation.progress} /> : null}

      {recommendation?.status === "recommended" ? (
        <FeedbackWidget
          key={recommendation.recommendation_id}
          recommendationId={recommendation.recommendation_id}
        />
      ) : null}

      {snapshot ? (
        <>
          <Card className="space-y-1">
            <div className="flex items-center justify-between">
              <SectionLabel>
                {t("results.basedOnPrefix")} {snapshot.receipts_analyzed} {t("results.receiptsSuffix")}{" "}
                {snapshot.items_analyzed} {t("results.itemsSuffix")}
              </SectionLabel>
              <span className={`text-[11px] uppercase tracking-widest ${CONFIDENCE_TONE[snapshot.confidence]}`}>
                {confidenceText(snapshot.confidence, t)}
              </span>
            </div>
            <p className="text-xs text-ink/50">
              {snapshot.profile.items_matched} {t("results.matchedVia")}{" "}
              {snapshot.profile.items_fallback} {t("results.estimatedByCategory")}
            </p>
          </Card>

          <Card className="space-y-6">
            <SectionLabel>{t("results.nutritionSnapshot")}</SectionLabel>
            {snapshot.dimensions.map((dim) => (
              <DimensionBar key={dim.dimension} dim={dim} />
            ))}
          </Card>

          {snapshot.gaps.length > 0 ? (
            <div className="space-y-4">
              <SectionLabel>{t("results.topGaps")}</SectionLabel>
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
    </section>
  );
}
