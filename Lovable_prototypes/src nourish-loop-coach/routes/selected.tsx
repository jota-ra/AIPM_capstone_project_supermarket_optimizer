import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { recipes } from "@/lib/data";
import { store, useStore } from "@/lib/store";

export const Route = createFileRoute("/selected")({
  head: () => ({
    meta: [
      { title: "Your picks · NutriWise" },
      { name: "description", content: "Review the recipes you've selected before generating a shopping list." },
    ],
  }),
  component: Selected,
});

function Selected() {
  const ids = useStore((s) => s.selectedRecipeIds);
  const picks = recipes.filter((r) => ids.includes(r.id));
  const totalCost = picks.reduce((s, r) => s + r.costEur * 2, 0);

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl space-y-6 px-5 pb-32 pt-6">
        <header>
          <Link to="/results" className="text-sm text-forest/60 hover:text-forest">← Back to results</Link>
          <h1 className="mt-2 font-serif text-3xl">Your picks for the week</h1>
          <p className="mt-1 text-forest/70">
            {picks.length === 0
              ? "No recipes selected yet — head back and tap a few."
              : `${picks.length} recipe${picks.length === 1 ? "" : "s"}, approx. €${totalCost.toFixed(2)} total (2 servings each).`}
          </p>
        </header>

        {picks.length > 0 ? (
          <>
            <ul className="space-y-3">
              {picks.map((r) => (
                <li key={r.id} className="flex items-center gap-4 rounded-2xl border border-forest/5 bg-card p-3">
                  <img
                    src={r.image}
                    alt={r.title}
                    loading="lazy"
                    width={120}
                    height={120}
                    className="size-20 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-lg leading-tight">{r.title}</h3>
                    <p className="mt-0.5 text-xs text-forest/60">
                      Closes {r.fixes} · {r.prepMin} min · €{r.costEur.toFixed(2)}/pp
                    </p>
                  </div>
                  <button
                    onClick={() => store.toggleRecipe(r.id)}
                    className="shrink-0 text-xs text-forest/50 hover:text-terracotta"
                    aria-label={`Remove ${r.title}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <div className="fixed inset-x-0 bottom-0 border-t border-forest/5 bg-cream/95 px-5 py-3 backdrop-blur-md">
              <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-forest/50">Est. total</p>
                  <p className="font-serif text-xl">€{totalCost.toFixed(2)}</p>
                </div>
                <Link
                  to="/shopping"
                  className="rounded-full bg-sage px-6 py-3 text-sm font-medium text-cream shadow-lg shadow-sage/20"
                >
                  Generate shopping list →
                </Link>
              </div>
            </div>
          </>
        ) : (
          <Link
            to="/results"
            className="block rounded-2xl border-2 border-dashed border-forest/15 p-10 text-center text-sm text-forest/60"
          >
            Pick recipes from your results page first
          </Link>
        )}
      </main>
    </AppShell>
  );
}
