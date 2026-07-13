import { useState } from "react";
import { Card, SectionLabel } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useLanguage, type Lang } from "@/lib/i18n";

// DUMMY — static placeholder list, no backend endpoint behind it yet.
// Reached via the bell icon in AppShell.tsx's nav. Purpose: evaluate
// whether a dedicated notifications view earns its place next to the
// Dashboard (which already surfaces the single most relevant reminder/
// insight) before wiring it to something real — e.g. a feed built from
// pantry reminders, new coach insights, and progress-trend changes.

type Bi = { en: string; de: string };
function bi(en: string, de: string): Bi {
  return { en, de };
}

type NotificationKind = "reminder" | "insight" | "receipt" | "progress";

const KIND_ICON: Record<NotificationKind, string> = {
  reminder: "🧺",
  insight: "🌱",
  receipt: "🧾",
  progress: "📈",
};

const DUMMY_NOTIFICATIONS: { id: string; kind: NotificationKind; title: Bi; time: Bi; unread: boolean }[] = [
  {
    id: "1",
    kind: "reminder",
    title: bi(
      "You haven't confirmed your pantry in 3 days.",
      "Du hast dein Lager seit 3 Tagen nicht bestätigt.",
    ),
    time: bi("2 hours ago", "vor 2 Stunden"),
    unread: true,
  },
  {
    id: "2",
    kind: "insight",
    title: bi(
      "Your coach found a new insight: iron is trending low.",
      "Dein Coach hat eine neue Erkenntnis: Eisen tendiert nach unten.",
    ),
    time: bi("Yesterday", "Gestern"),
    unread: true,
  },
  {
    id: "3",
    kind: "receipt",
    title: bi(
      "Your receipt from REWE was successfully analyzed.",
      "Dein Kassenbon von REWE wurde erfolgreich analysiert.",
    ),
    time: bi("3 days ago", "Vor 3 Tagen"),
    unread: false,
  },
  {
    id: "4",
    kind: "progress",
    title: bi(
      "Your health score improved from 76 to 82 this week.",
      "Dein Health Score ist diese Woche von 76 auf 82 gestiegen.",
    ),
    time: bi("1 week ago", "Vor 1 Woche"),
    unread: false,
  },
];

export function NotificationsStep() {
  const { language, t } = useLanguage();
  const lang: Lang = language;
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);

  const hasUnread = notifications.some((n) => n.unread);

  return (
    <section className="space-y-6 px-6 pb-16">
      <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
        {t("notifications.dummyBadge")}
      </span>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-balance text-3xl font-medium leading-none tracking-tight">
            {t("notifications.title")}
          </h1>
          <p className="mt-2 max-w-[48ch] text-pretty text-sm text-ink/60">{t("notifications.body")}</p>
        </div>
        {hasUnread ? (
          <button
            type="button"
            onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))}
            className="shrink-0 text-xs font-medium tracking-tight text-ink/50 hover:text-ink"
          >
            {t("notifications.markAllRead")}
          </button>
        ) : null}
      </header>

      {notifications.length === 0 ? (
        <p className="text-sm text-ink/50">{t("notifications.empty")}</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={cn("flex items-start gap-3", n.unread && "ring-1 ring-[#7c9a6a]/40")}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef2ea] text-base">
                {KIND_ICON[n.kind]}
              </span>
              <div className="flex-1 space-y-0.5">
                <p className={cn("text-sm", n.unread ? "font-semibold text-ink" : "text-ink/70")}>
                  {n.title[lang]}
                </p>
                <SectionLabel>{n.time[lang]}</SectionLabel>
              </div>
              {n.unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#7c9a6a]" /> : null}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
