import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { TERMS_VERSION, getAcceptedTermsVersion, recordTermsAcceptance } from "@/lib/terms";
import { useT } from "@/lib/i18n";

type GateState = "checking" | "required" | "accepted";

/**
 * Porteiro do consentimento (LGPD): bloqueia o app enquanto o usuário não
 * aceitar a versão vigente dos Termos de Uso e da Política de Privacidade.
 * O aceite é registrado no Supabase com user_id, timestamp e versão.
 */
export function TermsGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [loadError, setLoadError] = useState<string | null>(null);
  const t = useT();

  const check = useCallback(() => {
    setLoadError(null);
    setState("checking");
    getAcceptedTermsVersion(userId)
      .then((version) => setState(version === TERMS_VERSION ? "accepted" : "required"))
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : "Falha ao verificar o aceite."),
      );
  }, [userId]);

  useEffect(() => check(), [check]);

  if (state === "checking") return <Splash />;

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">{t("terms.loadError")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <button
            onClick={check}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t("terms.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (state === "required")
    return <ConsentScreen userId={userId} onAccepted={() => setState("accepted")} />;

  return <>{children}</>;
}

function ConsentScreen({ userId, onAccepted }: { userId: string; onAccepted: () => void }) {
  const { signOut } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      await recordTermsAcceptance(userId);
      onAccepted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível registrar o aceite. Tente de novo.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <span className="font-display text-3xl font-bold tracking-tight text-primary">ALTUS</span>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Become your best version
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-start gap-3 border-b border-border p-5">
            <ShieldCheck className="size-7 shrink-0 text-primary" />
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
                {t("terms.title")}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("terms.v1", { v: TERMS_VERSION })}
              </p>
            </div>
          </div>

          <div className="max-h-[45vh] space-y-5 overflow-y-auto p-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h3 className="font-semibold text-foreground">{t("terms.usTitle")}</h3>
              <h4 className="mt-3 font-medium text-foreground">{t("terms.us1Title")}</h4>
              <p className="mt-1">{t("terms.us1")}</p>
              <h4 className="mt-3 font-medium text-foreground">{t("terms.us2Title")}</h4>
              <p className="mt-1">{t("terms.us2")}</p>
              <h4 className="mt-3 font-medium text-foreground">{t("terms.us3Title")}</h4>
              <p className="mt-1">{t("terms.us3")}</p>
              <h4 className="mt-3 font-medium text-foreground">{t("terms.us4Title")}</h4>
              <p className="mt-1">{t("terms.us4")}</p>
              <h4 className="mt-3 font-medium text-foreground">{t("terms.us5Title")}</h4>
              <p className="mt-1">{t("terms.us5")}</p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">{t("terms.policyTitle")}</h3>
              <p className="mt-1">{t("terms.policyIntro")}</p>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy1Title")}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>{t("terms.dataCadastro")}</li>
                <li>{t("terms.dataRegistrados")}</li>
                <li>{t("terms.dataConsentimento")}</li>
              </ul>
              <p className="mt-1">{t("terms.policy1Post")}</p>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy2Title")}</h4>
              <p className="mt-1">{t("terms.policy2")}</p>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy3Title")}</h4>
              <p className="mt-1">
                {t("terms.policy3a")} <strong>{t("terms.consent")}</strong> {t("terms.policy3b")}
              </p>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy4Title")}</h4>
              <p className="mt-1">{t("terms.policy4")}</p>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy5Title")}</h4>
              <p className="mt-1">
                {t("terms.policy5a")} <strong>Supabase</strong>
                {t("terms.policy5b")}
                <strong>Google</strong>
                {t("terms.policy5c")}
              </p>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy6Title")}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>{t("terms.sec6_1")}</li>
                <li>{t("terms.sec6_2")}</li>
                <li>{t("terms.sec6_3")}</li>
                <li>{t("terms.sec6_4")}</li>
              </ul>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy7Title")}</h4>
              <p className="mt-1">{t("terms.policy7")}</p>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy8Title")}</h4>
              <p className="mt-1">{t("terms.policy8")}</p>

              <h4 className="mt-3 font-medium text-foreground">{t("terms.policy9Title")}</h4>
              <p className="mt-1">
                {t("terms.contactText")}{" "}
                <a
                  href="mailto:bgdsystemsbr@gmail.com"
                  className="font-medium text-primary hover:underline"
                >
                  bgdsystemsbr@gmail.com
                </a>
                {t("terms.contactEnd")}
              </p>
            </section>

            <p className="border-t border-border pt-4 text-xs">
              {t("terms.updated", { v: TERMS_VERSION })}
            </p>
          </div>

          <div className="space-y-3 border-t border-border p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">{t("terms.checkbox")}</span>
            </label>

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                {t("terms.refuse")}
              </button>
              <button
                type="button"
                onClick={() => void handleAccept()}
                disabled={!agreed || busy}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {t("terms.accept")}
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">{t("terms.refuseNote")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Splash() {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <span className="font-display text-2xl font-bold tracking-tight text-primary">ALTUS</span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("terms.verifying")}
      </span>
    </div>
  );
}
