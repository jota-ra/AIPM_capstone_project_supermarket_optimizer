import { useRef, useState } from "react";
import { SectionLabel, Card, PrimaryButton, inputCls } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { uploadReceiptFile, uploadReceiptText, ApiError } from "@/lib/api";
import type { UploadReceiptResponse } from "@/types/api";

type Mode = "image" | "text";

export function UploadStep({
  onUploaded,
}: {
  onUploaded: (receiptId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("image");
  const [dragOver, setDragOver] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadReceiptResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const res = await uploadReceiptFile(file);
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTextSubmit() {
    if (!pastedText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadReceiptText(pastedText);
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <SectionLabel>Step 1 · Receipt</SectionLabel>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          Bring in a receipt.
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">
          Upload a photo of a grocery receipt, or paste its text if a photo
          isn't handy — OCR can be unreliable, so pasting always works.
        </p>
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
            {m === "image" ? "Upload photo" : "Paste text"}
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
            {loading ? "Uploading…" : "Drop a receipt photo here or click to upload"}
          </p>
          <p className="mt-1 text-xs text-ink/50">JPG, PNG or WEBP</p>
        </div>
      ) : (
        <Card className="space-y-4">
          <SectionLabel>Paste receipt text</SectionLabel>
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
            {loading ? "Analyzing…" : "Analyze pasted receipt"}
          </PrimaryButton>
        </Card>
      )}

      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionLabel>
              Parsed · {result.parsed.store} ({result.parsed.scan_quality})
            </SectionLabel>
            <span className="text-xs text-ink/40">{result.parsed.items_count} items</span>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {result.parsed.items.map((item, i) => (
              <li key={i} className="text-sm text-ink/70">
                · {item.name}
                {item.uncertain ? (
                  <span className="ml-1 text-[10px] uppercase tracking-widest text-ink/35">
                    uncertain
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <PrimaryButton onClick={() => onUploaded(result.receipt_id)}>
            Review items →
          </PrimaryButton>
        </Card>
      ) : null}
    </section>
  );
}
