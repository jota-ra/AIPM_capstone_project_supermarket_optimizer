import { Card, PrimaryButton, SectionLabel } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

export function ConsentBanner({ onAccept }: { onAccept: () => void }) {
  const { t } = useLanguage();
  return (
    <section className="space-y-8 px-6 pb-16">
      <header className="space-y-2">
        <SectionLabel>{t("consent.badge")}</SectionLabel>
        <h1 className="text-balance text-4xl font-medium leading-none tracking-tight">
          {t("consent.title")}
        </h1>
        <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("consent.body")}</p>
      </header>

      <Card className="space-y-5">
        <ul className="space-y-2 text-sm text-ink/70">
          <li>· {t("consent.bullet1")}</li>
          <li>· {t("consent.bullet2")}</li>
          <li>· {t("consent.bullet3")}</li>
          <li>· {t("consent.bullet4")}</li>
        </ul>
        <PrimaryButton onClick={onAccept}>{t("consent.accept")}</PrimaryButton>
      </Card>
    </section>
  );
}
