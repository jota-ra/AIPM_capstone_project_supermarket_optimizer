import { Card, SectionLabel } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage, type Lang } from "@/lib/i18n";
import type { StepId } from "@/components/AppShell";

// DUMMY / layout mockup — deliberately static, no API calls. Purpose:
// let the team evaluate the information architecture (what goes where,
// cards vs. tabs, what's in the quick-actions grid) before wiring real
// data. Every number/message below is a placeholder illustrating the
// SHAPE of real content, not a live value — see the review notes
// discussed with the user before building this.
//
// Deliberately no internal tab/sub-nav here: the app already has a
// global top nav (AppShell.tsx). A second, page-local tab system would
// create two competing navigation models. Instead this is a single-page
// hub of cards/buttons that launch into the existing dedicated pages
// (Pantry, Upload, Results, Profile) — the Dashboard itself never tries
// to replace those pages' depth.

type Bi = { en: string; de: string };
function bi(en: string, de: string): Bi {
  return { en, de };
}

const GREETING_FALLBACK = bi("Welcome back", "Willkommen zurück");
const HEALTH_LABEL = bi("Health score", "Health Score");
const REMINDER_TEXT = bi(
  "You haven't confirmed anything in 3 days — your estimates are getting less accurate.",
  "Du hast seit 3 Tagen nichts bestätigt — deine Schätzungen werden ungenauer.",
);
const REMINDER_CTA = bi("Confirm now", "Jetzt bestätigen");
const COACH_LABEL = bi("Your coach today", "Dein Coach heute");
const COACH_DUMMY = bi(
  "Nice work this week — your protein intake is right on target. One thing to watch: your iron is trending low. A handful of spinach or lentils would help close that gap.",
  "Gute Arbeit diese Woche — deine Proteinzufuhr liegt genau im Zielbereich. Ein Punkt zum Beobachten: dein Eisenwert tendiert nach unten. Eine Handvoll Spinat oder Linsen würde diese Lücke schließen.",
);
const QUICK_ACTIONS_LABEL = bi("Quick actions", "Schnellzugriff");
const NEXT_STEP_LABEL = bi("Your next step", "Dein nächster Schritt");
const NEXT_STEP_DUMMY_ITEM = bi("Lentils", "Rote Linsen");
const NEXT_STEP_DUMMY_REASON = bi(
  "Targets your iron gap — allowed under your vegan profile.",
  "Zielt auf deine Eisen-Lücke — passt zu deinem veganen Profil.",
);
const SEE_DETAILS = bi("See full details →", "Alle Details →");
const PROGRESS_LABEL = bi("This week's trend", "Trend diese Woche");
const PROGRESS_DUMMY = [
  { key: "iron", label: bi("Iron", "Eisen"), direction: "up" as const },
  { key: "protein", label: bi("Protein", "Protein"), direction: "flat" as const },
  { key: "fiber", label: bi("Fiber", "Ballaststoffe"), direction: "up" as const },
];
const ACTIONS: { icon: string; label: Bi; sub: Bi; target: StepId }[] = [
  {
    icon: "🧾",
    label: bi("Upload a receipt", "Kassenbon hochladen"),
    sub: bi("Add your latest shop", "Deinen letzten Einkauf ergänzen"),
    target: "upload",
  },
  {
    icon: "🧺",
    label: bi("Manage pantry", "Lager pflegen"),
    sub: bi("Confirm what you ate", "Bestätigen, was du gegessen hast"),
    target: "pantry",
  },
  {
    icon: "📊",
    label: bi("View full results", "Ergebnisse im Detail"),
    sub: bi("Gaps, score, progress", "Lücken, Score, Verlauf"),
    target: "results",
  },
  {
    icon: "👤",
    label: bi("Edit profile", "Profil bearbeiten"),
    sub: bi("Goals, diet, allergies", "Ziele, Ernährung, Allergien"),
    target: "userProfile",
  },
];

export function DashboardStep({
  profileName,
  onNavigate,
}: {
  profileName?: string | null;
  onNavigate: (step: StepId) => void;
}) {
  const { language } = useLanguage();
  const lang: Lang = language;
  const greeting = profileName ? `Hi ${profileName} 👋` : `${GREETING_FALLBACK[lang]} 👋`;

  return (
    <section className="space-y-6 px-6 pb-16">
      <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
        Dummy — layout mockup, no live data
      </span>

      <header className="flex items-center justify-between">
        <h1 className="text-balance text-3xl font-medium leading-none tracking-tight">{greeting}</h1>
        <div className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 ring-1 ring-black/5">
          <span className="text-xs uppercase tracking-widest text-ink/40">{HEALTH_LABEL[lang]}</span>
          <span className="text-lg font-semibold tracking-tight text-emerald-600">82</span>
        </div>
      </header>

      {/* Reminder — highest priority, shown only when actionable */}
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200">
        <p className="text-sm text-amber-800">{REMINDER_TEXT[lang]}</p>
        <button
          type="button"
          onClick={() => onNavigate("pantry")}
          className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-xs font-medium tracking-tight text-white hover:opacity-90"
        >
          {REMINDER_CTA[lang]}
        </button>
      </div>

      {/* Coach message */}
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#7c9a6a] text-sm ring-2 ring-white"
          >
            🌱
          </span>
          <SectionLabel>{COACH_LABEL[lang]}</SectionLabel>
        </div>
        <p className="text-sm leading-relaxed text-ink/80">{COACH_DUMMY[lang]}</p>
      </Card>

      {/* Quick actions */}
      <div className="space-y-2">
        <SectionLabel>{QUICK_ACTIONS_LABEL[lang]}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {ACTIONS.map((action) => (
            <button
              key={action.target}
              type="button"
              onClick={() => onNavigate(action.target)}
              className="flex items-start gap-3 rounded-2xl bg-surface p-4 text-left ring-1 ring-black/5 transition-colors hover:bg-zinc-50"
            >
              <span className="text-xl">{action.icon}</span>
              <span>
                <span className="block text-sm font-medium tracking-tight">{action.label[lang]}</span>
                <span className="block text-xs text-ink/50">{action.sub[lang]}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Next Cart teaser */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>{NEXT_STEP_LABEL[lang]}</SectionLabel>
          <button
            type="button"
            onClick={() => onNavigate("results")}
            className="text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
          >
            {SEE_DETAILS[lang]}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium tracking-tight">{NEXT_STEP_DUMMY_ITEM[lang]}</p>
            <p className="text-xs text-ink/50">{NEXT_STEP_DUMMY_REASON[lang]}</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-ink/50">
            Add
          </span>
        </div>
      </Card>

      {/* Progress mini-strip */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>{PROGRESS_LABEL[lang]}</SectionLabel>
          <button
            type="button"
            onClick={() => onNavigate("results")}
            className="text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
          >
            {SEE_DETAILS[lang]}
          </button>
        </div>
        <div className="flex flex-wrap gap-4">
          {PROGRESS_DUMMY.map((row) => (
            <div key={row.key} className="flex items-center gap-1.5 text-sm">
              <span className="capitalize text-ink/70">{row.label[lang]}</span>
              <span
                className={cn(
                  "font-semibold",
                  row.direction === "up" && "text-emerald-600",
                  row.direction === "flat" && "text-ink/40",
                )}
              >
                {row.direction === "up" ? "↑" : "→"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
