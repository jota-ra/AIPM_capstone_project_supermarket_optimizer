import { useState } from "react";
import { AppShell, type StepId } from "@/components/AppShell";
import { ConsentBanner } from "@/components/ConsentBanner";
import { UploadStep } from "@/steps/UploadStep";
import { ReviewStep } from "@/steps/ReviewStep";
import { ChatOnboardingStep } from "@/steps/ChatOnboardingStep";
import { ProfileSummary } from "@/steps/ProfileSummary";
import { ResultsStep } from "@/steps/ResultsStep";
import { deleteReceipt, deleteProfile, ApiError } from "@/lib/api";
import { LanguageProvider, useLanguage } from "@/lib/i18n";

const RECEIPT_KEY = "nutriwise.receiptId";
const PROFILE_KEY = "nutriwise.profileId";
const CONSENT_KEY = "nutriwise.consent";

function App() {
  // Flow order (after the consent/disclaimer gate): onboarding -> upload -> results.
  // "userProfile" (edit view of onboarding's answers) is a standalone nav
  // destination, not part of that linear flow.
  const [step, setStep] = useState<StepId>("onboarding");
  const [receiptId, setReceiptId] = useState<string | null>(() =>
    localStorage.getItem(RECEIPT_KEY),
  );
  const [profileId, setProfileId] = useState<string | null>(() =>
    localStorage.getItem(PROFILE_KEY),
  );
  const [consented, setConsented] = useState<boolean>(
    () => localStorage.getItem(CONSENT_KEY) === "true",
  );

  function handleConsent() {
    localStorage.setItem(CONSENT_KEY, "true");
    setConsented(true);
  }

  function handleUploaded(id: string) {
    setReceiptId(id);
    localStorage.setItem(RECEIPT_KEY, id);
    setStep("review");
  }

  function handleProfileCreated(id: string) {
    setProfileId(id);
    localStorage.setItem(PROFILE_KEY, id);
    setStep("upload");
  }

  async function handleDeleteData() {
    if (!receiptId && !profileId) return;
    if (!window.confirm("Delete the receipt and profile stored for this session? This can't be undone.")) {
      return;
    }

    try {
      await Promise.all([
        receiptId ? deleteReceipt(receiptId).catch((e) => {
          if (!(e instanceof ApiError && e.status === 404)) throw e;
        }) : null,
        profileId ? deleteProfile(profileId).catch((e) => {
          if (!(e instanceof ApiError && e.status === 404)) throw e;
        }) : null,
      ]);
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Could not delete your data.");
      return;
    }

    localStorage.removeItem(RECEIPT_KEY);
    localStorage.removeItem(PROFILE_KEY);
    setReceiptId(null);
    setProfileId(null);
    setStep("onboarding");
  }

  return (
    <LanguageProvider>
      <AppShell
        step={step}
        onNavigate={setStep}
        onDeleteData={handleDeleteData}
        canDeleteData={Boolean(receiptId || profileId)}
      >
        {!consented ? (
          <ConsentBanner onAccept={handleConsent} />
        ) : (
          <>
            {step === "onboarding" ? (
              <ChatOnboardingStep
                onProfileCreated={handleProfileCreated}
                onSkip={() => setStep("upload")}
              />
            ) : null}

            {step === "userProfile" ? (
              profileId ? (
                <ProfileSummary profileId={profileId} />
              ) : (
                <EmptyStateProfile onAction={() => setStep("onboarding")} />
              )
            ) : null}

            {step === "upload" ? (
              <UploadStep profileId={profileId} onUploaded={handleUploaded} />
            ) : null}

            {/* Flow: Disclaimer -> Onboarding -> Upload -> Review -> Results. */}
            {step === "review" ? (
              receiptId ? (
                <ReviewStep receiptId={receiptId} onContinue={() => setStep("results")} />
              ) : (
                <EmptyState message="Upload a receipt first." onAction={() => setStep("upload")} />
              )
            ) : null}

            {step === "results" ? <ResultsStep profileId={profileId} /> : null}
          </>
        )}
      </AppShell>
    </LanguageProvider>
  );
}

function EmptyState({ message, onAction }: { message: string; onAction: () => void }) {
  return (
    <section className="space-y-4 px-6 pb-16">
      <p className="text-sm text-ink/60">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas"
      >
        Go to upload
      </button>
    </section>
  );
}

function EmptyStateProfile({ onAction }: { onAction: () => void }) {
  const { t } = useLanguage();
  return (
    <section className="space-y-4 px-6 pb-16">
      <h1 className="text-balance text-3xl font-medium leading-none tracking-tight">
        {t("profile.emptyTitle")}
      </h1>
      <p className="max-w-[56ch] text-pretty text-base text-ink/60">{t("profile.emptyBody")}</p>
      <button
        type="button"
        onClick={onAction}
        className="rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas"
      >
        {t("profile.goToOnboarding")}
      </button>
    </section>
  );
}

export default App;
