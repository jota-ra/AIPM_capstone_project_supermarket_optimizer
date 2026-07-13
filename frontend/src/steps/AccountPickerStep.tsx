import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { setSessionId, getProfileBySession, ApiError } from "@/lib/api";
import { Footer } from "@/components/Footer";

// Demo-only "login": there's no real auth in this MVP (see lib/api.ts's
// session.ts docstring) — instead each demo account is just a fixed,
// shared session_id. Picking one switches every subsequent request onto
// that identity's data. Two accounts for the course demo; add more here
// if a third presenter needs one — nothing else needs to change.
const DEMO_ACCOUNTS = [
  { key: "jennifer", name: "Jennifer", sessionId: "c9cc45be-38d8-4f5d-a353-c40429b9d9ac" },
  { key: "stuart", name: "Stuart", sessionId: "189e9291-5ea3-47e0-80b2-6e012cb98d9c" },
] as const;

const PROFILE_KEY = "nutriwise.profileId";

export function AccountPickerStep({
  onBack,
  onResolved,
}: {
  onBack: () => void;
  onResolved: (args: { profileId: string | null }) => void;
}) {
  const { t } = useLanguage();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectAccount(account: (typeof DEMO_ACCOUNTS)[number]) {
    setError(null);
    setLoadingKey(account.key);
    setSessionId(account.sessionId);
    try {
      const profile = await getProfileBySession(account.sessionId);
      if (profile) {
        localStorage.setItem(PROFILE_KEY, profile.profile_id);
        onResolved({ profileId: profile.profile_id });
      } else {
        localStorage.removeItem(PROFILE_KEY);
        onResolved({ profileId: null });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("accountPicker.loadFailed"));
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f2e6] font-sans text-[#2a2f28] antialiased">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-8">
        <span className="size-5 rounded-full bg-[#2a2f28]" />
        <span className="text-sm font-medium tracking-tight">NutriWise</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <h1 className="mx-auto max-w-xl text-balance font-serif text-4xl font-bold leading-[1.1] tracking-tight text-[#1c231a]">
          {t("accountPicker.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-[48ch] text-pretty text-sm text-[#4a4f45]">
          {t("accountPicker.body")}
        </p>

        <div className="mx-auto mt-10 grid max-w-md gap-4 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.key}
              type="button"
              onClick={() => selectAccount(account)}
              disabled={loadingKey !== null}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl bg-white/70 p-6 ring-1 ring-[#2a2f28]/10 transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-[#8fa97d] text-lg font-semibold text-white">
                {account.name[0]}
              </span>
              <span className="text-sm font-semibold tracking-tight">{account.name}</span>
              <span className="text-xs text-[#4a4f45]/70">
                {loadingKey === account.key ? t("accountPicker.loading") : t("accountPicker.select")}
              </span>
            </button>
          ))}
        </div>

        {error ? <p className="mt-6 text-xs text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={onBack}
          className="mt-10 text-xs text-[#4a4f45]/60 underline decoration-[#4a4f45]/30 underline-offset-2 hover:text-[#2a2f28]"
        >
          {t("accountPicker.back")}
        </button>
      </main>
      <Footer />
    </div>
  );
}
