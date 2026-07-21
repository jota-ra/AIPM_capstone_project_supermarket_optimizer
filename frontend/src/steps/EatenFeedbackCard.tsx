import { useEffect, useState } from "react";
import { Card, SectionLabel, PrimaryButton } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { getConsumptionContext, submitConsumptionFeedback } from "@/lib/api";
import type { ConsumptionContext, ConsumptionVariant } from "@/types/api";

// Epic 10 — eaten / consumption feedback (F10). One self-gating card used on
// two surfaces: variant A places it above the uploader (asked at the next
// upload), variant B places it on the Insights dashboard (daily). It fetches
// the sticky A/B variant + the prior receipt itself and renders *only* when
// this surface matches the user's variant AND a prior receipt exists — so
// dropping it into a page is enough; no per-page A/B logic needed.
//
// Only "Threw away" becomes waste (waste_fraction = 1.0 for that item);
// "Ate it" / "Still have" are non-waste (BR-I1). Writing it recomputes the
// status-quo, which sharpens gap detection & the health score.

type Choice = "eaten" | "have" | "thrown";

export function EatenFeedbackCard({
  surface,
  onSubmitted,
}: {
  surface: ConsumptionVariant;
  onSubmitted?: () => void;
}) {
  const { t } = useLanguage();
  const [ctx, setCtx] = useState<ConsumptionContext | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConsumptionContext()
      .then((c) => {
        if (cancelled) return;
        setCtx(c);
        // Default every prior item to "Ate it" (waste 0 = today's behaviour).
        const initial: Record<string, Choice> = {};
        for (const it of c.prior_receipt?.items ?? []) {
          initial[it.item_id] = it.waste_fraction >= 1 ? "thrown" : "eaten";
        }
        setChoices(initial);
      })
      .catch(() => {
        /* non-blocking: a context failure just hides the card */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Self-gate: only show on the matching surface, with a prior receipt,
  // before it's been answered or dismissed this session.
  if (!ctx || ctx.variant !== surface || !ctx.prior_receipt || done || dismissed) {
    return null;
  }
  const prior = ctx.prior_receipt;
  if (prior.items.length === 0) return null;

  async function submit() {
    if (!ctx?.prior_receipt) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = ctx.prior_receipt.items.map((it) => ({
        item_id: it.item_id,
        waste_fraction: choices[it.item_id] === "thrown" ? 1.0 : 0.0,
      }));
      await submitConsumptionFeedback({ receipt_id: ctx.prior_receipt.receipt_id, items });
      setDone(true);
      onSubmitted?.();
    } catch {
      setError(t("eaten.error"));
    } finally {
      setSubmitting(false);
    }
  }

  const CHOICES: { key: Choice; label: string }[] = [
    { key: "eaten", label: t("eaten.itemEaten") },
    { key: "have", label: t("eaten.itemHave") },
    { key: "thrown", label: t("eaten.itemThrown") },
  ];

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <SectionLabel>{surface === "A" ? t("eaten.titleA") : t("eaten.titleB")}</SectionLabel>
        <p className="text-sm text-ink/60">{t("eaten.body")}</p>
      </div>

      <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
        {prior.items.map((it) => (
          <div
            key={it.item_id}
            className="flex flex-col gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-black/5 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium tracking-tight text-ink">
              {it.name}
              {it.quantity ? (
                <span className="ml-1 text-xs font-normal text-ink/40">
                  {it.quantity}
                  {it.unit ? ` ${it.unit}` : ""}
                </span>
              ) : null}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CHOICES.map((c) => {
                const selected = choices[it.item_id] === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setChoices((prev) => ({ ...prev, [it.item_id]: c.key }))}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium tracking-tight ring-1 transition-colors",
                      selected
                        ? c.key === "thrown"
                          ? "bg-red-500 text-white ring-red-500"
                          : "bg-ink text-canvas ring-ink"
                        : "bg-white text-ink/60 ring-black/10 hover:text-ink",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex items-center gap-3">
        <PrimaryButton type="button" disabled={submitting} onClick={submit} className="w-auto px-6">
          {submitting ? t("eaten.saving") : t("eaten.submit")}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
        >
          {t("eaten.skip")}
        </button>
      </div>
    </Card>
  );
}
