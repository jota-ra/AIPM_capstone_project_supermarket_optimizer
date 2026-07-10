import { useEffect, useState } from "react";
import { SectionLabel, Card, PrimaryButton, inputCls } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";
import { getReceipt, updateReceiptItem, ApiError } from "@/lib/api";
import type { ReceiptItemRow } from "@/types/api";

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
  onSave,
}: {
  item: ReceiptItemRow;
  onSave: (itemId: string, updates: { normalized_name?: string; quantity?: number; unit?: string; category?: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.normalized_name ?? "");
  const [quantity, setQuantity] = useState(String(item.quantity ?? ""));
  const [unit, setUnit] = useState(item.unit ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();
  const confidence = confidenceLabel(item.confidence, t);

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

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-tight">
            {item.normalized_name || item.raw_name}
          </p>
          <p className="truncate text-xs text-ink/50">
            {item.quantity ?? "?"} {item.unit ?? ""} · {item.category ?? t("review.uncategorized")} ·{" "}
            {t("review.rawPrefix")} "{item.raw_name}"
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`text-[11px] uppercase tracking-widest ${confidence.tone}`}>
            {confidence.text}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200"
          >
            {t("review.edit")}
          </button>
        </div>
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

export function ReviewStep({
  receiptId,
  onContinue,
}: {
  receiptId: string;
  onContinue: () => void;
}) {
  const [items, setItems] = useState<ReceiptItemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  async function load() {
    setError(null);
    try {
      const res = await getReceipt(receiptId);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("review.loadFailed"));
    }
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

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <SectionLabel>{t("review.step")}</SectionLabel>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          {t("review.title")}
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("review.body")}</p>
      </header>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {items === null && !error ? (
        <p className="text-sm text-ink/50">{t("review.loading")}</p>
      ) : null}

      {items && items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/60">{t("review.noItems")}</p>
        </Card>
      ) : null}

      {items && items.length > 0 ? (
        <ul className="divide-y divide-black/5 rounded-2xl bg-surface ring-1 ring-black/5">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} onSave={handleSave} />
          ))}
        </ul>
      ) : null}

      <PrimaryButton onClick={onContinue} disabled={!items}>
        {t("review.continueButton")}
      </PrimaryButton>
    </section>
  );
}
