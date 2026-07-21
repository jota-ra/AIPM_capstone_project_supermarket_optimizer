import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { store, useStore } from "@/lib/store";
import { gaps, lastUpload, monthlyUploads, trends, uploadHistory } from "@/lib/data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · NutriWise" },
      { name: "description", content: "Your current nutrition profile, recent uploads and trend snapshot." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const name = useStore((s) => s.userName);
  const tourDismissed = useStore((s) => s.tourDismissed);
  const headlineGap = gaps.find((g) => g.status === "low")!;
  const trendChange = trends[trends.length - 1].magnesium - trends[0].magnesium;

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl space-y-8 px-5 pb-24 pt-6">
        {/* Returning user header */}
        <section className="rounded-3xl bg-forest p-7 text-cream">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cream/60">
                Welcome back
              </p>
              <h1 className="mt-1 truncate font-serif text-3xl text-cream">{name}</h1>
              <p className="mt-1 text-sm text-cream/70">Last receipt scanned {lastUpload}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-3xl text-terracotta">{monthlyUploads}</p>
              <p className="text-[10px] uppercase tracking-widest text-cream/60">
                Uploads / month
              </p>
            </div>
          </div>

          <Link
            to="/upload"
            className="group mt-7 block overflow-hidden rounded-2xl border-2 border-dashed border-cream/20 bg-cream/5 p-8 text-center transition-colors hover:border-sage/60 hover:bg-cream/10"
          >
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-sage">
              <svg viewBox="0 0 24 24" className="size-5 text-cream" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="font-medium">Upload new grocery receipt</p>
            <p className="mt-1 text-sm text-cream/60">Drag, drop, or snap a photo</p>
          </Link>
        </section>

        {/* First-time tour */}
        {!tourDismissed && (
          <section className="relative rounded-3xl border border-sage/20 bg-sage/5 p-6">
            <button
              aria-label="Dismiss tour"
              onClick={() => store.set({ tourDismissed: true })}
              className="absolute right-4 top-4 grid size-7 place-items-center rounded-full text-forest/40 hover:bg-forest/5 hover:text-forest"
            >
              ✕
            </button>
            <span className="chip bg-sage/15 text-sage">New here? Quick tour</span>
            <h2 className="mt-3 font-serif text-2xl">How NutriWise works</h2>
            <p className="mt-1 text-sm text-forest/65">
              Three repeatable steps. The more receipts you add, the sharper your profile becomes.
            </p>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { n: "1", t: "Upload a receipt", d: "Snap or drop a photo — we identify each item in seconds." },
                { n: "2", t: "Review your gaps", d: "See what nutrients you're missing and likely symptoms." },
                { n: "3", t: "Cook & shop", d: "Pick recipes that bridge the gap, then export a shopping list." },
              ].map((s) => (
                <li key={s.n} className="rounded-2xl border border-forest/5 bg-cream/70 p-4">
                  <div className="grid size-7 place-items-center rounded-full bg-sage text-xs font-bold text-cream">
                    {s.n}
                  </div>
                  <p className="mt-3 text-sm font-medium">{s.t}</p>
                  <p className="mt-1 text-xs text-forest/60">{s.d}</p>
                </li>
              ))}
            </ol>
            <button
              onClick={() => store.set({ tourDismissed: true })}
              className="mt-5 text-xs font-medium text-sage hover:underline"
            >
              Got it, hide this →
            </button>
          </section>
        )}

        {/* Current profile snapshot */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-serif text-2xl">Profile snapshot</h2>
            <Link to="/results" className="text-xs font-medium text-sage hover:underline">
              See full analysis →
            </Link>
          </div>

          {/* Alignment score */}
          {(() => {
            const score = Math.round(
              gaps.reduce((sum, g) => sum + Math.min(100, (g.current / g.ideal) * 100), 0) /
                gaps.length,
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
              <div className="mb-4 rounded-2xl border border-forest/5 bg-card p-5">
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <svg viewBox="0 0 100 100" className="size-20 -rotate-90">
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
                    <p className={`mt-1 font-serif text-lg leading-tight ${isWarm ? "text-terracotta" : "text-sage"}`}>
                      {band.label}
                    </p>
                    <p className="mt-1 text-xs text-forest/60">
                      How closely this week's basket matches your ideal nutrition profile.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid gap-3 sm:grid-cols-2">
            {gaps.slice(0, 4).map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.ideal) * 100));
              const isLow = g.status === "low";
              return (
                <div key={g.name} className="rounded-2xl border border-forest/5 bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{g.name}</span>
                    <span className={isLow ? "text-terracotta" : "text-sage"}>
                      {isLow ? `-${100 - pct}%` : "Optimal"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-clay">
                    <div
                      className={`h-full rounded-full ${isLow ? "bg-terracotta" : "bg-sage"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Upload history overview */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-serif text-2xl">Last uploads</h2>
            <span className="text-xs font-medium text-forest/60">{monthlyUploads} this month</span>
          </div>
          <div className="space-y-2">
            {uploadHistory.map((u) => (
              <Link
                key={u.id}
                to="/results"
                className="flex items-center gap-4 rounded-2xl border border-forest/5 bg-card p-4 transition-colors hover:border-sage/30"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-clay">
                  <svg viewBox="0 0 24 24" className="size-5 text-forest/50" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{u.store}</span>
                    <span className="text-[10px] text-forest/40">· {u.date}</span>
                  </div>
                  <p className="text-xs text-forest/60">{u.items} items matched</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-serif text-lg ${u.alignment >= 65 ? "text-sage" : "text-terracotta"}`}>{u.alignment}</p>
                  <p className="text-[9px] uppercase tracking-widest text-forest/40">/ 100</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Trend preview */}
        <section className="rounded-3xl border border-forest/5 bg-card p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-forest/50">
                Trend · 4 weeks
              </p>
              <h3 className="mt-1 truncate font-serif text-xl">Magnesium climbing steadily</h3>
            </div>
            <span className="chip shrink-0 bg-sage/10 text-sage">↑ {trendChange}%</span>
          </div>
          <div className="mt-5 flex h-24 items-end gap-2">
            {trends.map((t) => (
              <div key={t.week} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t-md bg-sage/80"
                  style={{ height: `${t.magnesium}%` }}
                />
                <span className="text-[10px] text-forest/50">{t.week}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Focus card */}
        <section className="rounded-3xl bg-clay p-6">
          <span className="chip bg-terracotta/10 text-terracotta">Today's focus</span>
          <h3 className="mt-3 font-serif text-2xl">{headlineGap.name}</h3>
          <p className="mt-1 text-sm text-forest/70">{headlineGap.symptom}</p>
          <Link
            to="/results"
            className="mt-5 inline-flex rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream"
          >
            View recipes that help →
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
