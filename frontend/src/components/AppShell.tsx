import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StepId = "upload" | "review" | "profile" | "results";

const NAV: { id: StepId; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "review", label: "Review" },
  { id: "profile", label: "Profile" },
  { id: "results", label: "Results" },
];

export function AppShell({
  step,
  onNavigate,
  children,
}: {
  step: StepId;
  onNavigate: (step: StepId) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-ink/10">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8">
        <button
          type="button"
          onClick={() => onNavigate("upload")}
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
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-3xl">{children}</main>
      <footer className="mx-auto max-w-3xl px-6 py-12 text-[11px] uppercase tracking-widest text-ink/35">
        NutriWise · estimated from your shopping habits, not actual intake
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
