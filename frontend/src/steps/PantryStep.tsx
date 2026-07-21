import { useEffect, useRef, useState } from "react";
import { SectionLabel, Card, PrimaryButton, inputCls } from "@/components/AppShell";
import type { StepId } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  getPantry,
  getNextCart,
  removePantryItem,
  updatePantryItemMetadata,
  uploadReceiptFiles,
  uploadReceiptText,
  receiptErrorKey,
  consumePantryItem,
  ApiError,
} from "@/lib/api";
import { EatenFeedbackCard } from "@/steps/EatenFeedbackCard";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
import type { PantryItem, UploadReceiptResponse, PantryMatch } from "@/types/api";

// "Lager" — menu restructure: this used to be one combined page (stock
// list + day-by-day consumption log). The day-log half moved out to its
// own "Tagebuch" (DiaryStep.tsx) — confirming what you *ate* is a diary
// action, not a stock-management one. What's left here is purely "what
// do I have": the inventory list (correct/discard) plus adding a new
// receipt, which used to be a separate "Upload" page/nav destination —
// merged in since adding stock and managing stock are the same job.

const quantityInputCls =
  "w-20 rounded-lg bg-zinc-50 px-2 py-1.5 text-sm text-ink ring-1 ring-black/5 outline-none focus:ring-ink/30";

// Mirrors backend fallback_categories.CATEGORY_NUTRITION's key set — the
// only categories the shelf-life/gram-conversion lookups recognize
// (Epic 12.3, updatePantryItemMetadata falls back to "other" for anything else).
const PANTRY_CATEGORIES = [
  "dairy",
  "grain",
  "vegetable",
  "fruit",
  "protein",
  "snack",
  "drink",
  "other",
] as const;

// Icon system stays emoji (no icon library) per the corporate-design
// pass — this was the one real gap: category *names* existed already,
// but nothing visually distinguished them at a glance.
export const CATEGORY_ICON: Record<(typeof PANTRY_CATEGORIES)[number], string> = {
  dairy: "🥛",
  grain: "🌾",
  vegetable: "🥦",
  fruit: "🍎",
  protein: "🍗",
  snack: "🍪",
  drink: "🥤",
  other: "📦",
};

// Shelf-life is an estimate (see backend services/shelf_life.py) based on
// category + when this item was last replenished — not a food-safety
// guarantee, just an "expiring soon" nudge, so the tone stays cautious
// ("expires in") rather than alarming.
function ExpiryTag({ daysUntilExpiry }: { daysUntilExpiry: number | null | undefined }) {
  const { t } = useLanguage();
  if (daysUntilExpiry === null || daysUntilExpiry === undefined) return null;

  if (daysUntilExpiry < 0) {
    return (
      <span className="text-red-600">
        {t("pantry.expiredAgo").replace("{days}", String(Math.abs(daysUntilExpiry)))}
      </span>
    );
  }
  if (daysUntilExpiry === 0) {
    return <span className="text-amber-600">{t("pantry.expiresToday")}</span>;
  }
  return (
    <span className={daysUntilExpiry <= 2 ? "text-amber-600" : "text-ink/50"}>
      {t("pantry.expiresIn").replace("{days}", String(daysUntilExpiry))}
    </span>
  );
}

