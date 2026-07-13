import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { Footer } from "@/components/Footer";

export type StepId =
  | "landing"
  | "accountPicker"
  | "dashboard"
  | "upload"
  | "onboardingUpload"
  | "review"
  | "onboarding"
  | "userProfile"
  | "pantry"
  | "results"
  | "notifications";

// Flow order: Disclaimer (consent gate) -> Onboarding -> Upload -> Review -> Results.
// "User Profile" and "Pantry" (Lager-Bestand) are standalone pages reachable
// from the nav at any time, not part of that linear flow — the pantry
// accumulates across every receipt in the session, not just the latest one.
// "Dashboard" (DashboardStep.tsx, currently a static layout dummy) is the
// new home for returning users — first in the list on purpose.
//
// "Onboarding" is deliberately NOT a permanent nav destination: it's a
// one-time, situational flow (new account setup), not something a
// returning user should ever tap into by accident. It's still reachable
// via its own entry points (Landing's "Register", the empty-profile
// nudge on My Profile) — just not surfaced as a tab to click into at
// random, which risked resetting an existing user's answers mid-session.
const NAV: { id: StepId; labelKey: string; icon: string }[] = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: "🏠" },
  { id: "userProfile", labelKey: "nav.userProfile", icon: "👤" },
  { id: "upload", labelKey: "nav.upload", icon: "🧾" },
  { id: "review", labelKey: "nav.review", icon: "🔍" },
  { id: "pantry", labelKey: "nav.pantry", icon: "🧺" },
  { id: "results", labelKey: "nav.results", icon: "📊" },
];

export function AppShell({
  step,
  onNavigate,
  onDeleteData,
  canDeleteData,
  children,
}: {
  step: StepId;
  onNavigate: (step: StepId) => void;
  onDeleteData?: () => void;
  canDeleteData?: boolean;
  children: ReactNode;
}) {
  const { t, language, setLanguage } = useLanguage();
  // During onboarding — including its baseline-receipt continuation,
  // OnboardingUploadStep.tsx — the tab nav is hidden on purpose (the
  // user shouldn't be able to jump to Results/Pantry mid-flow, before a
  // profile or first receipt even exists) — a language toggle takes its
  // place instead, same pill pattern as LandingStep's header, since the
  // chat no longer asks a language question itself (removed: language
  // is chosen once, on the landing page, and stays changeable from here).
  const isOnboarding = step === "onboarding" || step === "onboardingUpload";
  const langToggle = (
    <div className="flex shrink-0 gap-1 rounded-full bg-surface p-1 text-xs ring-1 ring-black/5">
      {(["en", "de"] as const).map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => setLanguage(lng)}
          className={cn(
            "rounded-full px-2.5 py-1 font-medium uppercase tracking-widest transition-colors",
            language === lng ? "bg-ink text-canvas" : "text-ink/50 hover:text-ink",
          )}
        >
          {lng}
        </button>
      ))}
    </div>
  );
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-ink/10">
      <nav className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-6">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className="flex shrink-0 items-center gap-3"
        >
          <span className="size-5 rounded-full bg-ink" />
          <span className="text-sm font-medium tracking-tight">NutriWise</span>
        </button>
        {/* Bug fix: the tab list used to be `hidden sm:flex` — on any
            viewport narrower than the `sm` breakpoint there was no nav
            at all, only the logo. Now it always renders and scrolls
            horizontally instead of disappearing, so it's never a dead
            end on mobile. The language toggle stays visible everywhere
            (previously only shown during onboarding — outside it there
            was no way to change language at all once past the chat). */}
        <div className="flex flex-1 items-center justify-end gap-2 overflow-x-auto">
          {!isOnboarding ? (
            <>
              <div className="flex shrink-0 gap-1 rounded-full bg-surface p-1 ring-1 ring-black/5">
                {NAV.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-tight transition-colors",
                      step === item.id ? "bg-ink text-canvas" : "text-ink/55 hover:text-ink",
                    )}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
              {/* Notifications — icon-only, deliberately separate from
                  the main tab pill group (same convention as most apps:
                  a bell is a signal to check, not a "section" of the
                  app you navigate into and stay in). Dummy unread dot
                  hardcoded on for now — see NotificationsStep.tsx. */}
              <button
                type="button"
                onClick={() => onNavigate("notifications")}
                aria-label={t("nav.notifications")}
                className={cn(
                  "relative flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 transition-colors",
                  step === "notifications" ? "bg-ink text-canvas" : "bg-surface text-ink/55 hover:text-ink",
                )}
              >
                <span aria-hidden>🔔</span>
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-red-500" />
              </button>
            </>
          ) : null}
          {langToggle}
        </div>
      </nav>
      <main className="mx-auto max-w-3xl">{children}</main>
      <Footer onDeleteData={onDeleteData} canDeleteData={canDeleteData} />
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-widest text-ink/40">
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-surface p-5 ring-1 ring-black/5", className)}>
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "w-full rounded-2xl bg-ink px-6 py-4 text-sm font-medium tracking-tight text-canvas transition-opacity disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm font-medium tracking-tight capitalize ring-1 transition-colors",
            value === opt
              ? "bg-ink text-canvas ring-ink"
              : "bg-zinc-50 text-ink/60 ring-black/5 hover:text-ink",
          )}
        >
          {opt.replace(/_/g, " ")}
        </button>
      ))}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl bg-zinc-50 px-4 py-3 text-sm text-ink ring-1 ring-black/5 outline-none focus:ring-ink/30";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <div>{children}</div>
    </label>
  );
}
