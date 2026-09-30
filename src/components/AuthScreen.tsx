import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";
import { useT } from "@/lib/i18n";

type Mode = "login" | "signup" | "reset" | "recovery";

const TITLES: Record<Mode, { title: string; subtitle: string; action: string }> = {
  login: { title: "title.login", subtitle: "subtitle.login", action: "action.login" },
  signup: { title: "title.signup", subtitle: "subtitle.signup", action: "action.signup" },
  reset: { title: "title.reset", subtitle: "subtitle.reset", action: "action.reset" },
  recovery: { title: "title.newPassword", subtitle: "subtitle.newPassword", action: "action.updatePassword" },
};

export function AuthScreen({ recovery = false }: { recovery?: boolean }) {
  const { signIn, signUp, sendReset, signInWithGoogle, updatePassword, signOut, clearRecovery } = useAuth();
  const t = useT();
  const [mode, setMode] = useState<Mode>(recovery ? "recovery" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Ao encerrar a recuperação no sucesso, esvaziamos o estado de senha.
  useEffect(() => {
    if (!recovery) return;
    setPassword("");
    setConfirm("");
  }, [recovery]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else if (mode === "signup") {
        const needsConfirmation = await signUp(email, password);
        if (needsConfirmation) {
          setNotice(t("notice.signup"));
          setMode("login");
        }
      } else if (mode === "reset") {
        await sendReset(email);
        setNotice(t("notice.reset"));
      } else {
        if (password.length < 6) {
          setError(t("error.passwordTooShort"));
          return;
        }
        if (password !== confirm) {
          setError(t("error.passwordMismatch"));
          return;
        }
        await updatePassword(password);
        setNotice(t("notice.passwordUpdated"));
        // Encerra a sessão de recuperação: volta para o login com a nova senha.
        setTimeout(() => {
          void signOut()
            .catch(() => {})
            .finally(clearRecovery);
        }, 1600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  const meta = TITLES[mode];

  if (!supabaseConfigured) {
    return (
      <Shell>
        <p className="text-sm text-destructive">
          {t("notConfigured.lead")}
          <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>
          {t("notConfigured.trail")}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {t(meta.title)}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(meta.subtitle)}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode !== "recovery" && (
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              {t("label.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        )}

        {mode === "recovery" && (
          <div className="space-y-1.5">
            <label htmlFor="recovery-password" className="text-sm font-medium text-foreground">
              {t("label.newPassword")}
            </label>
            <input
              id="recovery-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("placeholder.password")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        )}

        {mode === "recovery" && (
          <div className="space-y-1.5">
            <label htmlFor="recovery-confirm" className="text-sm font-medium text-foreground">
              {t("label.confirmPassword")}
            </label>
            <input
              id="recovery-confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("placeholder.confirmPassword")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        )}

        {mode !== "reset" && mode !== "recovery" && (
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              {t("label.password")}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("placeholder.password")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {t(meta.action)}
        </button>
      </form>

      {mode !== "reset" && mode !== "recovery" && (
        <div className="mt-4 space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-border" />
            <span className="relative bg-card px-2 text-xs text-muted-foreground">{t("or")}</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                await signInWithGoogle();
              } catch (err) {
                setError(err instanceof Error ? err.message : t("error.google"));
                setBusy(false);
              }
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.1-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
              />
            </svg>
            {t("continueGoogle")}
          </button>
        </div>
      )}

      <div className="mt-6 space-y-2 text-sm text-muted-foreground">
        {mode === "login" && (
          <>
            <p>
              {t("noAccount")}{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-medium text-primary hover:underline"
              >
                {t("createNow")}
              </button>
            </p>
            <p>
              <button type="button" onClick={() => switchMode("reset")} className="hover:underline">
                {t("forgotPassword")}
              </button>
            </p>
          </>
        )}
        {mode !== "login" && mode !== "recovery" && (
          <p>
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="font-medium text-primary hover:underline"
            >
              {t("backToLogin")}
            </button>
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-3xl font-bold tracking-tight text-primary">ALTUS</span>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Become your best version
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">{children}</div>
      </div>
    </div>
  );
}
