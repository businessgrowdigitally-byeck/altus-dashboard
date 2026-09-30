import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";

type AuthValue = {
  user: User | null;
  session: Session | null;
  /** true enquanto verificamos se já existe uma sessão salva no navegador */
  loading: boolean;
  /** true quando o usuário veio pelo link de redefinição de senha e precisa trocá-la */
  isRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** retorna true quando o Supabase exige confirmação de e-mail antes do login */
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  /** Define a nova senha escolhida pelo usuário na tela de recuperação. */
  updatePassword: (password: string) => Promise<void>;
  clearRecovery: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Traduz as mensagens do Supabase, que vêm sempre em inglês. */
export function traduzErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (m.includes("user already registered")) return "Já existe uma conta com esse e-mail. Tente entrar.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("unable to validate email address") || m.includes("invalid email")) return "E-mail inválido.";
  if (m.includes("email rate limit") || m.includes("for security purposes")) return "Muitas tentativas seguidas. Aguarde alguns segundos e tente de novo.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique sua internet.";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        // O link de recuperação chega com #type=recovery no hash — confirmação
        // extra caso o evento abaixo demore ou se perca no fluxo de SSR.
        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.hash.slice(1)) : null;
        if (params?.get("type") === "recovery" && data.session) setIsRecovery(true);
        setSession(data.session);
      })
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    loading,
    isRecovery,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(traduzErro(error.message));
    },
    signInWithGoogle: async () => {
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw new Error(traduzErro(error.message));
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw new Error(traduzErro(error.message));
      // Sem sessão de volta = o projeto exige confirmação por e-mail.
      return !data.session;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(traduzErro(error.message));
    },
    sendReset: async (email) => {
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw new Error(traduzErro(error.message));
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(traduzErro(error.message));
    },
    clearRecovery: () => setIsRecovery(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
