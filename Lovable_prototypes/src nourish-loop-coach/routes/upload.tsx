import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload receipt · NutriWise" },
      { name: "description", content: "Drop a photo of your grocery receipt — we'll scan it and update your profile." },
    ],
  }),
  component: Upload,
});

function Upload() {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "scanning" | "matching" | "done">("idle");

  useEffect(() => {
    if (stage === "scanning") {
      const t1 = setTimeout(() => setStage("matching"), 1400);
      return () => clearTimeout(t1);
    }
    if (stage === "matching") {
      const t2 = setTimeout(() => {
        router.navigate({ to: "/results" });
      }, 1600);
      return () => clearTimeout(t2);
    }
  }, [stage, router]);

  const isProcessing = stage === "scanning" || stage === "matching";

  return (
    <AppShell>
      <main className="mx-auto max-w-xl space-y-6 px-5 pb-24 pt-6">
        <header>
          <span className="chip bg-clay text-forest/60">Step 1 of the loop</span>
          <h1 className="mt-2 font-serif text-3xl">Upload your receipt</h1>
          <p className="mt-1 text-forest/70">
            One photo is enough. We'll match every item to a nutrition database — usually in under
            10 seconds.
          </p>
        </header>

        {!isProcessing && stage !== "done" && (
          <>
            <label
              htmlFor="receipt"
              className="block cursor-pointer rounded-3xl border-2 border-dashed border-sage/40 bg-sage/5 p-12 text-center transition-colors hover:bg-sage/10"
            >
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-sage text-cream">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M7 10l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
              <p className="font-medium">Tap to upload or drop a photo</p>
              <p className="mt-1 text-sm text-forest/60">JPG, PNG, HEIC — up to 10 MB</p>
              <input
                id="receipt"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={() => setStage("scanning")}
              />
            </label>

            <button
              onClick={() => setStage("scanning")}
              className="w-full rounded-2xl border border-forest/10 bg-card py-3.5 text-sm font-medium hover:bg-clay"
            >
              Use demo receipt instead
            </button>

            <details className="group rounded-2xl border border-forest/10 bg-card p-4 open:bg-clay/40">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                <span>Tips for the cleanest scan</span>
                <span className="text-forest/40 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <ul className="mt-3 space-y-2 text-sm text-forest/70">
                <li className="flex gap-2"><span className="text-sage">✓</span> Lay the receipt flat on a dark surface for contrast.</li>
                <li className="flex gap-2"><span className="text-sage">✓</span> Capture the full receipt — header to total — in one photo.</li>
                <li className="flex gap-2"><span className="text-sage">✓</span> Avoid glare and folds. Re-print long receipts if needed.</li>
                <li className="flex gap-2"><span className="text-sage">✓</span> Multiple receipts? Upload one at a time — results stack automatically.</li>
              </ul>
            </details>

            <p className="text-center text-xs text-forest/50">
              Your receipt photo never leaves your device after items are identified.
            </p>
          </>
        )}

        {isProcessing && (
          <div className="space-y-6 rounded-3xl border border-forest/5 bg-card p-10 text-center">
            <div className="relative mx-auto h-44 w-32 overflow-hidden rounded-md bg-white shadow-xl">
              <div className="space-y-1.5 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-1 rounded bg-stone-200" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-0 h-0.5 animate-[scan_1.4s_linear_infinite] bg-sage shadow-[0_0_14px_rgba(124,144,112,0.7)]" />
              <style>{`@keyframes scan { 0%{top:0%} 100%{top:100%} }`}</style>
            </div>
            <div className="space-y-1">
              <h2 className="font-serif text-xl">
                {stage === "scanning" ? "Scanning items…" : "Matching to nutrition database…"}
              </h2>
              <p className="text-sm text-forest/60">
                {stage === "scanning"
                  ? "Reading 14 items from Edeka Berlin"
                  : "Cross-referencing against your ideal profile"}
              </p>
            </div>
            <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-clay">
              <div
                className="h-full rounded-full bg-sage transition-all duration-700"
                style={{ width: stage === "scanning" ? "40%" : "90%" }}
              />
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
