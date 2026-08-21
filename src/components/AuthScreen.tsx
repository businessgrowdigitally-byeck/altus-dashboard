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
