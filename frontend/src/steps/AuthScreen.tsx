import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, SectionLabel, PrimaryButton, inputCls } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

// E1: sign-up / login gate (FR-1). Email+password and Google, with a
// ≥16 age gate (BR-P7) enforced at sign-up via date of birth. On success
// the Supabase session is persisted and App renders the app.

type Mode = "login" | "signup";

const MIN_AGE = 16;

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function AuthScreen() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      if (!dob) {
        setError(t("auth.errNoDob"));
        return;
      }
      if (ageFromDob(dob) < MIN_AGE) {
        setError(t("auth.errUnderage").replace("{age}", String(MIN_AGE)));
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          // Store the age-gate DOB in user metadata so onboarding can
          // pre-fill it instead of asking twice (reconciles E1-S3). The
          // onboarding DOB stays authoritative for calculations.
          options: { data: { date_of_birth: dob } },
        });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setNotice(t("auth.noticeConfirm"));
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      // Supabase's own error text is English-only (provider-supplied); our
      // own copy is localized. Fall back to the generic localized message.
      const message = err instanceof Error ? err.message : t("auth.errGeneric");
      // Already-registered email → route to login (E1-S1).
      if (mode === "signup" && /already registered|already exists|already in use/i.test(message)) {
        setMode("login");
        setNotice(t("auth.noticeExists"));
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  }

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-medium tracking-tight">Nährbert</h1>
        <p className="text-sm text-ink/60">
          {mode === "login" ? t("auth.welcomeBack") : t("auth.createSubtitle")}
        </p>
      </div>

      <Card className="space-y-4">
        <div className="flex gap-2">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setNotice(null); }}
              className={
                "flex-1 rounded-xl py-2 text-sm font-medium ring-1 transition-colors " +
                (mode === m ? "bg-ink text-canvas ring-ink" : "bg-zinc-50 text-ink/60 ring-black/5")
              }
            >
              {m === "login" ? t("auth.login") : t("auth.signup")}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <SectionLabel>{t("auth.email")}</SectionLabel>
            <input
              className={inputCls}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <SectionLabel>{t("auth.password")}</SectionLabel>
            <input
              className={inputCls}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === "signup" ? (
            <div className="space-y-1">
              <SectionLabel>{t("auth.dob")}</SectionLabel>
              <input
                className={inputCls}
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
              <p className="text-[11px] text-ink/40">{t("auth.ageHint").replace("{age}", String(MIN_AGE))}</p>
            </div>
          ) : null}

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}

          <PrimaryButton type="submit" disabled={busy}>
            {busy ? t("auth.pleaseWait") : mode === "login" ? t("auth.login") : t("auth.createAccount")}
          </PrimaryButton>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-black/10" />
          <span className="text-[11px] uppercase tracking-widest text-ink/40">{t("auth.or")}</span>
          <span className="h-px flex-1 bg-black/10" />
        </div>

        <button
          type="button"
          onClick={google}
          className="w-full rounded-xl bg-zinc-50 py-2.5 text-sm font-medium tracking-tight text-ink ring-1 ring-black/10 hover:bg-zinc-100"
        >
          {t("auth.google")}
        </button>
      </Card>

      <p className="text-center text-[11px] text-ink/40">
        {t("auth.disclaimer")}
      </p>
    </section>
  );
}
