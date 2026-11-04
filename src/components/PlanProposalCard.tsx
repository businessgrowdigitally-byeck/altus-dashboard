import { useMemo, useRef } from "react";
import { toast } from "sonner";
import { Check, ClipboardList, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { flushSync, useSyncStatus } from "@/lib/sync";
import { useI18n } from "@/lib/i18n";
import { todayISO } from "@/lib/format";
import { previewPlanProposal, type ProposalView } from "@/lib/ai/proposal";

/**
 * Cartão exibido abaixo de uma resposta do Mentor que traz um bloco
 * ```altus-plan```. Nada é gravado até o usuário clicar em "Confirmar e salvar".
 */
export function PlanProposalCard({ index, view }: { index: number; view: ProposalView }) {
  const { t } = useI18n();

  if (view.kind === "none") return null;
  if (view.kind !== "pending") {
    const text =
      view.kind === "saved"
        ? t("agente.plan.saved", { v: view.version ?? "?" })
        : view.kind === "discarded"
          ? t("agente.plan.discarded")
          : view.kind === "superseded"
            ? t("agente.plan.superseded")
            : t("agente.plan.invalid");
    return (
      <div
        data-plan-status={view.kind}
        className={`mt-2 text-xs rounded-lg px-3 py-2 border ${
          view.kind === "saved"
            ? "border-gold/40 bg-gold/10"
            : "border-border bg-muted/30 text-muted-foreground"
        }`}
      >
        {text}
      </div>
    );
  }
  return <PendingProposal index={index} proposal={view.proposal} />;
}

function PendingProposal({
  index,
  proposal,
}: {
  index: number;
  proposal: Extract<ProposalView, { kind: "pending" }>["proposal"];
}) {
  const { t } = useI18n();
  const altusPlans = useStore((s) => s.altusPlans);
  const goalsMacro = useStore((s) => s.goalsMacro);
  const saveAltusPlan = useStore((s) => s.saveAltusPlan);
  const setChatPlan = useStore((s) => s.setChatPlan);
  const busy = useRef(false);

  const preview = useMemo(
    () => previewPlanProposal(proposal, altusPlans ?? [], goalsMacro, todayISO()),
    [proposal, altusPlans, goalsMacro],
  );
  const { plan } = preview;

  const confirm = async () => {
    if (busy.current) return;
    busy.current = true;
    const saved = saveAltusPlan(proposal);
    setChatPlan(index, { status: "saved", planId: saved.id, version: saved.version });
    await flushSync();
    const sync = useSyncStatus.getState();
    if (sync.status === "error")
      toast.error(t("agente.plan.syncError", { error: sync.error ?? "" }));
    else toast.success(t("agente.plan.saved", { v: saved.version }));
  };

  const discard = () => {
    if (busy.current) return;
    busy.current = true;
    setChatPlan(index, { status: "discarded" });
  };

  const row = (label: string, value: string) =>
    value ? (
      <div>
        <span className="text-muted-foreground">{label}: </span>
        {value}
      </div>
    ) : null;

  return (
    <div
      data-plan-status="pending"
      className="mt-2 rounded-xl border border-gold/40 bg-gold/5 p-3 text-xs space-y-2"
    >
      <div className="flex items-center gap-2 font-semibold text-sm">
        <ClipboardList size={14} className="text-gold" />
        {t("agente.plan.title")}
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">
          {preview.fromVersion === null
            ? t("agente.plan.new")
            : t("agente.plan.revision", { from: preview.fromVersion, to: plan.version })}
        </span>
      </div>

      <div className="space-y-1">
        {row(t("agente.plan.macro"), plan.macroGoalName)}
        <div className="text-muted-foreground">
          {preview.linkedMacroName
            ? t("agente.plan.linked", { name: preview.linkedMacroName })
            : t("agente.plan.notLinked")}
        </div>
        {row(t("agente.plan.indicator"), plan.indicator)}
        {row(t("agente.plan.deadline"), plan.deadline)}
        {row(t("agente.plan.general"), plan.generalPlanning)}
        {row(t("agente.plan.strategy"), plan.strategy)}
      </div>

      {plan.stages.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1">{t("agente.plan.stages")}</div>
          <ol className="list-decimal pl-5 space-y-0.5">
            {plan.stages.map((s) => (
              <li key={s.id}>
                {s.title}
                {s.id === plan.activeStageId && (
                  <span className="ml-1 text-gold">({t("agente.plan.active")})</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {plan.microGoals.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1">{t("agente.plan.micro")}</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {plan.microGoals.map((m) => (
              <li key={m.id}>
                {m.title}
                {m.estimateMinutes ? ` · ${m.estimateMinutes} min` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1">
        {row(t("agente.plan.change"), preview.changeSummary)}
        {preview.newEntries > 0 && (
          <div className="text-muted-foreground">
            {t("agente.plan.newEntries", { n: preview.newEntries })}
          </div>
        )}
        {row(t("agente.plan.nextReview"), plan.nextReview)}
      </div>

      <div className="text-muted-foreground">{t("agente.plan.pendingNote")}</div>
      <div className="flex gap-2">
        <button
          onClick={() => void confirm()}
          className="flex items-center gap-1 bg-gold text-[#0A0F1E] px-3 py-1.5 rounded-lg font-semibold hover:brightness-110 transition"
        >
          <Check size={14} />
          {t("agente.plan.confirm")}
        </button>
        <button
          onClick={discard}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition"
        >
          <X size={14} />
          {t("agente.plan.discard")}
        </button>
      </div>
    </div>
  );
}
