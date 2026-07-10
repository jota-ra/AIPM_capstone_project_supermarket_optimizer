import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export type StepId = "upload" | "review" | "onboarding" | "userProfile" | "results";

// Flow order: Disclaimer (consent gate) -> Onboarding -> Upload -> Review -> Results.
// "User Profile" is a standalone settings-style page (edit what onboarding
// collected), not part of that linear flow — reachable from the nav at any time.
const NAV: { id: StepId; labelKey: string }[] = [
  { id: "onboarding", labelKey: "nav.onboarding" },
  { id: "userProfile", labelKey: "nav.userProfile" },
  { id: "upload", labelKey: "nav.upload" },
  { id: "review", labelKey: "nav.review" },
  { id: "results", labelKey: "nav.results" },
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
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-ink/10">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8">
        <button
          type="button"
          onClick={() => onNavigate("onboarding")}
          className="flex items-center gap-3"
        >
          <span className="size-5 rounded-full bg-ink" />
          <span className="text-sm font-medium tracking-tight">NutriWise</span>
        </button>
        <div className="hidden gap-1 rounded-full bg-surface p-1 ring-1 ring-black/5 sm:flex">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium tracking-tight transition-colors",
                step === item.id ? "bg-ink text-canvas" : "text-ink/55 hover:text-ink",
              )}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-3xl">{children}</main>
      <footer className="mx-auto max-w-3xl space-y-3 px-6 py-12 text-[11px] uppercase tracking-widest text-ink/35">
        <p>{t("footer.tagline")}</p>
        {onDeleteData ? (
          <button
            type="button"
            onClick={onDeleteData}
            disabled={!canDeleteData}
            className="normal-case tracking-normal text-ink/50 underline decoration-ink/20 underline-offset-2 hover:text-ink disabled:cursor-not-allowed disabled:text-ink/25 disabled:no-underline"
          >
            {t("footer.deleteData")}
          </button>
        ) : null}
      </footer>
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
