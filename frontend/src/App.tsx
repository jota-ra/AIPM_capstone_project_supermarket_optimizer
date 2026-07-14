import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AppShell, type StepId } from "@/components/AppShell";
import { ConsentBanner } from "@/components/ConsentBanner";
import { AuthScreen } from "@/steps/AuthScreen";
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
import { getMyProfile, deleteReceipt, deleteProfile, ApiError } from "@/lib/api";
import type { Profile } from "@/types/api";
import { LanguageProvider, useLanguage, t, getStoredLanguage } from "@/lib/i18n";

const RECEIPT_KEY = "nutriwise.receiptId";
const CONSENT_KEY = "nutriwise.consent";

function App() {
  // E1: the app is gated on a Supabase auth session. Unauthenticated ->
  // AuthScreen (sign-up / login / age gate). Authenticated -> resolve the
  // user's profile from the server and either resume onboarding (E1-S6) or
  // land on the dashboard.
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [step, setStep] = useState<StepId>("onboarding");
  const [receiptId, setReceiptId] = useState<string | null>(() =>
    localStorage.getItem(RECEIPT_KEY),
  );
  const [profileId, setProfileId] = useState<string | null>(null);
  // The incomplete profile to resume onboarding from (E1-S6), or null for
  // a fresh walk-through.
  const [resumeProfile, setResumeProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const [consented, setConsented] = useState<boolean>(
    () => localStorage.getItem(CONSENT_KEY) === "true",
  );
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  // Persisted session (E1-S4): Supabase restores it from storage on load
  // and refreshes tokens silently; we just mirror it into React state and
  // react to sign-in / sign-out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        // Signed out — drop everything tied to the previous account.
        setBootstrapped(false);
        setProfileId(null);
        setResumeProfile(null);
        setProfileName(null);
        setReceiptId(null);
        localStorage.removeItem(RECEIPT_KEY);
        setNotifications([]);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // After sign-in, resolve the user's profile once and pick the entry step
  // (E1-S6): complete -> dashboard; partial -> resume onboarding; none ->
  // start onboarding.
  useEffect(() => {
    if (!session || bootstrapped) return;
    let cancelled = false;
    getMyProfile()
      .then((p) => {
        if (cancelled) return;
        setBootstrapped(true);
        if (p && p.profile_complete) {
          setProfileId(p.profile_id);
          setProfileName(p.name ?? null);
          setStep("results");
        } else if (p) {
          setProfileId(p.profile_id);
          setResumeProfile(p);
          setStep("onboarding");
        } else {
          setStep("onboarding");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBootstrapped(true);
        setStep("onboarding");
      });
    return () => {
      cancelled = true;
    };
  }, [session, bootstrapped]);

  // Refresh notifications on the main app pages (see NotificationsStep).
  useEffect(() => {
    if (!session || !consented) return;
    if (step === "onboarding") return;

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
  }, [step, profileId, consented, session]);

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
    setResumeProfile(null);
    setStep("onboardingUpload");
  }

  async function handleDeleteData() {
    if (!receiptId && !profileId) return;
    const lang = getStoredLanguage();
    if (!window.confirm(t("footer.deleteConfirm", lang))) {
      return;
    }

    try {
      await Promise.all([
        receiptId
          ? deleteReceipt(receiptId).catch((e) => {
              if (!(e instanceof ApiError && e.status === 404)) throw e;
            })
          : null,
        profileId
          ? deleteProfile(profileId).catch((e) => {
              if (!(e instanceof ApiError && e.status === 404)) throw e;
            })
          : null,
      ]);
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : t("footer.deleteFailed", lang));
      return;
    }

    localStorage.removeItem(RECEIPT_KEY);
    setReceiptId(null);
    setProfileId(null);
    setResumeProfile(null);
    setStep("onboarding");
  }

  // Logout (E1-S4): end the Supabase session. onAuthStateChange then fires
  // with a null session, resetting local state and rendering AuthScreen.
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function handleMarkAllNotificationsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

  if (!authReady) {
    return (
      <LanguageProvider>
        <LoadingScreen />
      </LanguageProvider>
    );
  }

  if (!session) {
    return (
      <LanguageProvider>
        <AuthScreen />
      </LanguageProvider>
    );
  }

  if (!bootstrapped) {
    return (
      <LanguageProvider>
        <LoadingScreen />
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
                resumeProfile={resumeProfile}
                resumeProfileId={profileId}
                onProfileCreated={handleProfileCreated}
                onSkip={() => setStep("pantry")}
              />
            ) : null}

            {step === "onboardingUpload" ? (
              <OnboardingUploadStep
                profileName={profileName}
                onUploaded={handleUploaded}
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

function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm items-center justify-center px-6">
      <p className="text-sm text-ink/50">{t("common.loading")}</p>
    </section>
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
