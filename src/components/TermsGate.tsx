import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { TERMS_VERSION, getAcceptedTermsVersion, recordTermsAcceptance } from "@/lib/terms";

type GateState = "checking" | "required" | "accepted";

/**
 * Porteiro do consentimento (LGPD): bloqueia o app enquanto o usuário não
 * aceitar a versão vigente dos Termos de Uso e da Política de Privacidade.
 * O aceite é registrado no Supabase com user_id, timestamp e versão.
 */
export function TermsGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [loadError, setLoadError] = useState<string | null>(null);

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

  if (state === "checking") return <Splash label="Verificando Termos de Uso..." />;

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Não consegui verificar seus termos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <button
            onClick={check}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Tentar de novo
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
                Termos de Uso e Política de Privacidade
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Versão {TERMS_VERSION} · Para usar o ALTUS é preciso ler e aceitar este documento.
              </p>
            </div>
          </div>

          <div className="max-h-[45vh] space-y-5 overflow-y-auto p-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h3 className="font-semibold text-foreground">Termos de Uso</h3>
              <h4 className="mt-3 font-medium text-foreground">1. Objeto e aceitação</h4>
              <p className="mt-1">
                O ALTUS é um sistema operacional pessoal para organização da vida individual:
                finanças, corpo e saúde, biblioteca pessoal, estudos e metas. Ao criar uma conta e
                aceitar estes Termos, você obtém uma licença pessoal, intransferível e não exclusiva
                para usar a plataforma.
              </p>
              <h4 className="mt-3 font-medium text-foreground">2. Conta e segurança</h4>
              <p className="mt-1">
                Você é responsável por manter a confidencialidade das credenciais da sua conta e por
                toda atividade realizada com ela. Informe imediatamente qualquer uso não autorizado.
              </p>
              <h4 className="mt-3 font-medium text-foreground">3. Uso adequado</h4>
              <p className="mt-1">
                É proibido usar o ALTUS para atividades ilícitas, tentar acessar contas de
                terceiros, interferir na infraestrutura do serviço ou reproduzir conteúdo alheio sem
                autorização.
              </p>
              <h4 className="mt-3 font-medium text-foreground">4. Disponibilidade e alterações</h4>
              <p className="mt-1">
                Buscamos manter o serviço disponível, mas ele é oferecido "no estado em que se
                encontra". Podemos ajustar funcionalidades e atualizar estes Termos; alterações
                relevantes serão comunicadas e, quando necessário, exigirão novo aceite.
              </p>
              <h4 className="mt-3 font-medium text-foreground">5. Encerramento</h4>
              <p className="mt-1">
                Você pode encerrar sua conta a qualquer momento nas configurações do app ou
                solicitando a exclusão pelo canal de contato. Ver detalhes sobre exclusão de dados
                na Política de Privacidade abaixo.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">Política de Privacidade</h3>
              <p className="mt-1">
                Esta política explica como tratamos seus dados pessoais, em conformidade com a Lei
                Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018).
              </p>

              <h4 className="mt-3 font-medium text-foreground">1. Dados coletados e armazenados</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  Dados de cadastro: e-mail, nome (quando informado) e data/hora de acesso à conta.
                </li>
                <li>
                  Dados que você registra voluntariamente no app: lançamentos financeiros
                  (transações, categorias, saldos), medidas corporais e registros de saúde (peso,
                  treinos), itens de biblioteca, sessões de estudo, metas e rotinas diárias.
                </li>
                <li>
                  Registro de consentimento: data/hora e versão deste documento que você aceitou.
                </li>
              </ul>
              <p className="mt-1">
                Esses dados ficam armazenados em um banco PostgreSQL hospedado no Supabase,
                associados de forma única à sua conta. Não vendemos seus dados pessoais.
              </p>

              <h4 className="mt-3 font-medium text-foreground">2. Finalidade do tratamento</h4>
              <p className="mt-1">
                Os dados pessoais e financeiros que você registra são usados exclusivamente para:
                exibir dashboards, gráficos e relatórios dentro da sua própria conta; sincronizar
                suas informações entre seus dispositivos; permitir funcionalidades como metas
                vinculadas e resumos automáticos gerados a partir dos seus próprios registros; e
                cumprir obrigações legais aplicáveis.
              </p>

              <h4 className="mt-3 font-medium text-foreground">3. Base legal</h4>
              <p className="mt-1">
                O tratamento se dá com base no seu <strong>consentimento</strong> (art. 7º, I, da
                LGPD), manifestado ao aceitar este documento, e, quando aplicável, para a execução
                de contrato (art. 7º, V). Você pode revogar o consentimento a qualquer momento, sem
                custo.
              </p>

              <h4 className="mt-3 font-medium text-foreground">4. Tempo de retenção</h4>
              <p className="mt-1">
                Seus dados permanecem armazenados enquanto sua conta estiver ativa. Após a exclusão
                da conta (por você ou por solicitação), os dados pessoais são eliminados dos bancos
                de dados ativos imediatamente, podendo persistir em cópias de segurança automáticas
                por até 30 dias, até serem definitivamente sobrescritos.
              </p>

              <h4 className="mt-3 font-medium text-foreground">
                5. Compartilhamento com terceiros
              </h4>
              <p className="mt-1">
                Compartilhamos o mínimo necessário apenas com provedores de infraestrutura:{" "}
                <strong>Supabase</strong>
                (hospedagem do banco de dados e autenticação, infraestrutura em nuvem) e{" "}
                <strong>Google</strong>
                (login social opcional via Google OAuth). Esses provedores tratam dados como
                suboperadores, sob contratos e salvaguardas próprias. Não compartilhamos seus dados
                com anunciantes nem para fins comerciais de terceiros.
              </p>

              <h4 className="mt-3 font-medium text-foreground">6. Medidas de segurança</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Toda comunicação ocorre por conexões criptografadas (HTTPS/TLS).</li>
                <li>
                  Row Level Security (RLS): cada usuário só pode ler e escrever as próprias linhas
                  no banco de dados.
                </li>
                <li>
                  Criptografia do banco de dados em repouso fornecida pela infraestrutura de nuvem.
                </li>
                <li>Acesso administrativo aos dados restrito ao mínimo necessário.</li>
              </ul>

              <h4 className="mt-3 font-medium text-foreground">7. Direitos do titular</h4>
              <p className="mt-1">
                Nos termos do art. 18 da LGPD, você pode solicitar a qualquer momento: confirmação
                de tratamento; acesso aos seus dados; correção de dados incompletos, inexatos ou
                desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários ou
                tratados em desconformidade; portabilidade dos dados a outro fornecedor; informação
                sobre com quem compartilhamos seus dados; informação sobre a possibilidade de não
                fornecer consentimento e sobre as consequências; e revogação do consentimento. A
                exportação dos seus dados pode ser solicitada pelo canal de contato abaixo.
              </p>

              <h4 className="mt-3 font-medium text-foreground">8. Revogação e exclusão de conta</h4>
              <p className="mt-1">
                Você pode revogar o consentimento excluindo sua conta. Isso interrompe todo o
                tratamento e resulta na eliminação dos seus dados conforme a seção de retenção
                acima. O registro do aceite deste documento é mantido apenas como prova de
                conformidade legal, pelo prazo necessário.
              </p>

              <h4 className="mt-3 font-medium text-foreground">9. Contato</h4>
              <p className="mt-1">
                Dúvidas sobre este documento ou pedidos para exercer seus direitos podem ser
                enviados ao encarregado de proteção de dados (DPO):{" "}
                <a
                  href="mailto:bgdsystemsbr@gmail.com"
                  className="font-medium text-primary hover:underline"
                >
                  bgdsystemsbr@gmail.com
                </a>
                .
              </p>
            </section>

            <p className="border-t border-border pt-4 text-xs">
              Última atualização deste documento: agosto de 2026 · Versão {TERMS_VERSION}.
            </p>
          </div>

          <div className="space-y-3 border-t border-border p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">
                Li e concordo com os Termos de Uso e a Política de Privacidade.
              </span>
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
                Recusar e sair
              </button>
              <button
                type="button"
                onClick={() => void handleAccept()}
                disabled={!agreed || busy}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Aceitar e continuar
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Sem o aceite não é possível usar o ALTUS. Ao recusar, você será desconectado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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
