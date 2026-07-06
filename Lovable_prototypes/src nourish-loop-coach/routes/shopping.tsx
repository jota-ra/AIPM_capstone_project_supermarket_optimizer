import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { recipes } from "@/lib/data";
import { store, useStore } from "@/lib/store";

export const Route = createFileRoute("/shopping")({
  head: () => ({
    meta: [
      { title: "Shopping list · NutriWise" },
      { name: "description", content: "Your categorized shopping list, ready for the store." },
    ],
  }),
  component: Shopping,
});

const CATEGORY_ORDER = ["Produce", "Proteins", "Dairy", "Pantry"] as const;

function Shopping() {
  const router = useRouter();
  const ids = useStore((s) => s.selectedRecipeIds);
  const picks = recipes.filter((r) => ids.includes(r.id));

  // Default to a couple of demo recipes if user landed here empty
  const list = picks.length > 0 ? picks : recipes.slice(0, 2);
  const items = useMemo(() => list.flatMap((r) => r.ingredients), [list]);
  const grouped = useMemo(() => {
    const g: Record<string, { name: string }[]> = {};
    items.forEach((it) => {
      g[it.category] = g[it.category] || [];
      g[it.category].push({ name: it.name });
    });
    return g;
  }, [items]);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const total = items.length;
  const done = checked.size;
  const totalCost = list.reduce((s, r) => s + r.costEur * 2, 0);

  function toggle(key: string) {
    const next = new Set(checked);
    next.has(key) ? next.delete(key) : next.add(key);
    setChecked(next);
  }

  function finishLoop() {
    // Clear picks, send back to upload (loop)
    store.set({ selectedRecipeIds: [] });
    router.navigate({ to: "/upload" });
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl space-y-6 px-5 pb-32 pt-6">
        <header>
          <span className="chip bg-terracotta/10 text-terracotta">Shopping agent</span>
          <h1 className="mt-2 font-serif text-3xl">Your smart list</h1>
          <p className="mt-1 text-forest/70">
            {list.length} recipe{list.length === 1 ? "" : "s"} · est. €{totalCost.toFixed(2)} for 2 servings each
          </p>
        </header>

        <div className="flex items-center gap-3 rounded-2xl bg-clay p-4">
          <div className="relative size-12 shrink-0">
            <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="var(--sage)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(done / total) * 94.2} 94.2`}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center font-serif text-sm">
              {done}/{total}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {done === total ? "All done — nice work" : `${total - done} item${total - done === 1 ? "" : "s"} to go`}
            </p>
            <p className="text-xs text-forest/60">Check items as you put them in your basket.</p>
          </div>
        </div>

        <div className="space-y-6">
          {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
            <section key={cat}>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-terracotta">
                {cat}
              </h2>
              <ul className="mt-2 divide-y divide-forest/5 rounded-2xl border border-forest/5 bg-card">
                {grouped[cat].map((it, i) => {
                  const key = `${cat}-${i}-${it.name}`;
                  const isChecked = checked.has(key);
                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-center gap-3 p-4">
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                            isChecked ? "border-sage bg-sage text-cream" : "border-forest/25"
                          }`}
                        >
                          {isChecked && (
                            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(key)}
                          className="sr-only"
                        />
                        <span className={`text-sm ${isChecked ? "text-forest/40 line-through" : ""}`}>
                          {it.name}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* Loop close-out */}
        <section className="rounded-3xl bg-forest p-7 text-cream">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-sage">
              <span className="font-serif text-lg">↻</span>
            </div>
            <div>
              <h3 className="font-serif text-xl text-cream">The loop continues</h3>
              <p className="text-sm text-cream/70">After shopping, snap your new receipt to refine your profile.</p>
            </div>
          </div>
          <button
            onClick={finishLoop}
            className="mt-5 w-full rounded-2xl bg-terracotta py-4 font-medium text-cream shadow-lg shadow-terracotta/20 transition-transform active:scale-[0.98]"
          >
            Done shopping — upload your next receipt →
          </button>
          <Link to="/dashboard" className="mt-3 block text-center text-xs text-cream/60 hover:text-cream">
            Or head back to dashboard
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
