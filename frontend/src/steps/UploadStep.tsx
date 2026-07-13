import { useRef, useState } from "react";
import { SectionLabel, Card, PrimaryButton, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { uploadReceiptFile, uploadReceiptText, ApiError } from "@/lib/api";
import type { UploadReceiptResponse } from "@/types/api";

type Mode = "image" | "text";

// The very first ("baseline") receipt has its own dedicated page —
// OnboardingUploadStep.tsx, deliberately independent of this one (see
// its docstring) — so this component only ever handles re-uploads for
// a session that already has at least one receipt.
export function UploadStep({
  profileId,
  onUploaded,
}: {
  profileId: string | null;
  onUploaded: (receiptId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("image");
  const [dragOver, setDragOver] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadReceiptResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const res = await uploadReceiptFile(file, profileId ?? undefined);
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("upload.uploadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleTextSubmit() {
    if (!pastedText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadReceiptText(pastedText, profileId ?? undefined);
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("upload.uploadFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <SectionLabel>{t("upload.step")}</SectionLabel>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          {t("upload.title")}
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("upload.body")}</p>
      </header>

      <div className="flex gap-2 rounded-full bg-surface p-1 ring-1 ring-black/5 w-fit">
        {(["image", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setResult(null);
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
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={cn(
            "block w-full cursor-pointer rounded-3xl border border-dashed p-12 text-center transition-colors",
            dragOver ? "border-ink/50 bg-surface" : "border-ink/20 bg-surface hover:border-ink/40",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-zinc-100 ring-1 ring-black/5">
            <span className="text-lg text-ink/60">↑</span>
          </div>
          <p className="text-sm font-medium tracking-tight">
            {loading ? t("upload.dropUploading") : t("upload.dropTitle")}
          </p>
          <p className="mt-1 text-xs text-ink/50">{t("upload.dropHint")}</p>
        </div>
      ) : (
        <Card className="space-y-4">
          <SectionLabel>{t("upload.pasteLabel")}</SectionLabel>
          <textarea
            className={cn(inputCls, "min-h-40 resize-y font-mono text-xs")}
            placeholder={"REWE Markt GmbH\nVollmilch 3,5% 1L    1,29\nVollkornbrot 500g    1,99\n..."}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <PrimaryButton
            onClick={handleTextSubmit}
            disabled={loading || !pastedText.trim()}
          >
            {loading ? t("upload.analyzing") : t("upload.analyzeButton")}
          </PrimaryButton>
        </Card>
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
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionLabel>
              {result.parsed.store} ({result.parsed.scan_quality})
            </SectionLabel>
            <span className="text-xs text-ink/40">
              {result.parsed.items_count} {t("upload.itemsSuffix")}
            </span>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {result.parsed.items.map((item, i) => (
              <li key={i} className="text-sm text-ink/70">
                · {item.name}
                {item.uncertain ? (
                  <span className="ml-1 text-[10px] uppercase tracking-widest text-ink/35">
                    {t("upload.uncertainTag")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <PrimaryButton onClick={() => onUploaded(result.receipt_id)}>
            {t("upload.reviewButton")}
          </PrimaryButton>
        </Card>
      ) : null}
    </section>
  );
}
