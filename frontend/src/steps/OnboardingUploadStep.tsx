import { useRef, useState } from "react";
import { Card, PrimaryButton, SectionLabel, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { uploadReceiptFiles, uploadReceiptText, receiptErrorKey, ApiError } from "@/lib/api";
import type { UploadReceiptResponse } from "@/types/api";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

type Mode = "image" | "text";

// The baseline receipt upload — the chat's direct continuation, not the
// general "add another receipt" flow (now embedded in PantryStep.tsx's
// "Lager" page, reachable any time from the nav). Deliberately a
// separate component: different framing (this IS the baseline, not a
// re-upload), and it's the one place in the app where completing it
// always means "continue the onboarding journey", never "revisit an
// existing one". Plain upload card, no chat styling — the chat lives in
// ChatOnboardingStep.tsx; this step is a normal form.
export function OnboardingUploadStep({
  onUploaded,
}: {
  // Every successfully-parsed receipt from this upload (E5: Review pages
  // through all of them, one at a time) — not just the first.
  onUploaded: (receiptIds: string[]) => void;
  // Deliberately no `onSkip` here (bug fix): a "do this later" escape
  // hatch let users leave before the 50-item target, and the nav/logo
  // leak (AppShell.tsx) meant they could land straight on Insights with
  // as few as 15 items uploaded. This step and Review (while the gate is
  // active) are now the only two screens reachable until the target is
  // met — see App.tsx's `restrictNav` and `handleOnboardingReviewContinue`.
}) {
  const [mode, setMode] = useState<Mode>("image");
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

  // E3-S1: each selected file is uploaded as its own receipt. The preview
  // below shows the first that parsed; every one that parsed (not just
  // the first) carries through to Review once the user continues.
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
    <section className="space-y-5 px-6 pb-16">
      <Card className="space-y-4">
        <div className="flex gap-2 rounded-full bg-surface p-1 ring-1 ring-black/5 w-fit">
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
            <SectionLabel>{t("upload.pasteLabel")}</SectionLabel>
            <textarea
              className={cn(inputCls, "min-h-40 resize-y font-mono text-xs")}
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
    </section>
  );
}
