import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { AuthScreen } from "@/components/AuthScreen";
import { Button } from "@/components/ui/button";

type OAuthResult = { redirect_url?: string; redirect_to?: string; client?: { name?: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};

const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  component: Consent,
});

function Consent() {
  const { authorization_id: authorizationId } = Route.useSearch();
  const { user, loading } = useAuth();
  const [clientName, setClientName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !authorizationId) return;
    let cancelled = false;
    void oauthApi()
      .getAuthorizationDetails(authorizationId)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) return setError(err.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setClientName(data?.client?.name ?? "o aplicativo");
      });
    return () => {
      cancelled = true;
    };
  }, [user, authorizationId]);

  if (loading) return <Shell>Carregando...</Shell>;
  if (!user) return <AuthScreen />;
  if (!authorizationId) return <Shell>Pedido de autorização inválido.</Shell>;

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("O servidor de autorização não devolveu um destino.");
    }
    window.location.href = target;
  }

  return (
    <Shell>
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Conectar {clientName ?? "..."} ao ALTUS
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Isso permite que {clientName ?? "o aplicativo"} leia e registre seus dados do ALTUS em
            seu nome ({user.email}).
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button disabled={busy || !clientName} onClick={() => decide(true)} className="flex-1">
            Permitir
          </Button>
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => decide(false)}
            className="flex-1"
          >
            Recusar
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
      {children}
    </main>
  );
}
