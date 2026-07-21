import { useState } from "react";
import { useLanguage } from "@/lib/i18n";

// Shared across every page (AppShell.tsx pages, plus LandingStep and
// AccountPickerStep, which render outside AppShell). Uses the app-wide
// ink/canvas opacity tokens rather than any page-specific palette, so
// it reads correctly whether the page above it is the plain canvas
// background or Landing/AccountPicker's cream one.
//
// "Privacy policy" / "Imprint" / "Help & FAQ" are placeholder links —
// there's no real page behind them yet, so clicking one shows an inline
// notice instead of silently doing nothing or 404ing. "Delete / reset
// my data" is the one real function here (see App.tsx's handleDeleteData).
type PlaceholderKey = "privacy" | "imprint" | "help";

const PLACEHOLDER_LINKS: { key: PlaceholderKey; labelKey: string }[] = [
  { key: "privacy", labelKey: "footer.privacy" },
  { key: "imprint", labelKey: "footer.imprint" },
  { key: "help", labelKey: "footer.help" },
];

export function Footer({
  onDeleteData,
  canDeleteData,
}: {
  onDeleteData?: () => void;
  canDeleteData?: boolean;
}) {
  const { t } = useLanguage();
  const [openNotice, setOpenNotice] = useState<PlaceholderKey | null>(null);

  return (
    <footer className="mx-auto max-w-3xl space-y-3 px-6 py-12 text-[11px] text-ink/35">
      <p className="uppercase tracking-widest">{t("footer.tagline")}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 normal-case tracking-normal text-ink/50">
        {PLACEHOLDER_LINKS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setOpenNotice((prev) => (prev === item.key ? null : item.key))}
            className="underline decoration-ink/20 underline-offset-2 hover:text-ink"
          >
            {t(item.labelKey)}
          </button>
        ))}
        {onDeleteData ? (
          <button
            type="button"
            onClick={onDeleteData}
            disabled={!canDeleteData}
            className="underline decoration-ink/20 underline-offset-2 hover:text-ink disabled:cursor-not-allowed disabled:text-ink/25 disabled:no-underline"
          >
            {t("footer.deleteData")}
          </button>
        ) : null}
      </div>
      {openNotice ? (
        <p className="normal-case tracking-normal text-ink/40">{t("footer.placeholderNotice")}</p>
      ) : null}
    </footer>
  );
}
