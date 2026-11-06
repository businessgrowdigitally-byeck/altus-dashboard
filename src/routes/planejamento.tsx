import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GoatIcon } from "@/components/GoatIcon";
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore, type AltusPlan } from "@/lib/store";
import { AI_AGENT_ENABLED } from "@/lib/features";
import { fmtDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useToday } from "@/hooks/use-today";
import { GlassCard, PageHeader, Section } from "@/components/primitives";
import { ConfirmButton } from "@/components/Modal";
import { FILTER_VERDICTS, type FilterVerdict, type PlanLogEntry } from "@/lib/ai/plan";
import {
  filterDecisions,
  linkableGoals,
  microProgress,
  overduePlans,
} from "@/lib/ai/planning-view";

export const Route = createFileRoute("/planejamento")({
  // Parte do Mentor ALTUS (add-on): some junto com o agente quando desativado.
  beforeLoad: () => {
    if (!AI_AGENT_ENABLED) throw redirect({ to: "/" });
  },
  component: Planejamento,
});

type T = (key: string, vars?: Record<string, string | number>) => string;

const VERDICT_STYLE: Record<FilterVerdict, string> = {
  executar: "bg-emerald-bgt/15 text-emerald-bgt border-emerald-bgt/40",
  testar: "bg-gold/15 text-gold border-gold/40",
  estacionar: "bg-blue-500/15 text-blue-400 border-blue-400/40",
  descartar: "bg-muted/50 text-muted-foreground border-border",
};

