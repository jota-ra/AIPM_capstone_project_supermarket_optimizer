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
//
// v2 (UX pass): the coach message and the "next step" recommendation
// used to be two separate cards saying the same thing twice (message:
// "your iron is low, try lentils" / card: "next step: lentils"). Merged
// into one "today's insight" card ending in a single, real, high-
// contrast CTA button — one clear action instead of two competing ones.
// Quick actions now read as actual buttons (tinted icon badge + hover
// lift), not flat info tiles, per the "make buttons stand out" request.

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
const COACH_LABEL = bi("Today's insight", "Deine Erkenntnis heute");
const COACH_DUMMY = bi(
  "Nice work this week — your protein intake is right on target. One thing to watch: your iron is trending low.",
  "Gute Arbeit diese Woche — deine Proteinzufuhr liegt genau im Zielbereich. Ein Punkt zum Beobachten: dein Eisenwert tendiert nach unten.",
);
const COACH_CTA = bi("Add lentils to Next Cart", "Rote Linsen zum Next Cart hinzufügen");
const COACH_CTA_SUB = bi(
  "Targets your iron gap — allowed under your vegan profile.",
  "Zielt auf deine Eisen-Lücke — passt zu deinem veganen Profil.",
);
const QUICK_ACTIONS_LABEL = bi("Quick actions", "Schnellzugriff");
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
  const { language, t } = useLanguage();
  const lang: Lang = language;
  const greeting = profileName ? `Hi ${profileName} 👋` : `${GREETING_FALLBACK[lang]} 👋`;

  return (
    <section className="space-y-6 px-6 pb-16">
      <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
        {t("dashboard.dummyBadge")}
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
          className="shrink-0 rounded-full bg-amber-600 px-4 py-2.5 text-xs font-semibold tracking-tight text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
        >
          {REMINDER_CTA[lang]}
        </button>
      </div>

      {/* Today's insight — one merged card, one clear primary action
          (previously split across a "coach message" card and a
          separate "next step" card that said the same thing twice). */}
      <Card className="space-y-4">
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
        <div className="flex flex-col gap-3 rounded-xl bg-[#f3f6f0] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink/60">{COACH_CTA_SUB[lang]}</p>
          <button
            type="button"
            onClick={() => onNavigate("results")}
            className="shrink-0 rounded-full bg-[#7c9a6a] px-5 py-2.5 text-xs font-semibold tracking-tight text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
          >
            🥬 {COACH_CTA[lang]}
          </button>
        </div>
      </Card>

      {/* Quick actions — the actual buttons, made to look and feel like
          them: tinted icon badge, elevation on hover, not a flat tile. */}
      <div className="space-y-2">
        <SectionLabel>{QUICK_ACTIONS_LABEL[lang]}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {ACTIONS.map((action) => (
            <button
              key={action.target}
              type="button"
              onClick={() => onNavigate(action.target)}
              className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-left ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-black/10"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef2ea] text-lg">
                {action.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-tight">{action.label[lang]}</span>
                <span className="block text-xs text-ink/50">{action.sub[lang]}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Progress mini-strip — lowest priority, kept visually quiet
          (no card elevation) so it reads as a footer-style status line,
          not another competing action. */}
      <div className="flex items-center justify-between rounded-2xl px-1 py-1">
        <div className="flex flex-wrap items-center gap-4">
          <SectionLabel>{PROGRESS_LABEL[lang]}</SectionLabel>
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
        <button
          type="button"
          onClick={() => onNavigate("results")}
          className="shrink-0 text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
        >
          {SEE_DETAILS[lang]}
        </button>
      </div>
    </section>
  );
}
