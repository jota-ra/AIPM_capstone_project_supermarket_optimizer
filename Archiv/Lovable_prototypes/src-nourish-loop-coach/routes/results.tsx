import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { gaps, recipes, trends } from "@/lib/data";
import { store, useStore } from "@/lib/store";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your analysis · NutriWise" },
      { name: "description", content: "Gap analysis, recipe recommendations and trends from your latest receipt." },
    ],
  }),
  component: Results,
});

type Tab = "gaps" | "recipes" | "trends";

function Results() {
  const [tab, setTab] = useState<Tab>("gaps");
  const selected = useStore((s) => s.selectedRecipeIds);

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl space-y-6 px-5 pb-32 pt-6">
        <header>
          <span className="chip bg-sage/10 text-sage">Fresh analysis · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          <h1 className="mt-2 font-serif text-3xl leading-tight">
            Here's what your basket said this week.
          </h1>
          <p className="mt-1 text-forest/70">
            14 items matched. Two clear gaps, one win, and a trend that's heading the right way.
          </p>
        </header>

        {/* Tabs */}
        <div className="sticky top-[60px] z-10 -mx-5 bg-cream/90 px-5 py-2 backdrop-blur-md">
          <div className="flex gap-1 rounded-full border border-forest/10 bg-card p-1">
            {([
              ["gaps", "Gap Analysis"],
              ["recipes", "Recipes"],
              ["trends", "Trends"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  tab === k ? "bg-forest text-cream" : "text-forest/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "gaps" && <Gaps />}
        {tab === "recipes" && <Recipes />}
        {tab === "trends" && <Trends />}
      </main>

      {selected.length > 0 && tab === "recipes" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-forest/5 bg-cream/95 px-5 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <span className="text-sm">
              <span className="font-serif text-xl text-terracotta">{selected.length}</span>{" "}
              <span className="text-forest/60">recipe{selected.length === 1 ? "" : "s"} picked</span>
            </span>
            <Link
              to="/selected"
              className="rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-cream shadow-lg shadow-sage/20"
            >
              Review picks →
            </Link>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Gaps() {
  const score = Math.round(
    gaps.reduce((sum, g) => sum + Math.min(100, (g.current / g.ideal) * 100), 0) / gaps.length,
  );
  const band =
    score >= 85
      ? { label: "Excellent alignment", tone: "sage" as const }
      : score >= 70
      ? { label: "On track", tone: "sage" as const }
      : score >= 55
      ? { label: "Needs attention", tone: "terracotta" as const }
      : { label: "Off course", tone: "terracotta" as const };
  const circ = 2 * Math.PI * 42;
  const dash = (score / 100) * circ;
  const isWarm = band.tone === "terracotta";

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-forest/5 bg-card p-5">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--clay)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={isWarm ? "var(--terracotta)" : "var(--sage)"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center leading-none">
                <div className="font-serif text-2xl">{score}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-widest text-forest/50">
                  / 100
                </div>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-forest/50">
              Alignment score
            </p>
            <p className="mt-1 font-serif text-xl leading-tight">{band.label}</p>
            <p className="mt-1 text-xs text-forest/60">
              How closely this week's basket matches your ideal nutrition profile.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {gaps.map((g) => {
          const pct = Math.min(100, Math.round((g.current / g.ideal) * 100));
          const isLow = g.status === "low";
          return (
            <div key={g.name} className="rounded-2xl border border-forest/5 bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="font-medium">{g.name}</span>
                <span className={`text-sm ${isLow ? "text-terracotta" : "text-sage"}`}>
                  {isLow ? `-${100 - pct}% vs ideal` : "Optimal"}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-clay">
                <div
                  className={`h-full rounded-full ${isLow ? "bg-terracotta" : "bg-sage"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {g.symptom && (
                <div className="mt-4 rounded-xl bg-terracotta/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-terracotta">
                    What this might feel like
                  </p>
                  <p className="mt-1 text-sm leading-snug">{g.symptom}</p>
                </div>
              )}
              {g.swaps.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-forest/50">
                    Easy foods to add
                  </p>
                  <ul className="mt-2 space-y-2">
                    {g.swaps.map((s) => (
                      <li key={s.food} className="flex gap-3 rounded-xl bg-clay/60 px-3 py-2">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-sage" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{s.food}</p>
                          <p className="mt-0.5 text-xs text-forest/60">{s.note}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="rounded-xl bg-clay px-4 py-3 text-center text-[11px] italic leading-relaxed text-forest/60">
        Not medical advice — for informational purposes only. Talk to a qualified professional
        before making significant dietary changes.
      </p>
    </section>
  );
}

function Recipes() {
  const selected = useStore((s) => s.selectedRecipeIds);
  return (
    <section className="space-y-4">
      <p className="text-sm text-forest/70">
        Each recipe targets at least one of your current gaps. Tap to add to your shopping list.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {recipes.map((r) => {
          const picked = selected.includes(r.id);
          return (
            <button
              key={r.id}
              onClick={() => store.toggleRecipe(r.id)}
              className={`group overflow-hidden rounded-3xl border bg-card text-left transition-all ${
                picked ? "border-sage ring-2 ring-sage/30" : "border-forest/5"
              }`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-clay">
                <img
                  src={r.image}
                  alt={r.title}
                  loading="lazy"
                  width={800}
                  height={600}
                  className="size-full object-cover"
                />
                {picked && (
                  <div className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-sage text-cream shadow-lg">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="chip bg-sage/10 text-sage">{r.tag}</span>
                  <span className="shrink-0 text-xs font-medium text-forest/60">€{r.costEur.toFixed(2)} / pp</span>
                </div>
                <h3 className="font-serif text-lg leading-tight">{r.title}</h3>
                <p className="mt-1 text-xs text-forest/60">
                  Closes: {r.fixes} · {r.prepMin} min prep
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Trends() {
  const max = 110;
  const w = 320;
  const h = 160;
  const pad = 16;
  const stepX = (w - pad * 2) / (trends.length - 1);

  function path(key: "magnesium" | "fiber" | "vitaminD") {
    return trends
      .map((t, i) => {
        const x = pad + i * stepX;
        const y = h - pad - (t[key] / max) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const series = [
    { key: "magnesium" as const, label: "Magnesium", color: "var(--terracotta)" },
    { key: "fiber" as const, label: "Fiber", color: "var(--sage)" },
    { key: "vitaminD" as const, label: "Vitamin D", color: "var(--forest)" },
  ];

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-forest/5 bg-card p-6">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="font-serif text-xl">4-week trend</h3>
            <p className="text-xs text-forest/60">% of ideal intake, weekly</p>
          </div>
          <span className="chip bg-sage/10 text-sage">↑ improving</span>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full">
          {/* baseline */}
          <line x1={pad} x2={w - pad} y1={h - pad - ((100 / max) * (h - pad * 2))} y2={h - pad - ((100 / max) * (h - pad * 2))} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" />
          {series.map((s) => (
            <g key={s.key}>
              <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {trends.map((t, i) => {
                const x = pad + i * stepX;
                const y = h - pad - (t[s.key] / max) * (h - pad * 2);
                return <circle key={i} cx={x} cy={y} r="3" fill={s.color} />;
              })}
            </g>
          ))}
          {trends.map((t, i) => (
            <text key={t.week} x={pad + i * stepX} y={h - 2} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.5">
              {t.week}
            </text>
          ))}
        </svg>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              <span className="text-forest/70">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {series.map((s) => {
          const first = trends[0][s.key];
          const last = trends[trends.length - 1][s.key];
          const diff = last - first;
          return (
            <div key={s.key} className="rounded-2xl border border-forest/5 bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-forest/50">{s.label}</p>
              <p className="mt-1 font-serif text-2xl">{last}%</p>
              <p className="mt-0.5 text-xs text-sage">+{diff} pts in 4 weeks</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
