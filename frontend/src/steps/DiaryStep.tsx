import { useEffect, useState } from "react";
import { SectionLabel, Card, inputCls } from "@/components/AppShell";
import type { StepId } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";
import {
  getPantry,
  consumePantryItem,
  logManualConsumption,
  getConsumptionLogForDate,
  ApiError,
} from "@/lib/api";
import type { PantryItem, ConsumptionLogEntry } from "@/types/api";
import { CATEGORY_ICON } from "@/steps/PantryStep";

// "Tagebuch" — menu restructure: split out of the old combined Pantry
// page. This is the day-by-day "what did I actually eat" flow;
// inventory management (correcting/discarding stock, adding a new
// receipt) now lives on the separate "Lager" page (PantryStep.tsx).
// Picking an item here still reduces that same pantry stock — the two
// pages share the same underlying data, just different jobs.

const quantityInputCls =
  "w-20 rounded-lg bg-zinc-50 px-2 py-1.5 text-sm text-ink ring-1 ring-black/5 outline-none focus:ring-ink/30";

const MAX_DAYS_BACK = 14;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Noon UTC on the selected day avoids day-boundary ambiguity when the
// backend compares consumed_at against calendar dates — "today" is left
// undefined so the backend's real-time default (now()) is used instead,
// which is more precise than a fixed noon timestamp.
function consumedAtFor(selectedDate: string): string | undefined {
  return selectedDate === todayIso() ? undefined : `${selectedDate}T12:00:00.000Z`;
}

function DateNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const { t } = useLanguage();
  const min = daysAgoIso(MAX_DAYS_BACK);
  const max = todayIso();
  const isToday = date === max;
  const atOldest = date <= min;

  function shift(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next < min || next > max) return;
    onChange(next);
  }

  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-black/5">
      <button
        type="button"
        onClick={() => shift(-1)}
        disabled={atOldest}
        className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200 disabled:opacity-40"
      >
        ← {t("diary.previousDay")}
      </button>
      <span className="text-sm font-medium tracking-tight">{isToday ? t("diary.today") : date}</span>
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={isToday}
        className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium tracking-tight text-ink ring-1 ring-black/5 hover:bg-zinc-200 disabled:opacity-40"
      >
        {t("diary.nextDay")} →
      </button>
    </div>
  );
}

// "Select what you ate from your pantry overview" — a leaner row than
// Lager's PantryRow: no unit/category editing or discard here, just
// "how much, and did you eat it today" — this page's one job.
function PantryPickRow({
  item,
  onConsume,
}: {
  item: PantryItem;
  onConsume: (name: string, quantity: number) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity_available));
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();

  const parsed = Number(quantity);
  const validQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  async function handleConsume() {
    if (validQuantity === null) return;
    setBusy(true);
    try {
      await onConsume(item.normalized_name, Math.min(validQuantity, item.quantity_available));
    } finally {
      setBusy(false);
    }
  }

  const icon = CATEGORY_ICON[(item.category as keyof typeof CATEGORY_ICON) ?? "other"] ?? CATEGORY_ICON.other;

  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <span aria-hidden className="shrink-0 text-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-tight">{item.normalized_name}</p>
        <p className="truncate text-xs text-ink/50">
          {item.quantity_available} {item.unit ?? ""} {t("pantry.quantityLabel").toLowerCase()}
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
          onClick={handleConsume}
          className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium tracking-tight text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-40"
        >
          {t("pantry.consumed")}
        </button>
      </div>
    </li>
  );
}

