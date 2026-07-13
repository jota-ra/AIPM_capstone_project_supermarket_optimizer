import { useEffect, useState } from "react";
import { SectionLabel, Card, inputCls } from "@/components/AppShell";
import type { StepId } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  getNutritionSnapshot,
  getNextCart,
  getProfile,
  getPantry,
  submitFeedback,
  ApiError,
} from "@/lib/api";
import type {
  AbsoluteGap,
  Conflict,
  DimensionSnapshot,
  FeedbackResponseValue,
  Gap,
  HealthScore,
  NextCartRecommendation,
  NutritionSnapshot,
  ProgressReport,
} from "@/types/api";

// Menu restructure: this page absorbed DashboardStep.tsx's mockup
// content (greeting, inactivity reminder, promoted trend/recipe cards)
// — "Results" and "Dashboard" are now one merged "Overview" home instead
// of two separate destinations that repeated the same coach insight.
const REMINDER_THRESHOLD_DAYS = 3;

const HEALTH_SCORE_TONE: Record<HealthScore["label"], string> = {
  great: "text-emerald-600",
  good: "text-emerald-600",
  needs_improvement: "text-amber-600",
  poor: "text-red-600",
};

const HEALTH_SCORE_BAR_TONE: Record<HealthScore["label"], string> = {
  great: "bg-emerald-500",
  good: "bg-emerald-500",
  needs_improvement: "bg-amber-500",
  poor: "bg-red-500",
};

const COST_TONE: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-red-600",
};

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

// Epic 14.2: one combined "Nährstoff-Status" list instead of two
// separate sections — density gaps (ratio-only) and absolute gaps
// (real daily units) are still fundamentally different data (see
// backend models/absolute_gap.py's docstring on why they're kept
// separate there), so each entry shows its own unit inline rather than
// pretending they're the same kind of number.
function NutrientStatusList({
  gaps,
  absoluteGaps,
}: {
  gaps: Gap[];
  absoluteGaps: AbsoluteGap[];
}) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-4 sm:grid-cols-1">
      {gaps.map((gap) => (
        <Card key={`density-${gap.dimension}`} className="space-y-1">
          <p className="text-sm font-medium capitalize tracking-tight">
            {gap.dimension} — {gap.status}
          </p>
          <p className="text-sm text-ink/70">{gap.message}</p>
        </Card>
      ))}
      {absoluteGaps.map((gap) => (
        <Card key={`absolute-${gap.dimension}`} className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium capitalize tracking-tight">
              {gap.dimension} — {gap.status}
            </p>
            <span className={`text-[11px] uppercase tracking-widest ${CONFIDENCE_TONE[gap.confidence]}`}>
              {confidenceText(gap.confidence, t)}
            </span>
          </div>
          <p className="text-sm text-ink/70">{gap.message}</p>
          <p className="text-xs text-ink/40">
            {gap.daily_estimate} / {gap.daily_requirement} per day ({Math.round(gap.ratio * 100)}%)
          </p>
        </Card>
      ))}
    </div>
  );
}

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

function CoachMessageCard({ message }: { message: string }) {
  const { t } = useLanguage();
  if (!message) return null;
  return (
    <Card className="space-y-2 bg-ink text-canvas">
      <span className="text-xs font-medium uppercase tracking-widest text-canvas/50">
        {t("results.coach")}
      </span>
      <p className="text-base leading-relaxed">{message}</p>
    </Card>
  );
}