function Planejamento() {
  const { t } = useI18n();
  const today = useToday();
  const { altusGeneralPlan: general, altusPlans, altusFilter, goalsMacro } = useStore();
  const plans = altusPlans ?? [];
  const overdue = overduePlans(plans, today);
  const goalName = (id: string) =>
    goalsMacro.find((g) => g.id === id)?.name ?? t("plan.goalMissing");

  return (
    <div>
      <PageHeader
        title={t("plan.title")}
        subtitle={t("plan.subtitle")}
        right={
          <Link
            to="/agente"
            className="inline-flex items-center gap-2 rounded-lg border border-gold/40 px-3 py-2 text-sm text-gold hover:bg-gold/10"
          >
            <GoatIcon size={20} />
            {t("plan.openMentor")}
          </Link>
        }
      />
      <p className="text-xs text-muted-foreground -mt-3 mb-5">{t("plan.howToEdit")}</p>

      {overdue.length > 0 && (
        <div
          data-overdue
          className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-coral/40 bg-coral/10 p-4 text-sm"
        >
          <AlertTriangle size={18} className="text-coral shrink-0" />
          <span className="flex-1 min-w-0">
            {t("plan.overdue", {
              n: overdue.length,
              names: overdue.map((p) => p.macroGoalName).join(", "),
            })}
          </span>
          <Link
            to="/agente"
            search={{
              q: t("plan.reviewPrompt", { names: overdue.map((p) => p.macroGoalName).join(", ") }),
            }}
            className="rounded-lg bg-coral px-3 py-1.5 font-semibold text-white hover:brightness-110"
          >
            {t("plan.doReview")}
          </Link>
        </div>
      )}

      <Section title={t("plan.general")} className="mt-0">
        {general ? (
          <GlassCard className="space-y-3 text-sm">
            <div
              data-general
              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            >
              <span>{t("plan.version", { v: general.version })}</span>
              <span>· {t("plan.updated", { date: fmtDate(general.updatedAt.slice(0, 10)) })}</span>
            </div>
            {general.summary && <p className="whitespace-pre-wrap">{general.summary}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("plan.focus")}>
                {general.focusGoalIds.length ? general.focusGoalIds.map(goalName).join(", ") : "—"}
              </Field>
              <Field label={t("plan.maintenance")}>
                {general.maintenanceGoalIds.length
                  ? general.maintenanceGoalIds.map(goalName).join(", ")
                  : "—"}
              </Field>
              <Field label={t("plan.capacity")}>{general.capacity || "—"}</Field>
              <Field label={t("plan.constraints")}>{general.constraints || "—"}</Field>
            </div>
            <History
              t={t}
              entries={general.history.map((h) => ({
                date: h.date,
                text: `v${h.version} — ${h.summary}`,
              }))}
            />
          </GlassCard>
        ) : (
          <Empty text={t("plan.generalEmpty")} cta={t("plan.generalCta")} q={t("agente.quick3")} />
        )}
      </Section>

      <Section title={t("plan.specific")}>
        {plans.length === 0 ? (
          <Empty text={t("plan.plansEmpty")} cta={t("plan.plansCta")} q={t("plan.plansPrompt")} />
        ) : (
          <div className="space-y-4">
            {plans.map((p) => (
              <PlanCard key={p.id} t={t} plan={p} today={today} />
            ))}
          </div>
        )}
      </Section>

      <Section title={t("plan.filter")}>
        <FilterList t={t} goalName={goalName} plans={plans} />
      </Section>

      {(altusFilter ?? []).length === 0 && plans.length === 0 && !general && (
        <p className="mt-6 text-xs text-muted-foreground">{t("plan.allEmpty")}</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-words">{children}</div>
    </div>
  );
}

function Empty({ text, cta, q }: { text: string; cta: string; q: string }) {
  return (
    <GlassCard className="text-sm text-muted-foreground flex flex-wrap items-center gap-3">
      <span className="flex-1 min-w-0">{text}</span>
      <Link to="/agente" search={{ q }} className="text-gold hover:underline whitespace-nowrap">
        {cta}
      </Link>
    </GlassCard>
  );
}

function History({ t, entries, title }: { t: T; entries: PlanLogEntry[]; title?: string }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
        {title ?? t("plan.history")} ({entries.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-1 border-l border-border pl-3">
          {[...entries].reverse().map((e, i) => (
            <li key={i}>
              <span className="text-muted-foreground">{fmtDate(e.date)}</span> — {e.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanCard({ t, plan, today }: { t: T; plan: AltusPlan; today: string }) {
  const { goalsMacro, altusPlans, toggleMicroGoal, removeAltusPlan, linkPlanToGoal } = useStore();
  const goal = goalsMacro.find((g) => g.id === plan.macroGoalId);
  const options = useMemo(
    () => linkableGoals(goalsMacro, altusPlans, plan.id),
    [goalsMacro, altusPlans, plan.id],
  );
  const progress = microProgress(plan);
  const overdue = Boolean(plan.nextReview && plan.nextReview <= today);
  const active = plan.stages.find((s) => s.id === plan.activeStageId);

  return (
    <GlassCard className="space-y-4 text-sm">
      <div data-plan={plan.id} className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-lg break-words">
            {goal?.name ?? plan.macroGoalName}
          </h3>
          <div className="text-xs text-muted-foreground">
            {t("plan.version", { v: plan.version })} ·{" "}
            {t("plan.updated", { date: fmtDate(plan.updatedAt.slice(0, 10)) })}
          </div>
        </div>
        <ConfirmButton
          onConfirm={() => removeAltusPlan(plan.id)}
          message={t("plan.deleteConfirm", { name: goal?.name ?? plan.macroGoalName })}
          className="text-coral p-1.5 rounded hover:bg-muted/80"
        >
          <Trash2 size={16} />
        </ConfirmButton>
      </div>

      {!goal && (
        <div data-unlinked className="rounded-lg border border-gold/40 bg-gold/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-gold font-medium">
            <Link2 size={14} /> {t("plan.unlinked")}
          </div>
          {options.length > 0 ? (
            <select
              aria-label={t("plan.linkLabel")}
              value=""
              onChange={(e) => {
                if (e.target.value && linkPlanToGoal(plan.id, e.target.value))
                  toast.success(t("plan.linked"));
              }}
              className="w-full bg-secondary border border-border rounded-lg px-2 py-2"
            >
              <option value="">{t("plan.linkLabel")}</option>
              {options.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-muted-foreground">{t("plan.noLinkable")}</p>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label={t("plan.indicator")}>{plan.indicator || "—"}</Field>
        <Field label={t("plan.deadline")}>{plan.deadline || "—"}</Field>
        <Field label={t("plan.nextReview")}>
          <span className={overdue ? "text-coral font-semibold" : ""}>
            {plan.nextReview ? fmtDate(plan.nextReview) : "—"}
            {overdue && ` · ${t("plan.overdueBadge")}`}
          </span>
        </Field>
      </div>
      {plan.strategy && <Field label={t("plan.strategy")}>{plan.strategy}</Field>}

      {plan.stages.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            {t("plan.stages")}
            {active && ` · ${t("plan.activeStage", { name: active.title })}`}
          </div>
          <ol className="space-y-1.5">
            {plan.stages.map((s, i) => (
              <li
                key={s.id}
                data-stage={s.id}
                className={`rounded-lg border px-3 py-2 ${s.id === plan.activeStageId ? "border-gold/50 bg-gold/5" : "border-border"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1 min-w-0 break-words">{s.title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t(`plan.stageStatus.${s.status}`)}
                  </span>
                </div>
                {s.doneCriteria && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("plan.doneCriteria")}: {s.doneCriteria}
                  </div>
                )}
                {s.actions.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {s.actions.map((a) => (
                      <li key={a.id} className={a.done ? "text-muted-foreground line-through" : ""}>
                        • {a.title}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <div className="text-xs text-muted-foreground mb-1">
          {t("plan.micro")} ·{" "}
          {t("plan.microProgress", { done: progress.done, total: progress.total })}
        </div>
        {plan.microGoals.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("plan.microEmpty")}</p>
        ) : (
          <ul className="space-y-1">
            {plan.microGoals.map((m) => {
              const done = m.status === "concluida";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    data-micro={m.id}
                    onClick={() => toggleMicroGoal(plan.id, m.id)}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50"
                  >
                    {done ? (
                      <CheckCircle2 size={18} className="text-emerald-bgt shrink-0 mt-0.5" />
                    ) : (
                      <Circle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <span className="min-w-0">
                      <span className={done ? "line-through text-muted-foreground" : ""}>
                        {m.title}
                      </span>
                      {(m.doneCriteria || m.estimateMinutes) && (
                        <span className="block text-xs text-muted-foreground">
                          {m.doneCriteria}
                          {m.doneCriteria && m.estimateMinutes ? " · " : ""}
                          {m.estimateMinutes ? `${m.estimateMinutes} min` : ""}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">{t("plan.microVsResults")}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <LogList
          t={t}
          title={t("plan.results")}
          entries={plan.results}
          empty={t("plan.resultsEmpty")}
        />
        <LogList t={t} title={t("plan.decisions")} entries={plan.decisions} empty="—" />
        <LogList t={t} title={t("plan.reviews")} entries={plan.reviews} empty="—" />
      </div>

      <History
        t={t}
        entries={plan.history.map((h) => ({ date: h.date, text: `v${h.version} — ${h.summary}` }))}
      />

      <Link
        to="/agente"
        search={{ q: t("plan.reviewPrompt", { names: goal?.name ?? plan.macroGoalName }) }}
        className="inline-flex text-xs text-gold hover:underline"
      >
        {t("plan.reviewWithMentor")}
      </Link>
    </GlassCard>
  );
}

function LogList({
  t,
  title,
  entries,
  empty,
}: {
  t: T;
  title: string;
  entries: PlanLogEntry[];
  empty: string;
}) {
  const last = entries.slice(-3).reverse();
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      {last.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {last.map((e, i) => (
            <li key={i} className="break-words">
              <span className="text-muted-foreground">{fmtDate(e.date)}</span> — {e.text}
            </li>
          ))}
        </ul>
      )}
      {entries.length > 3 && (
        <History t={t} entries={entries.slice(0, -3)} title={t("plan.older")} />
      )}
    </div>
  );
}

function FilterList({
  t,
  goalName,
  plans,
}: {
  t: T;
  goalName: (id: string) => string;
  plans: AltusPlan[];
}) {
  const { altusFilter, removeFilterDecision } = useStore();
  const [verdict, setVerdict] = useState<FilterVerdict | "todas">("todas");
  const all = altusFilter ?? [];
  const shown = filterDecisions(all, verdict);
  const chip = (v: FilterVerdict | "todas", label: string) => (
    <button
      key={v}
      type="button"
      aria-pressed={verdict === v}
      onClick={() => setVerdict(v)}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs ${verdict === v ? "border-gold text-gold" : "border-border text-muted-foreground"}`}
    >
      {label}
    </button>
  );

  if (all.length === 0)
    return <Empty text={t("plan.filterEmpty")} cta={t("plan.filterCta")} q={t("agente.quick5")} />;

  return (
    <GlassCard className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {chip("todas", `${t("plan.filterAll")} (${all.length})`)}
        {FILTER_VERDICTS.map((v) =>
          chip(v, `${t(`agente.verdict.${v}`)} (${all.filter((d) => d.verdict === v).length})`),
        )}
      </div>
      <ul className="space-y-2">
        {shown.map((d) => {
          const plan = plans.find((p) => p.id === d.planId);
          return (
            <li
              key={d.id}
              data-decision={d.id}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${VERDICT_STYLE[d.verdict]}`}
                >
                  {t(`agente.verdict.${d.verdict}`)}
                </span>
                <span className="flex-1 min-w-0 break-words font-medium">{d.idea}</span>
                <ConfirmButton
                  onConfirm={() => removeFilterDecision(d.id)}
                  message={t("plan.filterDeleteConfirm", { idea: d.idea })}
                  className="text-coral p-1 rounded hover:bg-muted/80"
                >
                  <Trash2 size={14} />
                </ConfirmButton>
              </div>
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {d.rationale && <div>{d.rationale}</div>}
                {d.nextAction && (
                  <div>
                    {t("agente.plan.nextAction")}:{" "}
                    <span className="text-foreground">{d.nextAction}</span>
                  </div>
                )}
                <div>
                  {fmtDate(d.date)}
                  {d.macroGoalId && ` · ${goalName(d.macroGoalId)}`}
                  {plan && !d.macroGoalId && ` · ${plan.macroGoalName}`}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}
