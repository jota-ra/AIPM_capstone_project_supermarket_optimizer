import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Demo entry point, shown before the app shell / nav mounts (see App.tsx) —
// a marketing-style hero, not another internal app screen, so it
// deliberately uses its own warm cream/sage palette instead of the
// in-app canvas/ink tokens (index.css). Scoped to this file only; nothing
// else in the app inherits these colors.
//
// "Log in" leads to the demo account picker (AccountPickerStep.tsx), not
// straight to the dashboard — there's no real auth in this MVP, so
// picking an identity is how the demo simulates "signing in".
export function LandingStep({
  onRegister,
  onLogin,
}: {
  onRegister: () => void;
  onLogin: () => void;
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f8f2e6] font-sans text-[#2a2f28] antialiased">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8">
        <span className="flex items-center gap-3">
          <span className="size-5 rounded-full bg-[#2a2f28]" />
          <span className="text-sm font-medium tracking-tight">NutriWise</span>
        </span>
        <div className="flex gap-1 rounded-full bg-[#efe4cf] p-1 text-xs">
          {(["en", "de"] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLanguage(lng)}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium uppercase tracking-widest transition-colors",
                language === lng ? "bg-[#2a2f28] text-[#f8f2e6]" : "text-[#2a2f28]/50",
              )}
            >
              {lng}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <span className="inline-block rounded-full bg-[#efe4cf] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#4c5945]">
          {t("landing.badge")}
        </span>

        <h1 className="mx-auto mt-6 max-w-2xl text-balance font-serif text-5xl font-bold leading-[1.05] tracking-tight text-[#1c231a] sm:text-6xl">
          {t("landing.titleLine1")}
          <br />
          <em className="text-[#7c9a6a]">{t("landing.titleLine2")}</em>
        </h1>

        <p className="mx-auto mt-6 max-w-[52ch] text-pretty text-base leading-relaxed text-[#4a4f45]">
          {t("landing.body")}
        </p>

        <div className="mx-auto mt-10 flex max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={onRegister}
            className="w-full rounded-full bg-[#7c9a6a] px-6 py-4 text-sm font-semibold tracking-tight text-white shadow-sm transition-opacity hover:opacity-90"
          >
            {t("landing.registerCta")}
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="w-full rounded-full bg-transparent px-6 py-3.5 text-sm font-medium tracking-tight text-[#2a2f28] ring-1 ring-[#2a2f28]/15 transition-colors hover:bg-[#efe4cf]/60"
          >
            {t("landing.loginCta")}
          </button>
        </div>

        <p className="mt-4 text-xs text-[#4a4f45]/70">{t("landing.subtext")}</p>

        <div className="relative mt-16 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#e7dcc0] via-[#c9d3ab] to-[#8fa97d]">
          <div className="flex aspect-[16/10] items-end justify-center p-8 sm:aspect-[16/8]">
            <p className="max-w-sm text-pretty text-sm font-medium text-[#2a2f28]/70">
              {t("landing.imageCaption")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
