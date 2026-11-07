import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthScreen } from "./AuthScreen";
import {
  startSync,
  stopSync,
  useSyncStatus,
  flushSync,
  isSyncReady,
  refreshFromCloud,
  OFFLINE_FIRST_LOAD,
} from "@/lib/sync";
import { useT } from "@/lib/i18n";

/**
 * Porteiro do app: sem sessão, só a tela de login existe. Com sessão, baixa os
 * dados da nuvem antes de liberar a interface.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const t = useT();
  const { user, loading, isRecovery } = useAuth();
  const status = useSyncStatus((s) => s.status);
  const syncError = useSyncStatus((s) => s.error);

  const userId = user?.id ?? null;

  useEffect(() => {
    // Durante a recuperação de senha não carregamos nem salvamos dados: o único
    // caminho é trocar a senha primeiro.
    if (isRecovery) {
      stopSync();
      return;
    }
    // Enquanto o login é verificado, não mexe em nada: limpar aqui apagaria os
    // dados guardados no aparelho, que o modo offline usa para abrir sem internet.
    if (loading) return;
    if (userId) void startSync(userId);
    else stopSync();
  }, [userId, isRecovery, loading]);

  // Garante que alterações recentes sejam enviadas se a aba for fechada.
  useEffect(() => {
    if (!userId) return;
    const handler = () => void flushSync();
    window.addEventListener("pagehide", handler);
    // Ao voltar para o app, traz o que outro aparelho salvou (e combina com o local).
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshFromCloud();
      else void flushSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pagehide", handler);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  if (loading) return <Splash label={t("sync.loading")} />;
  if (!user) return <AuthScreen />;
  if (isRecovery) return <AuthScreen recovery />;

  if (status === "loading" || status === "idle") return <Splash label={t("sync.loading")} />;

  // Só a falha na CARGA inicial troca a tela. Erro ao salvar aparece no indicador
  // de sincronização; recarregar aqui baixaria a nuvem por cima do que não foi salvo.
  if (status === "error" && syncError && !isSyncReady()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">{t("sync.loadErrorTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {syncError === OFFLINE_FIRST_LOAD ? t("sync.offlineFirstLoad") : syncError}
          </p>
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
