import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthScreen } from "./AuthScreen";
import { startSync, stopSync, useSyncStatus, flushSync } from "@/lib/sync";
import { useT } from "@/lib/i18n";

/**
 * Porteiro do app: sem sessão, só a tela de login existe. Com sessão, baixa os
 * dados da nuvem antes de liberar a interface.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const t = useT();
  const { user, loading } = useAuth();
  const status = useSyncStatus((s) => s.status);
  const syncError = useSyncStatus((s) => s.error);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId) void startSync(userId);
    else stopSync();
  }, [userId]);

  // Garante que alterações recentes sejam enviadas se a aba for fechada.
  useEffect(() => {
    if (!userId) return;
    const handler = () => void flushSync();
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, [userId]);

  if (loading) return <Splash label={t("sync.loading")} />;
  if (!user) return <AuthScreen />;

  if (status === "loading" || status === "idle") return <Splash label={t("sync.loading")} />;

  if (status === "error" && syncError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">{t("sync.loadErrorTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{syncError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t("sync.loadErrorRetry")}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Splash({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <span className="font-display text-2xl font-bold tracking-tight text-primary">ALTUS</span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </span>
    </div>
  );
}