function ManualLogForm({
  pantryItemNames,
  onSubmit,
}: {
  pantryItemNames: string[];
  onSubmit: (name: string, quantity: number) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [lastMatch, setLastMatch] = useState<{ name: string; matched: boolean } | null>(null);
  const { t } = useLanguage();

  const parsedQuantity = Number(quantity);
  const canSubmit = name.trim().length > 0 && Number.isFinite(parsedQuantity) && parsedQuantity > 0;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const submittedName = name.trim();
      const matched = await onSubmit(submittedName, parsedQuantity);
      setLastMatch({ name: submittedName, matched });
      setName("");
      setQuantity("1");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-3">
      <SectionLabel>{t("diary.manualLogTitle")}</SectionLabel>
      <p className="text-xs text-ink/50">{t("diary.manualLogBody")}</p>
      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder={t("diary.manualLogNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          list="pantry-item-names"
        />
        <datalist id="pantry-item-names">
          {pantryItemNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <input
          type="number"
          min={0}
          step="any"
          className={quantityInputCls}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={submitting}
          aria-label={t("pantry.quantityLabel")}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas disabled:opacity-40"
        >
          {t("diary.manualLogAdd")}
        </button>
      </div>
      {lastMatch ? (
        <p className="text-xs text-ink/50">
          "{lastMatch.name}" — {lastMatch.matched ? t("pantry.matchedGood") : t("pantry.matchedRough")}
        </p>
      ) : null}
    </Card>
  );
}

function DayLog({ entries }: { entries: ConsumptionLogEntry[] }) {
  const { t } = useLanguage();
  if (entries.length === 0) return null;
  return (
    <Card className="space-y-2">
      <SectionLabel>{t("diary.dayLogTitle")}</SectionLabel>
      <ul className="space-y-1 text-sm text-ink/70">
        {entries.map((entry) => (
          <li key={entry.id}>
            · {entry.normalized_name} ({entry.quantity_consumed})
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DiaryStep({
  onNavigate,
}: {
  // Cross-link to Insights — confirming consumption shifts the health
  // score/trend, so it's worth a direct way back without hunting for
  // the nav tab right after logging something.
  onNavigate?: (step: StepId) => void;
}) {
  const [items, setItems] = useState<PantryItem[] | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [logEntries, setLogEntries] = useState<ConsumptionLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  async function loadPantry() {
    try {
      const res = await getPantry();
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("pantry.loadFailed"));
    }
  }

  async function loadLog(date: string) {
    try {
      const res = await getConsumptionLogForDate(date);
      setLogEntries(res.entries);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("pantry.loadFailed"));
    }
  }

  async function loadAll() {
    setError(null);
    await Promise.all([loadPantry(), loadLog(selectedDate)]);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLog(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  async function handleConsume(name: string, quantity: number) {
    await consumePantryItem(name, quantity, consumedAtFor(selectedDate));
    await loadAll();
  }

  async function handleManualLog(name: string, quantity: number): Promise<boolean> {
    const result = await logManualConsumption(name, quantity, consumedAtFor(selectedDate));
    await loadAll();
    return result.matched;
  }

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <SectionLabel>{t("diary.step")}</SectionLabel>
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
          {t("diary.title")}
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("diary.body")}</p>
        <p className="max-w-[56ch] text-pretty text-xs text-ink/40">{t("diary.whyItMatters")}</p>
      </header>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <DateNav date={selectedDate} onChange={setSelectedDate} />

      <DayLog entries={logEntries} />

      <div className="space-y-2">
        <SectionLabel>{t("diary.pickFromPantryTitle")}</SectionLabel>
        {items === null && !error ? <p className="text-sm text-ink/50">{t("pantry.loading")}</p> : null}
        {items && items.length === 0 ? (
          <Card>
            <p className="text-sm text-ink/60">{t("diary.pickFromPantryEmpty")}</p>
          </Card>
        ) : null}
        {items && items.length > 0 ? (
          <ul className="divide-y divide-black/5 rounded-2xl bg-surface ring-1 ring-black/5">
            {items.map((item) => (
              <PantryPickRow key={item.id} item={item} onConsume={handleConsume} />
            ))}
          </ul>
        ) : null}
      </div>

      <ManualLogForm
        pantryItemNames={items?.map((item) => item.normalized_name) ?? []}
        onSubmit={handleManualLog}
      />
    </section>
  );
}
