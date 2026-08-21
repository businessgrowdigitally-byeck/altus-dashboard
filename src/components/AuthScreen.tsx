import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";

type Mode = "login" | "signup" | "reset";

const TITLES: Record<Mode, { title: string; subtitle: string; action: string }> = {
  login: { title: "Entrar no ALTUS", subtitle: "Acesse seus registros de qualquer lugar.", action: "Entrar" },
  signup: { title: "Criar sua conta", subtitle: "Seus dados ficam salvos na nuvem, só seus.", action: "Criar conta" },
  reset: { title: "Recuperar senha", subtitle: "Enviamos um link de redefinição para o seu e-mail.", action: "Enviar link" },
};

export function AuthScreen() {
  const { signIn, signUp, sendReset } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
          setNotice("Conta criada! Confirme o e-mail que enviamos e depois faça login.");
          setMode("login");
        }
      } else {
        await sendReset(email);
        setNotice("Se existir uma conta com esse e-mail, o link de redefinição chegou na caixa de entrada.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const t = TITLES[mode];

  if (!supabaseConfigured) {
    return (
      <Shell>
        <p className="text-sm text-destructive">
          O login não está configurado. Defina <code>VITE_SUPABASE_URL</code> e{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> nas variáveis de ambiente do projeto.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            E-mail
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

        {mode !== "reset" && (
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
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
          {t.action}
        </button>
      </form>

      {mode !== "reset" && (
        <div className="mt-4 space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-border" />
            <span className="relative bg-card px-2 text-xs text-muted-foreground">ou</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                const { signInWithGoogle } = useAuth();
                await signInWithGoogle();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Falha ao entrar com Google.");
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
            Continuar com Google
          </button>
        </div>
      )}

      <div className="mt-6 space-y-2 text-sm text-muted-foreground">
        {mode === "login" && (
          <>
            <p>
              Não tem conta?{" "}
              <button type="button" onClick={() => switchMode("signup")} className="font-medium text-primary hover:underline">
                Criar agora
              </button>
            </p>
            <p>
              <button type="button" onClick={() => switchMode("reset")} className="hover:underline">
                Esqueci minha senha
              </button>
            </p>
          </>
        )}
        {mode !== "login" && (
          <p>
            <button type="button" onClick={() => switchMode("login")} className="font-medium text-primary hover:underline">
              Voltar para o login
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
