import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import hero from "@/assets/hero-produce.jpg";
import { store, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NutriWise — Nutrition that learns from your grocery basket" },
      { name: "description", content: "NutriWise turns your grocery receipts into a living nutrition coach. Close gaps, find recipes, build smarter shopping lists." },
      { property: "og:title", content: "NutriWise — Your nutrition, actually understood" },
      { property: "og:description", content: "The more you upload, the smarter it gets." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const router = useRouter();
  const onboarded = useStore((s) => s.onboarded);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  // Returning users skip the landing page
  useEffect(() => {
    if (onboarded) router.navigate({ to: "/dashboard" });
  }, [onboarded, router]);

  return (
    <div className="min-h-screen bg-cream text-forest">
      <nav className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-full bg-sage">
            <div className="size-3 rounded-full bg-cream" />
          </div>
          <span className="font-serif text-xl font-semibold tracking-tight">NutriWise</span>
        </div>
        <button
          onClick={() => {
            store.set({ onboarded: true });
            router.navigate({ to: "/dashboard" });
          }}
          className="text-xs font-medium text-forest/60 hover:text-forest"
        >
          Skip demo →
        </button>
      </nav>

      <main className="mx-auto max-w-2xl px-5 pb-16">
        <section className="space-y-6 pt-10 text-center">
          <span className="chip bg-clay text-forest/60">A nutrition coach, on autopilot</span>
          <h1 className="text-balance font-serif text-4xl leading-[1.05] md:text-6xl">
            Your nutrition, <br />
            <span className="italic text-sage">actually understood.</span>
          </h1>
          <p className="mx-auto max-w-md text-balance text-forest/70">
            NutriWise scans your grocery receipts to bridge the gap between what you buy and what
            your body needs. No food logging — just real insight that gets sharper every week.
          </p>
          <div className="flex flex-col items-center gap-3 pt-2">
            <Link
              to="/onboarding"
              className="inline-flex h-12 items-center justify-center rounded-full bg-sage px-8 font-medium text-cream shadow-lg shadow-sage/20 transition-transform active:scale-95"
            >
              Get Started
            </Link>
            <span className="text-xs text-forest/50">Takes about 3 minutes. No card needed.</span>
          </div>
        </section>

        <figure className="mt-12 overflow-hidden rounded-[2rem]">
          <img
            src={hero}
            alt="Fresh produce and grains on a linen cloth"
            width={1200}
            height={900}
            className="aspect-[4/3] w-full object-cover"
          />
        </figure>

        <section className="mt-14 space-y-8">
          <h2 className="text-center font-serif text-2xl">How the loop works</h2>
          <ol className="space-y-5">
            {[
              { n: "01", t: "Snap your receipt", d: "Upload after every grocery run. We match items to a nutrition database — no typing." },
              { n: "02", t: "See your real gaps", d: "Compare what you actually eat to your ideal profile, and what those gaps might feel like." },
              { n: "03", t: "Cook recipes that close them", d: "Pick from suggestions tailored to your missing nutrients and budget." },
              { n: "04", t: "Shop the smart list", d: "A categorized basket lands ready — then upload the next receipt to keep learning." },
            ].map((s) => (
              <li key={s.n} className="flex gap-4 rounded-2xl border border-forest/5 bg-card p-5">
                <span className="font-serif text-2xl italic text-terracotta">{s.n}</span>
                <div>
                  <h3 className="font-serif text-lg leading-tight">{s.t}</h3>
                  <p className="mt-1 text-sm text-forest/70">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Social proof / trust strip */}
        <section className="mt-14">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[11px] font-bold uppercase tracking-widest text-forest/40">
            <span>As featured in</span>
            <span className="font-serif text-base normal-case tracking-tight text-forest/60">Wired</span>
            <span className="font-serif text-base italic normal-case tracking-tight text-forest/60">The Times</span>
            <span className="font-serif text-base normal-case tracking-tight text-forest/60">Monocle</span>
            <span className="font-serif text-base normal-case tracking-tight text-forest/60">Kinfolk</span>
          </div>
        </section>

        {/* Testimonials */}
        <section className="mt-14 space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-2xl">Loved by 12,000+ home cooks</h2>
            <div className="flex items-center gap-1 text-sm text-forest/70">
              <span className="text-terracotta">★★★★★</span>
              <span>4.8</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { q: "I stopped guessing why I felt foggy by 3pm. Turns out my magnesium was constantly low — fixed in two weeks.", n: "Léa M.", r: "Marketing Lead · Paris" },
              { q: "The receipt upload is genuinely magic. No food logging, no judgment, just useful nudges.", n: "Daniel K.", r: "Software Engineer · Berlin" },
              { q: "My partner and I cook from the recipe list every Sunday. Grocery bills dropped €40/week.", n: "Sofía R.", r: "Architect · Madrid" },
              { q: "Finally a nutrition app that doesn't shame me for buying chocolate.", n: "Mira T.", r: "PhD Student · Amsterdam" },
            ].map((t) => (
              <figure key={t.n} className="rounded-2xl border border-forest/5 bg-card p-5">
                <blockquote className="font-serif text-lg leading-snug">"{t.q}"</blockquote>
                <figcaption className="mt-3 text-xs text-forest/60">
                  <span className="font-semibold text-forest">{t.n}</span> — {t.r}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-16 space-y-6">
          <div className="text-center">
            <span className="chip bg-sage/10 text-sage">Simple pricing</span>
            <h2 className="mt-3 font-serif text-3xl">Start free. Upgrade when it earns it.</h2>
            <p className="mt-2 text-sm text-forest/60">
              Cancel anytime. 14-day money-back guarantee on Plus. EUR, incl. VAT.
            </p>

            <div className="mx-auto mt-5 inline-flex rounded-full border border-forest/10 bg-card p-1 text-sm">
              {(["monthly", "annual"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  aria-pressed={billing === b}
                  className={`relative rounded-full px-4 py-1.5 font-medium transition-colors ${
                    billing === b ? "bg-sage text-cream" : "text-forest/60 hover:text-forest"
                  }`}
                >
                  {b === "monthly" ? "Monthly" : "Annual"}
                  {b === "annual" && (
                    <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${billing === "annual" ? "bg-cream/20 text-cream" : "bg-terracotta/15 text-terracotta"}`}>
                      Save 20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const tiers = [
              {
                name: "Starter",
                tagline: "For trying the loop",
                monthly: 0,
                annual: 0,
                cta: "Start free",
                highlight: false,
                features: [
                  "2 receipt uploads / month",
                  "Basic gap analysis",
                  "3 recipe suggestions",
                  "Community support",
                ],
              },
              {
                name: "Plus",
                tagline: "The full coaching loop",
                monthly: 9,
                annual: 7,
                cta: "Start 14-day free trial",
                highlight: true,
                features: [
                  "Unlimited receipt uploads",
                  "Full trends (The Arc™)",
                  "Personalized weekly recipes",
                  "Smart shopping list export",
                  "Priority email support",
                ],
              },
              {
                name: "Family",
                tagline: "Up to 4 profiles",
                monthly: 16,
                annual: 13,
                cta: "Start 14-day free trial",
                highlight: false,
                features: [
                  "Everything in Plus",
                  "4 individual nutrition profiles",
                  "Shared household shopping list",
                  "Allergy-aware meal planning",
                ],
              },
            ];

            return (
              <div className="grid gap-4 md:grid-cols-3">
                {tiers.map((t) => {
                  const price = billing === "monthly" ? t.monthly : t.annual;
                  const suffix = price === 0 ? "forever" : "/mo";
                  return (
                    <div
                      key={t.name}
                      className={`relative rounded-3xl border bg-card p-6 ${
                        t.highlight
                          ? "border-2 border-sage shadow-lg shadow-sage/10"
                          : "border-forest/10"
                      }`}
                    >
                      {t.highlight && (
                        <span className="absolute -top-3 left-6 rounded-full bg-sage px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream">
                          Most popular
                        </span>
                      )}
                      <h3 className="font-serif text-xl">{t.name}</h3>
                      <p className="mt-1 text-sm text-forest/60">{t.tagline}</p>
                      <p className="mt-4 font-serif text-4xl">
                        €{price}
                        <span className="text-base text-forest/50">{suffix}</span>
                      </p>
                      {billing === "annual" && t.monthly > 0 && (
                        <p className="mt-1 text-[11px] text-forest/50">
                          €{t.annual * 12} billed yearly · save €{(t.monthly - t.annual) * 12}
                        </p>
                      )}
                      {billing === "monthly" && t.monthly > 0 && (
                        <p className="mt-1 text-[11px] text-forest/50">Billed monthly · cancel anytime</p>
                      )}
                      <ul className="mt-5 space-y-2 text-sm text-forest/75">
                        {t.features.map((f) => (
                          <li key={f} className="flex gap-2">
                            <span className="text-sage">✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/onboarding"
                        className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-full font-medium ${
                          t.highlight
                            ? "bg-sage text-cream"
                            : "border border-forest/20 text-forest hover:bg-clay"
                        }`}
                      >
                        {t.cta}
                      </Link>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Billing reassurance row */}
          <ul className="grid gap-3 text-xs text-forest/60 sm:grid-cols-4">
            {[
              { t: "No credit card for Starter", d: "Try the full loop for free." },
              { t: "Cancel in 2 clicks", d: "From Settings, no email required." },
              { t: "Pause anytime", d: "Keep your data, freeze billing." },
              { t: "VAT receipts", d: "Auto-emailed each cycle (EU invoicing)." },
            ].map((x) => (
              <li key={x.t} className="rounded-2xl border border-forest/5 bg-card/60 p-3">
                <p className="font-medium text-forest">{x.t}</p>
                <p className="mt-1">{x.d}</p>
              </li>
            ))}
          </ul>

          {/* Billing FAQ */}
          <div className="rounded-3xl border border-forest/5 bg-card p-6">
            <h3 className="font-serif text-lg">Billing questions, answered</h3>
            <div className="mt-4 divide-y divide-forest/5">
              {[
                {
                  q: "What happens after the 14-day Plus trial?",
                  a: "We'll email you 3 days before it ends. If you don't upgrade, your account quietly drops back to Starter — no surprise charges, ever.",
                },
                {
                  q: "Which payment methods do you accept?",
                  a: "All major cards (Visa, Mastercard, Amex), Apple Pay, Google Pay, iDEAL, Bancontact, and SEPA Direct Debit for EU customers.",
                },
                {
                  q: "Can I switch tiers later?",
                  a: "Yes. Upgrades are prorated to the day; downgrades take effect at the end of your billing cycle.",
                },
                {
                  q: "Is there a student or NGO discount?",
                  a: "Verified students and registered non-profits get 50% off Plus. Email hello@nutriwise.eu with proof.",
                },
              ].map((f) => (
                <details key={f.q} className="group py-3">
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                    <span>{f.q}</span>
                    <span className="text-forest/40 transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  <p className="mt-2 text-sm text-forest/65">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Security & trust badges */}
        <section className="mt-14 rounded-3xl border border-forest/5 bg-card p-6">
          <h2 className="font-serif text-xl">Your data stays yours</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              { t: "GDPR compliant", d: "Built in the EU. Export or delete your data anytime." },
              { t: "Bank-grade encryption", d: "TLS 1.3 in transit, AES-256 at rest." },
              { t: "Never sold", d: "We don't sell data to insurers, brands, or anyone else." },
            ].map((b) => (
              <div key={b.t}>
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-sage/15 text-xs text-sage">✓</span>
                  <span className="text-sm font-semibold">{b.t}</span>
                </div>
                <p className="mt-1 pl-8 text-xs text-forest/60">{b.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl bg-forest p-8 text-cream">
          <p className="font-serif text-2xl leading-snug">
            "The more you upload, the smarter it gets."
          </p>
          <p className="mt-3 text-sm text-cream/70">
            After 3 receipts, your trends chart fills in. After 6, the recipe suggestions start
            anticipating what you'll be missing next week.
          </p>
        </section>

        <div className="mt-12 text-center">
          <Link
            to="/onboarding"
            className="inline-flex h-12 items-center justify-center rounded-full bg-sage px-8 font-medium text-cream"
          >
            Start the 3-minute setup
          </Link>
          <p className="mt-3 text-xs text-forest/50">No credit card · Not medical advice</p>
        </div>
      </main>

      <footer className="border-t border-forest/5 bg-cream px-5 py-8 text-xs text-forest/55">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div>
            <p className="font-serif text-sm text-forest">NutriWise</p>
            <p className="mt-1">NutriWise B.V. · Herengracht 182, 1016 BR Amsterdam, NL · KVK 87654321</p>
          </div>
          <div className="flex gap-4">
            <a href="#pricing" className="hover:text-forest">Pricing</a>
            <a href="mailto:hello@nutriwise.app" className="hover:text-forest">Contact</a>
            <a href="#" className="hover:text-forest">Privacy</a>
            <a href="#" className="hover:text-forest">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
