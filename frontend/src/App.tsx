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
import { getMyProfile, getReceiptUploadProgress, deleteAccount, ApiError } from "@/lib/api";
import type { Profile, ReceiptUploadProgress } from "@/types/api";
import { LanguageProvider, useLanguage, t, getStoredLanguage } from "@/lib/i18n";

const RECEIPT_KEY = "nutriwise.receiptId";
const CONSENT_KEY = "nutriwise.consent";

// The localStorage value used to be a single receipt id string; now it's a
// JSON array (E5: Review pages through every receipt from a batch upload,
// not just the first). Reading a leftover plain string as a 1-item array
// keeps an in-progress session from an older build working after reload.
function loadStoredReceiptIds(): string[] {
  const raw = localStorage.getItem(RECEIPT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return [raw];
  }
}

function App() {
  // E1: the app is gated on a Supabase auth session. Unauthenticated ->
  // AuthScreen (sign-up / login / age gate). Authenticated -> resolve the
  // user's profile from the server and either resume onboarding (E1-S6) or
  // land on the dashboard.
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [step, setStep] = useState<StepId>("onboarding");
  const [receiptIds, setReceiptIds] = useState<string[]>(loadStoredReceiptIds);
  const [profileId, setProfileId] = useState<string | null>(null);
  // The incomplete profile to resume onboarding from (E1-S6), or null for
  // a fresh walk-through.
  const [resumeProfile, setResumeProfile] = useState<Profile | null>(null);

  // E1's baseline-upload gate: active from the moment onboarding's profile
  // step finishes until 50 food items have been uploaded. While active,
  // finishing a receipt's Review loops back to another upload instead of
  // continuing into the app (see handleOnboardingReviewContinue below).
  const [uploadGateActive, setUploadGateActive] = useState(false);

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
        setReceiptIds([]);
        localStorage.removeItem(RECEIPT_KEY);
        setNotifications([]);
        setUploadGateActive(false);
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

  function handleUploaded(ids: string[]) {
    setReceiptIds(ids);
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(ids));
    setStep("review");
  }

  function handleProfileCreated(id: string) {
    setProfileId(id);
    setResumeProfile(null);
    setUploadGateActive(true);
    setStep("onboardingUpload");
  }

  // E1's baseline-upload gate: how many food items uploaded so far, vs.
  // the target that unlocks the rest of the app. Best-effort — a failed
  // fetch is treated as "not complete yet" rather than blocking upload.
  async function refreshUploadProgress(): Promise<ReceiptUploadProgress | null> {
    try {
      return await getReceiptUploadProgress();
    } catch {
      return null;
    }
  }

  // Finishing a receipt's Review while the baseline-upload gate is active:
  // loop back to another upload until the target is reached, then hand off
  // to the rest of the app exactly like a normal Review would.
  async function handleOnboardingReviewContinue() {
    const p = await refreshUploadProgress();
    if (p?.complete) {
      setUploadGateActive(false);
      setStep("pantry");
    } else {
      setStep("onboardingUpload");
    }
  }


  // E12-S3 / FR-12.3: full GDPR erasure. One confirmed path (used by both
  // the footer and the profile screen): hard cascade-delete all personal
  // data + the Supabase Auth user server-side, then sign out. Replaces the
  // old partial "delete the tracked receipt + profile" reset, which left
  // other receipts, pantry, votes and the auth login behind.
  async function handleDeleteAccount() {
    const lang = getStoredLanguage();
    if (!window.confirm(t("footer.deleteConfirm", lang))) {
      return;
    }
    try {
      await deleteAccount();
    } catch (e) {
      // 401 is expected/benign — the auth user was deleted mid-request, so
      // the token is already invalid. Treat it as success and sign out.
      if (!(e instanceof ApiError && e.status === 401)) {
        window.alert(e instanceof ApiError ? e.message : t("footer.deleteFailed", lang));
        return;
      }
    }
    localStorage.removeItem(RECEIPT_KEY);
    // Sign out → onAuthStateChange(null) resets all local state and shows
    // AuthScreen. The account and its data no longer exist.
    await supabase.auth.signOut();
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
        onDeleteData={handleDeleteAccount}
        canDeleteData={Boolean(session)}
        hasUnreadNotifications={notifications.some((n) => n.unread)}
        // Lock down navigation (tab nav + the brand logo's link to
        // Insights) only during the profile chat itself — there's no
        // profile yet, so there's nowhere useful to jump to. From the
        // baseline-upload step onward (still part of E1's 50-item gate),
        // Pantry and Insights are real, reachable destinations; each
        // shows its own gated/partial view until the target is reached
        // (see PantryStep's empty state and ResultsStep's gapsLocked card).
        restrictNav={step === "onboarding"}
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
              />
            ) : null}

            {step === "onboardingUpload" ? (
              <OnboardingUploadStep onUploaded={handleUploaded} />
            ) : null}

            {step === "userProfile" ? (
              profileId ? (
                <ProfileSummary
                  profileId={profileId}
                  onLogout={handleLogout}
                  onDeleteAccount={handleDeleteAccount}
                />
              ) : (
                <EmptyStateProfile onAction={() => setStep("onboarding")} />
              )
            ) : null}

            {step === "review" ? (
              receiptIds.length > 0 ? (
                <ReviewStep
                  receiptIds={receiptIds}
                  onContinue={uploadGateActive ? handleOnboardingReviewContinue : () => setStep("pantry")}
                />
              ) : (
                <EmptyState
                  onAction={uploadGateActive ? () => setStep("onboardingUpload") : () => setStep("pantry")}
                />
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