function ConflictsCard({
  conflicts,
  onEditProfile,
}: {
  conflicts: Conflict[];
  onEditProfile?: () => void;
}) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = conflicts.filter((c) => !dismissed.has(c.item));

  if (visible.length === 0) return null;

  return (
    <Card className="space-y-3 bg-amber-50 ring-1 ring-amber-200">
      <SectionLabel>{t("results.conflicts")}</SectionLabel>
      <p className="text-sm text-ink/70">{t("results.conflictsIntro")}</p>
      <ul className="space-y-3">
        {visible.map((c) => (
          <li key={c.item} className="space-y-2 rounded-xl bg-white/70 p-3 ring-1 ring-black/5">
            <p className="text-sm text-ink/80">{c.message}</p>
            <div className="flex flex-wrap gap-2">
              {onEditProfile ? (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium tracking-tight text-canvas"
                >
                  {t("results.conflictChanged")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDismissed((prev) => new Set(prev).add(c.item))}
                className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200"
              >
                {t("results.conflictSomeoneElse")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HealthScoreCard({ score }: { score: HealthScore }) {
  const { t } = useLanguage();
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>{t("results.healthScore")}</SectionLabel>
        <span className={`text-xs font-medium uppercase tracking-widest ${HEALTH_SCORE_TONE[score.label]}`}>
          {t(`results.healthScore.${score.label}`)}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-4xl font-medium tracking-tight">{score.value}</p>
        <p className="text-sm text-ink/40">/ 100</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full ${HEALTH_SCORE_BAR_TONE[score.label]}`}
          style={{ width: `${score.value}%` }}
        />
      </div>
      <p className="text-sm text-ink/70">{score.summary}</p>
    </Card>
  );
}

function EasySwapsCard({ swaps }: { swaps: NextCartRecommendation["easy_swaps"] }) {
  const { t } = useLanguage();
  return (
    <Card className="space-y-3">
      <SectionLabel>{t("results.easySwaps")}</SectionLabel>
      <ul className="divide-y divide-black/5">
        {swaps.map((swap, i) => (
          <li key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium tracking-tight">{swap.item}</p>
              <p className="text-xs text-ink/60">{swap.rationale}</p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-ink/40">
                {t("results.targets")} {swap.targets_gap}
              </p>
            </div>
            <span className={`shrink-0 text-[11px] uppercase tracking-widest ${COST_TONE[swap.cost]}`}>
              {t(`results.cost.${swap.cost}`)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NextCartCard({ rec }: { rec: NextCartRecommendation }) {
  const { t } = useLanguage();

  if (rec.status === "no_gaps") {
    return (
      <Card className="space-y-2">
        <SectionLabel>{t("results.nextCart")}</SectionLabel>
        <p className="text-lg font-medium tracking-tight">{rec.message}</p>
      </Card>
    );
  }

  if (rec.status === "no_suitable_candidate") {
    return (
      <Card className="space-y-3">
        <SectionLabel>{t("results.nextCart")}</SectionLabel>
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
        <SectionLabel>{t("results.nextCart")} · {rec.action_type}</SectionLabel>
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

function PantryRecipesCard({
  recipes,
  onNavigate,
}: {
  recipes: NextCartRecommendation["pantry_recipes"];
  onNavigate?: (step: StepId) => void;
}) {
  const { t } = useLanguage();
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>{t("results.pantryRecipes")}</SectionLabel>
        {/* Cross-link: cooking one of these implies eating it now — a
            direct shortcut into the Diary saves hunting for the nav tab
            at exactly the moment it's relevant. */}
        {onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate("diary")}
            className="text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
          >
            {t("results.logInDiary")}
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {recipes.map((recipe, i) => (
          <div key={i} className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
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
      {progress.absolute_deltas.filter((d) => d.direction !== "unknown").length > 0 ? (
        <div className="space-y-1 border-t border-black/5 pt-3">
          <p className="text-[11px] uppercase tracking-widest text-ink/40">
            {t("results.absoluteProgress")}
          </p>
          <ul className="space-y-1 text-xs text-ink/60">
            {progress.absolute_deltas
              .filter((d) => d.direction !== "unknown")
              .map((d) => (
                <li key={d.dimension} className="capitalize">
                  · {d.dimension}: {d.before ?? "—"} → {d.after ?? "—"} ({d.direction}
                  {d.is_improvement === true ? `, ${t("results.improved")}` : ""}
                  {d.is_improvement === false ? `, ${t("results.worse")}` : ""})
                </li>
              ))}
          </ul>
        </div>
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
        <SectionLabel>{t("results.feedbackLabel")}</SectionLabel>
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

export function ResultsStep({
  profileId,
  onEditProfile,
  onNavigate,
}: {
  profileId: string | null;
  onEditProfile?: () => void;
  // Reminder banner's CTA jumps to the Diary ("Tagebuch") page, since
  // that's where confirming consumption now lives (see DiaryStep.tsx).
  onNavigate?: (step: StepId) => void;
}) {
  const [snapshot, setSnapshot] = useState<NutritionSnapshot | null>(null);
  const [recommendation, setRecommendation] = useState<NextCartRecommendation | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [daysSinceLastConfirmation, setDaysSinceLastConfirmation] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True specifically for the "no receipts yet" 409 the backend returns
  // when there's nothing to analyse — distinct from a real failure
  // (`error`, below). In this state the page still renders its normal
  // shape (greeting, placeholder cards) instead of just an error line,
  // so a brand-new session sees what Insights *will* look like rather
  // than a dead end.
  const [noData, setNoData] = useState(false);
  const [loading, setLoading] = useState(true);
  // Epic 14.1: collapsed by default so the page reads as a short "here's
  // where you stand" summary first, not a wall of cards.
  const [showDetails, setShowDetails] = useState(false);
  // Epic 14.3: nested toggle — even once Details is open, the raw
  // dimension bars are the most technical/skippable part of it.
  const [showDimensions, setShowDimensions] = useState(false);
  const { t } = useLanguage();

  async function load() {
    setLoading(true);
    setError(null);
    setNoData(false);

    // allSettled, not all — a "no receipts yet" 409 on snapshot/next-cart
    // shouldn't also block the independent pantry fetch (the reminder
    // banner should still work) or the profile name fetch (the greeting
    // should still be personalized) below.
    const [snapResult, recResult, pantryResult] = await Promise.allSettled([
      getNutritionSnapshot(profileId ?? undefined),
      getNextCart(profileId ?? undefined),
      getPantry(),
    ]);

    setSnapshot(snapResult.status === "fulfilled" ? snapResult.value : null);
    setRecommendation(recResult.status === "fulfilled" ? recResult.value : null);
    setDaysSinceLastConfirmation(
      pantryResult.status === "fulfilled" ? pantryResult.value.days_since_last_confirmation : null,
    );

    const is409 = (result: PromiseSettledResult<unknown>) =>
      result.status === "rejected" && result.reason instanceof ApiError && result.reason.status === 409;

    if (is409(snapResult) || is409(recResult)) {
      setNoData(true);
    } else if (snapResult.status === "rejected") {
      setError(snapResult.reason instanceof ApiError ? snapResult.reason.message : t("results.loadFailed"));
    } else if (recResult.status === "rejected") {
      setError(recResult.reason instanceof ApiError ? recResult.reason.message : t("results.loadFailed"));
    }

    if (profileId) {
      // Best-effort: a stale/invalid profileId shouldn't break the
      // rest of the page, it just falls back to the name-less greeting.
      getProfile(profileId)
        .then((p) => setProfileName(p.name ?? null))
        .catch(() => setProfileName(null));
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const greeting = profileName
    ? `Hi ${profileName} 👋`
    : `${t("results.greetingFallback")} 👋`;

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <SectionLabel>{t("results.step")}</SectionLabel>
            <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">{greeting}</h1>
          </div>
          {snapshot ? (
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-surface px-4 py-2 ring-1 ring-black/5">
              <span className="text-xs uppercase tracking-widest text-ink/40">{t("results.healthScore")}</span>
              <span
                className={cn(
                  "text-lg font-semibold tracking-tight",
                  HEALTH_SCORE_TONE[snapshot.health_score.label],
                )}
              >
                {snapshot.health_score.value}
              </span>
            </div>
          ) : null}
        </div>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("results.body")}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200"
        >
          {t("results.refresh")}
        </button>
      </header>

      {/* Promoted from DashboardStep.tsx's mockup: the inactivity nudge
          now lives on the merged home page, pointing at the Diary
          ("Tagebuch") page where confirming consumption actually happens. */}
      {daysSinceLastConfirmation !== null && daysSinceLastConfirmation >= REMINDER_THRESHOLD_DAYS ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <p>{t("results.reminderText").replace("{days}", String(daysSinceLastConfirmation))}</p>
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate("diary")}
              className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-xs font-medium tracking-tight text-white hover:opacity-90"
            >
              {t("results.reminderCta")}
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? <p className="text-sm text-ink/50">{t("results.loading")}</p> : null}

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {/* "No receipts yet" placeholder: shows the page's actual shape
          (same cards, same order) instead of a bare error line, each
          one clearly marked as empty rather than populated with
          invented numbers. */}
      {noData ? (
        <>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-50 px-5 py-4 text-sm text-ink/60 ring-1 ring-black/5">
            <p>{t("results.noDataNotice")}</p>
            {onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate("pantry")}
                className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas hover:opacity-90"
              >
                {t("results.noDataCta")}
              </button>
            ) : null}
          </div>

          <Card className="space-y-2 bg-ink text-canvas opacity-50">
            <span className="text-xs font-medium uppercase tracking-widest text-canvas/50">
              {t("results.coach")}
            </span>
            <p className="text-base leading-relaxed">{t("results.noDataPlaceholderCoach")}</p>
          </Card>

          <Card className="space-y-3 opacity-50">
            <SectionLabel>{t("results.healthScore")}</SectionLabel>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-medium tracking-tight">—</p>
              <p className="text-sm text-ink/40">/ 100</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100" />
            <p className="text-sm text-ink/50">{t("results.noDataPlaceholderScore")}</p>
          </Card>

          <Card className="space-y-3 opacity-50">
            <SectionLabel>{t("results.nextCart")}</SectionLabel>
            <p className="text-2xl font-medium tracking-tight text-ink/30">—</p>
            <p className="text-sm text-ink/50">{t("results.noDataPlaceholderNextCart")}</p>
          </Card>
        </>
      ) : null}

      {snapshot ? (
        <div className="rounded-2xl bg-zinc-50 px-5 py-4 text-xs text-ink/60 ring-1 ring-black/5">
          {snapshot.disclaimer}
        </div>
      ) : null}

      {/*
        The coach's voice greets first — a warm phrasing of everything
        below, computed once both snapshot and recommendation are in.
      */}
      {recommendation?.coach_message ? (
        <CoachMessageCard message={recommendation.coach_message} />
      ) : null}

      {/*
        Status quo first: "where do you stand" (Health Score) before the
        single deliberate Next Cart pick — the score is the entry point,
        the recommendation is the primary *action*.
      */}
      {snapshot && snapshot.conflicts.length > 0 ? (
        <ConflictsCard conflicts={snapshot.conflicts} onEditProfile={onEditProfile} />
      ) : null}

      {snapshot ? <HealthScoreCard score={snapshot.health_score} /> : null}

      {/* Menu restructure: the "use what you already have" pantry-match
          pick moved to the Pantry ("My Pantry") page — it's about your
          stock, not the nutrition analysis this page is for. See
          PantryStep.tsx's own PantryMatchCard. */}
      {recommendation ? <NextCartCard rec={recommendation} /> : null}

      {recommendation?.status === "recommended" ? (
        <FeedbackWidget
          key={recommendation.recommendation_id}
          recommendationId={recommendation.recommendation_id}
        />
      ) : null}

      {/* Promoted out of the details-only section (menu restructure):
          weekly trend and pantry-recipe suggestions are quick-glance
          items from the old Dashboard mockup, not technical detail —
          they stay visible without needing "Show details". */}
      {recommendation?.progress ? <ProgressCard progress={recommendation.progress} /> : null}

      {recommendation && recommendation.pantry_recipes.length > 0 ? (
        <PantryRecipesCard recipes={recommendation.pantry_recipes} onNavigate={onNavigate} />
      ) : null}

      {/* Epic 14.1: everything below is secondary/technical detail — collapsed by default. */}
      {snapshot || recommendation ? (
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200"
        >
          {showDetails ? t("results.hideDetails") : t("results.showDetails")}
        </button>
      ) : null}

      {showDetails ? (
        <>
          {recommendation && recommendation.easy_swaps.length > 0 ? (
            <EasySwapsCard swaps={recommendation.easy_swaps} />
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

              {/* Epic 14.3: nested toggle — raw dimension bars are the most technical part. */}
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <SectionLabel>{t("results.nutritionSnapshot")}</SectionLabel>
                  <button
                    type="button"
                    onClick={() => setShowDimensions((v) => !v)}
                    className="text-[11px] uppercase tracking-widest text-ink/40 hover:text-ink"
                  >
                    {showDimensions ? t("results.hideDetails") : t("results.showDetails")}
                  </button>
                </div>
                {showDimensions ? (
                  <div className="space-y-6">
                    {snapshot.dimensions.map((dim) => (
                      <DimensionBar key={dim.dimension} dim={dim} />
                    ))}
                  </div>
                ) : null}
              </Card>

              {/* Epic 14.2: density gaps + absolute gaps in one combined list. */}
              {snapshot.gaps.length > 0 || snapshot.absolute_gaps.length > 0 ? (
                <div className="space-y-4">
                  <SectionLabel>{t("results.nutrientStatus")}</SectionLabel>
                  <NutrientStatusList gaps={snapshot.gaps} absoluteGaps={snapshot.absolute_gaps} />
                </div>
              ) : (
                <div className="rounded-2xl bg-zinc-50 px-5 py-4 text-xs text-ink/50 ring-1 ring-black/5">
                  {snapshot.has_sufficient_data
                    ? t("results.absoluteGapsNoneFound")
                    : t("results.absoluteGapsNoData")}
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
