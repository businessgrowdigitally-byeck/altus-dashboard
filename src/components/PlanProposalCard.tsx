import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ClipboardList, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { flushSync, useSyncStatus } from "@/lib/sync";
import { useI18n } from "@/lib/i18n";
import { todayISO } from "@/lib/format";
import type { MacroLink, PlanProposal } from "@/lib/ai/plan";
import {
  defaultMacroLink,
  previewAltusProposal,
  type ChatPlanState,
  type ProposalView,
} from "@/lib/ai/proposal";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Texto do que foi salvo — também usado no aviso de sucesso. */
function savedText(t: T, saved: ChatPlanState): string {
  const parts: string[] = [];
  if (saved.version) parts.push(t("agente.plan.saved", { v: saved.version }));
  if (saved.generalVersion) parts.push(t("agente.plan.savedGeneral", { v: saved.generalVersion }));
  if (saved.decisions) parts.push(t("agente.plan.savedFilter", { n: saved.decisions }));
  return parts.join(" ") || t("agente.plan.saved", { v: "?" });
}

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
        ? savedText(t, view.saved)
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

const LINK_CREATE = "__create__";

function PendingProposal({ index, proposal }: { index: number; proposal: PlanProposal }) {
  const { t } = useI18n();
  const altusPlans = useStore((s) => s.altusPlans);
  const altusGeneralPlan = useStore((s) => s.altusGeneralPlan);
  const altusFilter = useStore((s) => s.altusFilter);
  const goalsMacro = useStore((s) => s.goalsMacro);
  const saveAltusProposal = useStore((s) => s.saveAltusProposal);
  const setChatPlan = useStore((s) => s.setChatPlan);
  const [chosen, setLink] = useState<MacroLink>(() => defaultMacroLink(proposal, goalsMacro));
  // Se a meta escolhida foi apagada enquanto o cartão estava aberto, volta para "criar".
  const link = useMemo<MacroLink>(
    () =>
      chosen.kind === "existing" && !goalsMacro.some((g) => g.id === chosen.goalId)
        ? { kind: "create" }
        : chosen,
    [chosen, goalsMacro],
  );
  const busy = useRef(false);

  const preview = useMemo(
    () =>
      previewAltusProposal(
        proposal,
        {
          altusPlans: altusPlans ?? [],
          altusGeneralPlan: altusGeneralPlan ?? null,
          altusFilter: altusFilter ?? [],
        },
        goalsMacro,
        todayISO(),
        link,
      ),
    [proposal, altusPlans, altusGeneralPlan, altusFilter, goalsMacro, link],
  );
  const { plan, generalPlan, decisions, createdGoal } = preview.result;
  const goalName = (id: string) => goalsMacro.find((g) => g.id === id)?.name ?? id;

  const confirm = async () => {
    if (busy.current) return;
    busy.current = true;
    const result = saveAltusProposal(proposal, preview.needsLink ? link : null);
    const saved: ChatPlanState = {
      status: "saved",
      planId: result.plan?.id,
      version: result.plan?.version,
      generalVersion: result.generalPlan?.version,
      decisions: result.decisions.length || undefined,
    };
    setChatPlan(index, saved);
    await flushSync();
    const sync = useSyncStatus.getState();
    if (sync.status === "error")
      toast.error(t("agente.plan.syncError", { error: sync.error ?? "" }));
    else toast.success(savedText(t, saved));
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
  const section = (title: string, badge: string, children: React.ReactNode) => (
    <div className="space-y-1 border-t border-gold/20 pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 font-semibold">
        {title}
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">{badge}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div
      data-plan-status="pending"
      className="mt-2 rounded-xl border border-gold/40 bg-gold/5 p-3 text-xs space-y-2"
    >
      <div className="flex items-center gap-2 font-semibold text-sm">
        <ClipboardList size={14} className="text-gold" />
        {t("agente.plan.title")}
      </div>

      {generalPlan &&
        section(
          t("agente.plan.general"),
          preview.generalFromVersion === null
            ? t("agente.plan.new")
            : t("agente.plan.revision", {
                from: preview.generalFromVersion,
                to: generalPlan.version,
              }),
          <>
            {row(t("agente.plan.generalSummary"), generalPlan.summary)}
            {row(t("agente.plan.focus"), generalPlan.focusGoalIds.map(goalName).join(", "))}
            {row(
              t("agente.plan.maintenance"),
              generalPlan.maintenanceGoalIds.map(goalName).join(", "),
            )}
            {row(t("agente.plan.capacity"), generalPlan.capacity)}
            {row(t("agente.plan.constraints"), generalPlan.constraints)}
          </>,
        )}

      {plan &&
        section(
          t("agente.plan.specific"),
          preview.fromVersion === null
            ? t("agente.plan.new")
            : t("agente.plan.revision", { from: preview.fromVersion, to: plan.version }),
          <>
            {preview.needsLink ? (
              <label className="block space-y-1">
                <span className="text-muted-foreground">{t("agente.plan.linkLabel")}</span>
                <select
                  data-macro-link
                  value={link.kind === "create" ? LINK_CREATE : link.goalId}
                  onChange={(e) =>
                    setLink(
                      e.target.value === LINK_CREATE
                        ? { kind: "create" }
                        : { kind: "existing", goalId: e.target.value },
                    )
                  }
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5"
                >
                  <option value={LINK_CREATE}>
                    {t("agente.plan.linkCreate", { name: plan.macroGoalName })}
                  </option>
                  {goalsMacro.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {createdGoal && (
                  <span className="block text-muted-foreground">
                    {t("agente.plan.linkCreateHint")}
                  </span>
                )}
              </label>
            ) : (
              row(t("agente.plan.macro"), preview.linkedMacroName ?? plan.macroGoalName)
            )}
            {row(t("agente.plan.indicator"), plan.indicator)}
            {row(t("agente.plan.deadline"), plan.deadline)}
            {row(t("agente.plan.strategy"), plan.strategy)}
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
            {preview.newEntries > 0 && (
              <div className="text-muted-foreground">
                {t("agente.plan.newEntries", { n: preview.newEntries })}
              </div>
            )}
            {row(t("agente.plan.nextReview"), plan.nextReview)}
          </>,
        )}

      {decisions.length > 0 &&
        section(
          t("agente.plan.filter"),
          String(decisions.length),
          <ul className="space-y-1.5">
            {decisions.map((d) => (
              <li key={d.id} data-filter-verdict={d.verdict}>
                <span className="font-semibold text-gold">{t(`agente.verdict.${d.verdict}`)}</span>
                {" — "}
                {d.idea}
                {d.rationale && <div className="text-muted-foreground">{d.rationale}</div>}
                {d.nextAction && (
                  <div>
                    <span className="text-muted-foreground">{t("agente.plan.nextAction")}: </span>
                    {d.nextAction}
                  </div>
                )}
              </li>
            ))}
          </ul>,
        )}

      {row(t("agente.plan.change"), preview.changeSummary)}
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
