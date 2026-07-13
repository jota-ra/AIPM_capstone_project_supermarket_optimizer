import { useEffect, useState } from "react";
import { AppShell, type StepId } from "@/components/AppShell";
import { ConsentBanner } from "@/components/ConsentBanner";
import { LandingStep } from "@/steps/LandingStep";
import { AccountPickerStep } from "@/steps/AccountPickerStep";
import { OnboardingUploadStep } from "@/steps/OnboardingUploadStep";
import {
  NotificationsStep,
  loadNotifications,
  mergeNotificationReadState,
  type Notification,
} from "@/steps/NotificationsStep";
import { ReviewStep } from "@/steps/ReviewStep";
import { PantryStep } from "@/steps/PantryStep";
import { DiaryStep } from "@/steps/DiaryStep";
import { ChatOnboardingStep } from "@/steps/ChatOnboardingStep";
import { ProfileSummary } from "@/steps/ProfileSummary";
import { ResultsStep } from "@/steps/ResultsStep";
import { deleteReceipt, deleteProfile, clearSession, ApiError } from "@/lib/api";
import { LanguageProvider, useLanguage, t, getStoredLanguage } from "@/lib/i18n";

const RECEIPT_KEY = "nutriwise.receiptId";
const PROFILE_KEY = "nutriwise.profileId";
const CONSENT_KEY = "nutriwise.consent";