function PantryRow({
  item,
  onRemove,
  onEditMetadata,
}: {
  item: PantryItem;
  onRemove: (name: string, quantity: number) => Promise<void>;
  onEditMetadata: (name: string, unit: string, category: string) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity_available));
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [unit, setUnit] = useState(item.unit ?? "");
  const [category, setCategory] = useState(item.category ?? "other");
  const { t } = useLanguage();

  const parsed = Number(quantity);
  const validQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  async function handleRemove() {
    if (validQuantity === null) return;
    setBusy(true);
    try {
      await onRemove(item.normalized_name, Math.min(validQuantity, item.quantity_available));
    } finally {
      setBusy(false);
    }
  }

  async function saveMetadata() {
    setBusy(true);
    try {
      await onEditMetadata(item.normalized_name, unit, category);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="space-y-3 px-5 py-4">
        <p className="text-sm font-medium tracking-tight">{item.normalized_name}</p>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t("pantry.quantityLabel")}
            disabled={busy}
          />
          <select
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
          >
            {PANTRY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`pantry.category.${cat}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveMetadata}
            disabled={busy}
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas disabled:opacity-40"
          >
            {t("review.save")}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={busy}
            className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5"
          >
            {t("review.cancel")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium tracking-tight">{item.normalized_name}</p>
        <p className="truncate text-xs text-ink/50">
          {item.quantity_available} {item.unit ?? ""} · {item.category ?? t("review.uncategorized")}
          {item.days_until_expiry !== null && item.days_until_expiry !== undefined ? (
            <>
              {" · "}
              <ExpiryTag daysUntilExpiry={item.days_until_expiry} />
            </>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="number"
          min={0}
          max={item.quantity_available}
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={busy}
          className={quantityInputCls}
          aria-label={t("pantry.quantityLabel")}
        />
        <button
          type="button"
          disabled={busy || validQuantity === null}
          onClick={handleRemove}
          className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200 disabled:opacity-40"
        >
          {t("pantry.remove")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(true)}
          className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200 disabled:opacity-40"
        >
          {t("review.edit")}
        </button>
      </div>
    </li>
  );
}

type UploadMode = "image" | "text";

function UploadSection({
  onUploaded,
}: {
  // Every successfully-parsed receipt from this upload (E5: Review pages
  // through all of them, one at a time) — not just the first.
  onUploaded: (receiptIds: string[]) => void;
}) {
  const [mode, setMode] = useState<UploadMode>("image");
  const [dragOver, setDragOver] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadReceiptResponse | null>(null);
  const [okReceiptIds, setOkReceiptIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [multiSummary, setMultiSummary] = useState<{ ok: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  // E3-S1: each selected file is uploaded as its own receipt (sequential),
  // so one bad file never sinks the batch. The preview below shows the
  // first that parsed; every one that parsed carries through to Review.
  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setMultiSummary(null);
    setOkReceiptIds([]);
    setProgress(files.length > 1 ? { done: 0, total: files.length } : null);
    try {
      const results = await uploadReceiptFiles(files, (done, total) =>
        setProgress(total > 1 ? { done, total } : null),
      );
      const okResults = results.filter((r) => r.ok && r.response);
      if (okResults.length > 0) {
        setResult(okResults[0].response!);
        setOkReceiptIds(okResults.map((r) => r.response!.receipt_id));
        if (results.length > 1) setMultiSummary({ ok: okResults.length, total: results.length });
      } else {
        const failed = results.find((r) => !r.ok);
        setError(t(failed?.errorKey ?? "upload.uploadFailed"));
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function handleTextSubmit() {
    if (!pastedText.trim()) return;
    setLoading(true);
    setError(null);
    setOkReceiptIds([]);
    try {
      const res = await uploadReceiptText(pastedText);
      setResult(res);
      setOkReceiptIds([res.receipt_id]);
    } catch (e) {
      setError(e instanceof ApiError ? t(receiptErrorKey(e)) : t("upload.uploadFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <SectionLabel>{t("pantry.uploadSectionTitle")}</SectionLabel>

      <div className="flex gap-2 rounded-full bg-zinc-50 p-1 ring-1 ring-black/5 w-fit">
        {(["image", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setResult(null);
              setOkReceiptIds([]);
              setError(null);
            }}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-medium tracking-tight transition-colors",
              mode === m ? "bg-ink text-canvas" : "text-ink/55 hover:text-ink",
            )}
          >
            {m === "image" ? t("upload.tabPhoto") : t("upload.tabText")}
          </button>
        ))}
      </div>

      {mode === "image" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const files = Array.from(e.dataTransfer.files ?? []);
            if (files.length) handleFiles(files);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={cn(
            "block w-full cursor-pointer rounded-3xl border border-dashed p-10 text-center transition-colors",
            dragOver ? "border-ink/50 bg-zinc-50" : "border-ink/20 bg-zinc-50 hover:border-ink/40",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) handleFiles(files);
            }}
          />
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-white ring-1 ring-black/5">
            <span className="text-lg text-ink/60">↑</span>
          </div>
          <p className="text-sm font-medium tracking-tight">
            {loading
              ? progress
                ? t("upload.progress").replace("{done}", String(progress.done)).replace("{total}", String(progress.total))
                : t("upload.dropUploading")
              : t("upload.dropTitle")}
          </p>
          <p className="mt-1 text-xs text-ink/50">{t("upload.dropHint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <textarea
            className={cn(inputCls, "min-h-32 resize-y font-mono text-xs")}
            placeholder={"REWE Markt GmbH\nVollmilch 3,5% 1L    1,29\nVollkornbrot 500g    1,99\n..."}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <PrimaryButton onClick={handleTextSubmit} disabled={loading || !pastedText.trim()}>
            {loading ? t("upload.analyzing") : t("upload.analyzeButton")}
          </PrimaryButton>
        </div>
      )}

      {error ? (
        <div className="space-y-3 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          <p>{error}</p>
          {mode === "image" ? (
            <button
              type="button"
              onClick={() => {
                setMode("text");
                setError(null);
              }}
              className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-medium tracking-tight text-red-800 hover:bg-red-200"
            >
              {t("upload.pasteInstead")}
            </button>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4 border-t border-black/5 pt-4">
          {multiSummary ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
              {t("upload.multiDone")
                .replace("{ok}", String(multiSummary.ok))
                .replace("{total}", String(multiSummary.total))}
            </p>
          ) : null}
          <div className="flex items-center justify-between">
            <SectionLabel>
              {result.parsed.store}
              {result.parsed.date ? ` · ${result.parsed.date}` : ""} ({result.parsed.scan_quality})
            </SectionLabel>
            <span className="text-xs text-ink/40">
              {result.parsed.items_count} {t("upload.itemsSuffix")}
            </span>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {result.parsed.items.map((item, i) => (
              <li key={i} className="text-sm text-ink/70">
                · {item.name}
                <span className="ml-1 text-xs text-ink/40">
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                  {item.price != null ? ` · ${item.price.toFixed(2)} €` : ""}
                </span>
                {item.uncertain ? (
                  <span className="ml-1 text-[10px] uppercase tracking-widest text-ink/35">
                    {t("upload.uncertainTag")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <PrimaryButton onClick={() => onUploaded(okReceiptIds)}>
            {t("upload.reviewButton")}
          </PrimaryButton>
        </div>
      ) : null}
    </Card>
  );
}

// Groups items by category (fixed order, matching PANTRY_CATEGORIES) so
// the overview reads as "what kind of food do I have" instead of one
// long alphabetical list — each group is a native <details> section,
// expanded by default, collapsible per category.
//
// Any category outside the known set (e.g. a legacy German category, or a
// value the mapper didn't canonicalize) falls into "other" so NO pantry
// item is ever silently hidden from the overview.
const _KNOWN_CATEGORIES = new Set<string>(PANTRY_CATEGORIES);

function _bucketOf(category: string | null | undefined): (typeof PANTRY_CATEGORIES)[number] {
  const c = category ?? "other";
  return (_KNOWN_CATEGORIES.has(c) ? c : "other") as (typeof PANTRY_CATEGORIES)[number];
}

function groupByCategory(items: PantryItem[]): { category: (typeof PANTRY_CATEGORIES)[number]; items: PantryItem[] }[] {
  return PANTRY_CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => _bucketOf(item.category) === category),
  })).filter((group) => group.items.length > 0);
}

// "Use what you already have" — moved here from Insights (ResultsStep.tsx):
// it's a pick from your own stock, not a nutrition-analysis output, so it
// belongs on the page that's actually about your stock. Fed by GET
// /next-cart's `pantry_match` (same backend data as before, just
// requested from here now).
function PantryMatchCard({ match, onConsumed }: { match: PantryMatch; onConsumed: () => Promise<void> }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function handleConsume() {
    setBusy(true);
    try {
      await consumePantryItem(match.item, 1);
      await onConsumed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={cn(
        "space-y-3",
        match.urgent ? "bg-amber-50 ring-1 ring-amber-200" : "bg-emerald-50 ring-1 ring-emerald-200",
      )}
    >
      <div className="flex items-center justify-between">
        <SectionLabel>{t("results.pantryMatch")}</SectionLabel>
        {match.urgent ? (
          <span className="text-[11px] uppercase tracking-widest text-amber-700">
            {t("results.pantryMatchUrgent")}
          </span>
        ) : null}
      </div>
      <p className="text-lg font-medium tracking-tight">{match.item}</p>
      <p className="text-sm text-ink/70">{match.message}</p>
      <button
        type="button"
        disabled={busy}
        onClick={handleConsume}
        className="rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas disabled:opacity-40"
      >
        {t("pantry.consumed")}
      </button>
    </Card>
  );
}

export function PantryStep({
  profileId,
  onUploaded,
  onNavigate,
}: {
  profileId: string | null;
  onUploaded: (receiptIds: string[]) => void;
  // Cross-link to Insights — adding/removing stock changes your gaps,
  // so it's worth a direct way back without hunting for the nav tab.
  onNavigate?: (step: StepId) => void;
}) {
  const [items, setItems] = useState<PantryItem[] | null>(null);
  const [pantryMatch, setPantryMatch] = useState<PantryMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  async function loadPantry() {
    setError(null);
    try {
      const res = await getPantry();
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("pantry.loadFailed"));
    }
  }

  async function loadPantryMatch() {
    try {
      // include_coach=false: this page only shows pantry_match, so there's
      // no reason to spend a Gemini coach request here.
      const rec = await getNextCart(profileId ?? undefined, false);
      setPantryMatch(rec.pantry_match);
    } catch {
      // 409 (no receipts analysed yet) is a normal, common state here —
      // just means nothing to suggest from stock yet, not a page error.
      setPantryMatch(null);
    }
  }

  useEffect(() => {
    loadPantry();
    loadPantryMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRemove(name: string, quantity: number) {
    await removePantryItem(name, quantity);
    await loadPantry();
  }

  async function handleEditMetadata(name: string, unit: string, category: string) {
    await updatePantryItemMetadata(name, { unit: unit || undefined, category });
    await loadPantry();
  }

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <SectionLabel>{t("pantry.step")}</SectionLabel>
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate("results")}
              className="shrink-0 text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
            >
              {t("results.viewInsights")}
            </button>
          ) : null}
        </div>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          {t("pantry.title")}
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("pantry.body")}</p>
      </header>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {pantryMatch ? (
        <PantryMatchCard
          match={pantryMatch}
          onConsumed={async () => {
            await loadPantry();
            await loadPantryMatch();
          }}
        />
      ) : null}

      {/* E10 variant A: before uploading the next shop, ask what became of
          the previous one (self-gates to variant-A users with a prior
          receipt; renders nothing otherwise). */}
      <EatenFeedbackCard surface="A" />

      <UploadSection
        onUploaded={(receiptIds) => {
          onUploaded(receiptIds);
          // The uploaded items land in the pantry once the review step
          // (App.tsx routes there next) confirms them — refresh here too
          // so coming back to Pantry directly (browser back) isn't stale.
          loadPantry();
        }}
      />

      {items === null && !error ? (
        <p className="text-sm text-ink/50">{t("pantry.loading")}</p>
      ) : null}

      {items && items.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm text-ink/60">{t("pantry.empty")}</p>
          {onNavigate ? (
            <PrimaryButton type="button" className="w-auto px-6" onClick={() => onNavigate("onboardingUpload")}>
              {t("pantry.emptyUploadCta")}
            </PrimaryButton>
          ) : null}
        </Card>
      ) : null}

      {items && items.length > 0 ? (
        <div className="space-y-3">
          {groupByCategory(items).map((group) => (
            <details
              key={group.category}
              open
              className="overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5"
            >
              <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-3 text-sm font-medium tracking-tight marker:content-none">
                <span className="flex items-center gap-2">
                  <span aria-hidden>{CATEGORY_ICON[group.category]}</span>
                  {t(`pantry.category.${group.category}`)}
                </span>
                <span className="text-xs font-normal text-ink/40">{group.items.length}</span>
              </summary>
              <ul className="divide-y divide-black/5 border-t border-black/5">
                {group.items.map((item) => (
                  <PantryRow
                    key={item.id}
                    item={item}
                    onRemove={handleRemove}
                    onEditMetadata={handleEditMetadata}
                  />
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}
