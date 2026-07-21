import { useEffect, useState } from "react";
import { SectionLabel, Card, PrimaryButton, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  getReceipt,
  getReceiptImageUrl,
  deleteReceiptImage,
  updateReceiptItem,
  searchProducts,
  pickItemMatch,
  flagNoMatch,
  markItemNonFood,
  ApiError,
} from "@/lib/api";
import type { ReceiptItemRow, ReceiptRow, ProductSearchResult } from "@/types/api";

export const NON_FOOD_CATEGORY = "non_food";

// E5-S2/S3/S5: per-item manual search across OFF+BLS, pick (writes a
// verified-match vote), or flag as no-match. Collapsed by default.
function MatchFixer({
  receiptId,
  item,
  onDone,
}: {
  receiptId: string;
  item: ReceiptItemRow;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(item.normalized_name ?? item.raw_name ?? "");
  const [results, setResults] = useState<ProductSearchResult[] | null>(null);
  // Bug fix: `pick`/`noMatch` used to share one `busy` flag with the
  // Search button, so clicking "Use this" made the unrelated Search
  // button flash "Searching…" — the exact "nothing seems to happen"
  // report. Search now has its own flag; picking/flagging share theirs
  // (they're mutually-exclusive actions on the same result, never
  // triggered alongside a search).
  const [searching, setSearching] = useState(false);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function runSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setNote(null);
    try {
      setResults(await searchProducts(query.trim()));
    } finally {
      setSearching(false);
    }
  }

  async function pick(r: ProductSearchResult) {
    setWorking(true);
    try {
      await pickItemMatch(receiptId, item.id, {
        source: r.source,
        matched_name: r.name,
        off_id: r.off_id ?? null,
        bls_code: r.bls_code ?? null,
        nutrition: r.nutrition,
      });
      setNote(t("review.picked"));
      onDone(); // parent reload — the row's name + confidence badge above update immediately
      // Brief confirmation, then collapse back to the compact toggle — the
      // updated name/confidence badge on the row is the lasting signal.
      setTimeout(() => setOpen(false), 900);
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : t("review.pickFailed"));
    } finally {
      setWorking(false);
    }
  }

  async function noMatch() {
    setWorking(true);
    try {
      await flagNoMatch(receiptId, item.id);
      setNote(t("review.noMatchLogged"));
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : t("review.noMatchFailed"));
    } finally {
      setWorking(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium tracking-tight text-accent hover:underline"
      >
        {t("review.fixMatch")}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-black/5">
      <div className="flex gap-2">
        <input
          className={cn(inputCls, "text-sm")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder={t("review.searchPlaceholder")}
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-canvas disabled:opacity-40"
        >
          {searching ? t("review.searching") : t("review.searchButton")}
        </button>
      </div>

      {note ? <p className="text-xs font-medium text-emerald-600">{note}</p> : null}

      {results && results.length === 0 ? (
        <p className="text-xs text-ink/50">{t("review.noResults")}</p>
      ) : null}

      {results && results.length > 0 ? (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {results.map((r, i) => (
            <li key={`${r.source}-${r.off_id ?? r.bls_code ?? i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-black/5">
              <span className="min-w-0 truncate text-xs text-ink/80">
                <span className="mr-1 rounded bg-zinc-100 px-1 py-0.5 text-[9px] uppercase tracking-widest text-ink/50">
                  {r.source}
                </span>
                {r.name}
                {r.brand ? <span className="text-ink/40"> · {r.brand}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => pick(r)}
                disabled={working}
                className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
              >
                {t("review.useThis")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={noMatch} disabled={working} className="text-[11px] text-red-600 hover:underline">
          {t("review.noMatch")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-ink/40 hover:underline">
          {t("review.close")}
        </button>
      </div>
    </div>
  );
}

function confidenceLabel(
  confidence: number | null,
  t: (key: string) => string,
): { text: string; tone: string } {
  if (confidence === null) return { text: t("review.confidence.unknown"), tone: "text-ink/40" };
  if (confidence >= 0.8) return { text: t("review.confidence.confident"), tone: "text-emerald-600" };
  if (confidence >= 0.5) return { text: t("review.confidence.uncertain"), tone: "text-amber-600" };
  return { text: t("review.confidence.low"), tone: "text-red-600" };
}

function ItemRow({
  item,
  receiptId,
  onSave,
  onReload,
}: {
  item: ReceiptItemRow;
  receiptId: string;
  onSave: (itemId: string, updates: { normalized_name?: string; quantity?: number; unit?: string; category?: string }) => Promise<void>;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.normalized_name ?? "");
  const [quantity, setQuantity] = useState(String(item.quantity ?? ""));
  const [unit, setUnit] = useState(item.unit ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [saving, setSaving] = useState(false);
  const [markingNonFood, setMarkingNonFood] = useState(false);
  const [nonFoodError, setNonFoodError] = useState<string | null>(null);
  const { t } = useLanguage();
  const confidence = confidenceLabel(item.confidence, t);
  const isNonFood = item.category === NON_FOOD_CATEGORY;

  async function save() {
    setSaving(true);
    try {
      await onSave(item.id, {
        normalized_name: name,
        quantity: quantity ? Number(quantity) : undefined,
        unit,
        category,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function markNonFood() {
    setMarkingNonFood(true);
    setNonFoodError(null);
    try {
      await markItemNonFood(receiptId, item.id);
      await onReload();
    } catch (e) {
      setNonFoodError(e instanceof ApiError ? e.message : t("review.markNonFoodFailed"));
    } finally {
      setMarkingNonFood(false);
    }
  }

  if (!editing) {
    return (
      <li className="px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-sm font-medium tracking-tight",
                isNonFood && "text-ink/40 line-through",
              )}
            >
              {item.normalized_name || item.raw_name}
            </p>
            <p className="truncate text-xs text-ink/50">
              {item.quantity ?? "?"} {item.unit ?? ""} ·{" "}
              {isNonFood ? t("review.notFoodLabel") : item.category ?? t("review.uncategorized")} ·{" "}
              {t("review.rawPrefix")} "{item.raw_name}"
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {isNonFood ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink/50">
                {t("review.notFoodBadge")}
              </span>
            ) : (
              <span className={`text-[11px] uppercase tracking-widest ${confidence.tone}`}>
                {confidence.text}
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200"
            >
              {t("review.edit")}
            </button>
          </div>
        </div>

        {!isNonFood ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <MatchFixer receiptId={receiptId} item={item} onDone={onReload} />
            <button
              type="button"
              onClick={markNonFood}
              disabled={markingNonFood}
              className="text-[11px] font-medium tracking-tight text-ink/40 hover:text-red-600 disabled:opacity-40"
            >
              {markingNonFood ? t("review.markingNonFood") : t("review.markNonFood")}
            </button>
          </div>
        ) : null}
        {nonFoodError ? <p className="mt-1 text-[11px] text-red-600">{nonFoodError}</p> : null}
      </li>
    );
  }

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("review.namePlaceholder")} />
        <input className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t("review.quantityPlaceholder")} />
        <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("review.unitPlaceholder")} />
        <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("review.categoryPlaceholder")} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas disabled:opacity-40"
        >
          {saving ? t("review.saving") : t("review.save")}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5"
        >
          {t("review.cancel")}
        </button>
      </div>
    </li>
  );
}

// The uploaded receipt, front and center at the top of the page: the
// photo (kept only for this review window — see App.tsx/handleContinue
// below, which deletes it once the user moves past this receipt) plus a
// summary line built from data the parser already extracted. `store`/
// `purchase_date` are the promoted columns; `raw_text` (the full parsed
// payload) is the fallback for whichever of those hasn't been promoted on
// an unmigrated DB, and is the only place scan_quality lives.
function ReceiptHeader({
  receipt,
  imageUrl,
  itemCount,
}: {
  receipt: ReceiptRow;
  imageUrl: string | null;
  itemCount: number;
}) {
  const { t } = useLanguage();
  const store = receipt.store ?? receipt.raw_text?.store ?? t("review.unknownStore");
  const date = receipt.purchase_date ?? receipt.raw_text?.date ?? null;
  const scanQuality = receipt.raw_text?.scan_quality ?? null;

  return (
    <Card className="space-y-3">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={t("review.receiptImageAlt")}
          className="mx-auto max-h-80 w-auto rounded-xl object-contain ring-1 ring-black/5"
        />
      ) : null}
      <div>
        <p className="truncate text-lg font-medium tracking-tight">{store}</p>
        <p className="text-xs text-ink/50">
          {date ? `${date} · ` : ""}
          {scanQuality ? `${scanQuality} · ` : ""}
          {itemCount} {t("upload.itemsSuffix")}
        </p>
      </div>
    </Card>
  );
}

export function ReviewStep({
  receiptIds,
  onContinue,
}: {
  // Every receipt from the upload that led here — reviewed one at a time,
  // in order; `onContinue` only fires once the last one is done (E5).
  receiptIds: string[];
  onContinue: () => void;
}) {
  const [index, setIndex] = useState(0);
  const receiptId = receiptIds[Math.min(index, receiptIds.length - 1)];
  const isLast = index >= receiptIds.length - 1;

  const [receipt, setReceipt] = useState<ReceiptRow | null>(null);
  const [items, setItems] = useState<ReceiptItemRow[] | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  async function load() {
    setError(null);
    setItems(null);
    setImageUrl(null);
    try {
      const res = await getReceipt(receiptId);
      setReceipt(res.receipt);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("review.loadFailed"));
    }
    // Independent of the items fetch above — a missing/expired image (a
    // text-pasted receipt, or one already reviewed) just means no photo
    // shows, never an error for the page as a whole.
    getReceiptImageUrl(receiptId)
      .then((res) => setImageUrl(res?.url ?? null))
      .catch(() => setImageUrl(null));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptId]);

  async function handleSave(
    itemId: string,
    updates: { normalized_name?: string; quantity?: number; unit?: string; category?: string },
  ) {
    await updateReceiptItem(receiptId, itemId, updates);
    await load();
  }

  // E12-S5/BR-P4: the photo is only ever kept between upload and the end
  // of review — delete it now that the user is done with this receipt,
  // then either page to the next one or hand off to the caller.
  async function handleContinueClick() {
    void deleteReceiptImage(receiptId).catch(() => {});
    if (isLast) {
      onContinue();
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <SectionLabel>{t("review.step")}</SectionLabel>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          {t("review.title")}
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("review.body")}</p>
        {receiptIds.length > 1 ? (
          <p className="text-xs font-medium uppercase tracking-widest text-ink/40">
            {t("review.pageOf")
              .replace("{index}", String(index + 1))
              .replace("{total}", String(receiptIds.length))}
          </p>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {items === null && !error ? (
        <p className="text-sm text-ink/50">{t("review.loading")}</p>
      ) : null}

      {receipt && items ? <ReceiptHeader receipt={receipt} imageUrl={imageUrl} itemCount={items.length} /> : null}

      {items && items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/60">{t("review.noItems")}</p>
        </Card>
      ) : null}

      {items && items.length > 0 ? (
        <ul className="divide-y divide-black/5 rounded-2xl bg-surface ring-1 ring-black/5">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} receiptId={receiptId} onSave={handleSave} onReload={load} />
          ))}
        </ul>
      ) : null}

      <PrimaryButton onClick={handleContinueClick} disabled={!items}>
        {isLast ? t("review.continueButton") : t("review.nextReceiptButton")}
      </PrimaryButton>
    </section>
  );
}