function App() {
  // Flow order (after the consent/disclaimer gate): onboarding -> upload -> results.
  // "userProfile" (edit view of onboarding's answers) is a standalone nav
  // destination, not part of that linear flow. "landing" is the demo's
  // very first screen (see LandingStep.tsx) and is rendered outside the
  // AppShell entirely below — it deliberately has no nav/footer, since
  // the user hasn't started the app yet.
  const [step, setStep] = useState<StepId>("landing");
  const [receiptId, setReceiptId] = useState<string | null>(() =>
    localStorage.getItem(RECEIPT_KEY),
  );
  const [profileId, setProfileId] = useState<string | null>(() =>
    localStorage.getItem(PROFILE_KEY),
  );
  // Only used to personalize OnboardingUploadStep's greeting right after
  // the chat — not persisted, so a page reload just falls back to the
  // name-less greeting instead of an extra profile fetch.
  const [profileName, setProfileName] = useState<string | null>(null);
  const [consented, setConsented] = useState<boolean>(
    () => localStorage.getItem(CONSENT_KEY) === "true",
  );
  // Lifted here (not just local to NotificationsStep) so AppShell's bell
  // dot reflects the same real unread state the Notifications page
  // shows — see NotificationsStep.tsx's docstring on why a single
  // source of truth matters for "mark all read" not getting silently
  // undone by a later background refresh.
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  // Refreshes whenever the user lands on one of the main app pages —
  // cheap, already-cached-elsewhere reads (see loadNotifications), so
  // re-fetching on every nav is acceptable rather than trying to guess
  // exactly when something might have changed.
  useEffect(() => {
    if (!consented) return;
    if (step === "landing" || step === "accountPicker" || step === "onboarding") return;

    let cancelled = false;
    setNotificationsLoading(true);
    loadNotifications(profileId, getStoredLanguage()).then(({ items, error }) => {
      if (cancelled) return;
      setNotifications((prev) => mergeNotificationReadState(items, prev));
      setNotificationsError(error);
      setNotificationsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [step, profileId, consented]);

  function handleConsent() {
    localStorage.setItem(CONSENT_KEY, "true");
    setConsented(true);
  }

  function handleUploaded(id: string) {
    setReceiptId(id);
    localStorage.setItem(RECEIPT_KEY, id);
    setStep("review");
  }

  function handleProfileCreated(id: string, name: string | null) {
    setProfileId(id);
    setProfileName(name);
    localStorage.setItem(PROFILE_KEY, id);
    setStep("onboardingUpload");
  }

  async function handleDeleteData() {
    if (!receiptId && !profileId) return;
    // Not inside a component render, so useLanguage()'s context isn't
    // reachable here — getStoredLanguage() reads the same localStorage
    // value LanguageProvider itself initializes from (see lib/i18n.tsx),
    // so this native confirm dialog still matches the user's chosen
    // language instead of always showing English for the app's one
    // truly irreversible action.
    const lang = getStoredLanguage();
    if (!window.confirm(t("footer.deleteConfirm", lang))) {
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
      window.alert(e instanceof ApiError ? e.message : t("footer.deleteFailed", lang));
      return;
    }

    localStorage.removeItem(RECEIPT_KEY);
    localStorage.removeItem(PROFILE_KEY);
    setReceiptId(null);
    setProfileId(null);
    setStep("onboarding");
  }

  // Logout: ends this browser's session (see clearSession's docstring —
  // there's no real auth, so "logging out" just drops the session_id
  // and every locally-cached ID that belonged to it) and returns to the
  // login page. Deliberately does NOT touch `consented` — that's an
  // acknowledgment of this browser/device having seen the disclaimer,
  // not something tied to a specific account, so a re-login shouldn't
  // have to re-accept it.
  function handleLogout() {
    clearSession();
    localStorage.removeItem(RECEIPT_KEY);
    localStorage.removeItem(PROFILE_KEY);
    setReceiptId(null);
    setProfileId(null);
    setProfileName(null);
    setNotifications([]);
    setStep("landing");
  }

  function handleMarkAllNotificationsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

  if (step === "landing") {
    return (
      <LanguageProvider>
        <LandingStep onRegister={() => setStep("onboarding")} onLogin={() => setStep("accountPicker")} />
      </LanguageProvider>
    );
  }

  if (step === "accountPicker") {
    return (
      <LanguageProvider>
        <AccountPickerStep
          onBack={() => setStep("landing")}
          onResolved={({ profileId: resolvedProfileId }) => {
            // Switching demo accounts means switching session_id — any
            // receipt the previous account was reviewing belongs to a
            // different session and would just 403 here, so drop it.
            setReceiptId(null);
            localStorage.removeItem(RECEIPT_KEY);

            if (resolvedProfileId) {
              setProfileId(resolvedProfileId);
              localStorage.setItem(PROFILE_KEY, resolvedProfileId);
              setStep("results");
            } else {
              setProfileId(null);
              localStorage.removeItem(PROFILE_KEY);
              setStep("onboarding");
            }
          }}
        />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <AppShell
        step={step}
        onNavigate={setStep}
        onDeleteData={handleDeleteData}
        canDeleteData={Boolean(receiptId || profileId)}
        hasUnreadNotifications={notifications.some((n) => n.unread)}
      >
        {!consented ? (
          <ConsentBanner onAccept={handleConsent} />
        ) : (
          <>
            {step === "notifications" ? (
              <NotificationsStep
                notifications={notifications}
                loading={notificationsLoading}
                error={notificationsError}
                onMarkAllRead={handleMarkAllNotificationsRead}
              />
            ) : null}

            {step === "onboarding" ? (
              <ChatOnboardingStep
                onProfileCreated={handleProfileCreated}
                onSkip={() => setStep("pantry")}
              />
            ) : null}

            {step === "onboardingUpload" ? (
              <OnboardingUploadStep
                profileId={profileId}
                profileName={profileName}
                onUploaded={handleUploaded}
                // Results/Next Cart need at least one receipt (409
                // otherwise) — Pantry handles "nothing yet" gracefully
                // (pantry.empty) and still nudges towards uploading.
                onSkip={() => setStep("pantry")}
              />
            ) : null}

            {step === "userProfile" ? (
              profileId ? (
                <ProfileSummary profileId={profileId} onLogout={handleLogout} />
              ) : (
                <EmptyStateProfile onAction={() => setStep("onboarding")} />
              )
            ) : null}

            {/* Flow: Disclaimer -> Onboarding -> Pantry (upload lives here now) -> Review -> Pantry. */}
            {step === "review" ? (
              receiptId ? (
                <ReviewStep receiptId={receiptId} onContinue={() => setStep("pantry")} />
              ) : (
                <EmptyState onAction={() => setStep("pantry")} />
              )
            ) : null}

            {step === "pantry" ? (
              <PantryStep profileId={profileId} onUploaded={handleUploaded} onNavigate={setStep} />
            ) : null}

            {step === "diary" ? <DiaryStep onNavigate={setStep} /> : null}

            {step === "results" ? (
              <ResultsStep
                profileId={profileId}
                onEditProfile={() => setStep("userProfile")}
                onNavigate={setStep}
              />
            ) : null}
          </>
        )}
      </AppShell>
    </LanguageProvider>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  const { t } = useLanguage();
  return (
    <section className="space-y-4 px-6 pb-16">
      <p className="text-sm text-ink/60">{t("review.uploadFirst")}</p>
      <button
        type="button"
        onClick={onAction}
        className="rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas"
      >
        {t("review.goToPantry")}
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
