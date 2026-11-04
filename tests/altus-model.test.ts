import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyAltusProposal,
  needsMacroLink,
  normalizeAltusState,
  parsePlanProposal,
  type AltusState,
} from "../src/lib/ai/plan.ts";
import { buildMentorContext } from "../src/lib/ai/context.ts";

const TODAY = "2026-11-04";
const goals = [
  { id: "g1", name: "Chegar a 75kg" },
  { id: "g2", name: "Economizar R$20.000" },
];
const empty = (): AltusState => ({ altusPlans: [], altusGeneralPlan: null, altusFilter: [] });

/** Plano gravado pela versão anterior (F1): P.G. e ideias dentro do plano. */
const legacyPlan = {
  id: "p1",
  macroGoalId: "g1",
  macroGoalName: "Chegar a 75kg",
  generalPlanning: "Saúde em foco; finanças em manutenção.",
  indicator: "Peso semanal",
  deadline: "2027-03-01",
  strategy: "Treino 4x",
  activeStageId: "s1",
  stages: [{ id: "s1", title: "Base", status: "ativa", actions: [] }],
  microGoals: [{ id: "m1", title: "Agendar treinos", status: "pendente" }],
  decisions: [{ date: "2026-10-01", text: "Treinar de manhã" }],
  results: [],
  reviews: [],
  parkedIdeas: [{ date: "2026-10-02", text: "Comprar bicicleta" }],
  nextReview: "2026-11-01",
  version: 2,
  history: [
    { version: 1, date: "2026-09-20", summary: "Inicial" },
    { version: 2, date: "2026-10-01", summary: "Ajuste" },
  ],
  createdAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

describe("normalizeAltusState (migração do formato antigo)", () => {
  it("moves the per-plan P.G. into the single General Plan, without losing it", () => {
    const out = normalizeAltusState({ altusPlans: [legacyPlan] }, TODAY);
    assert.equal(
      out.altusGeneralPlan?.summary,
      "Chegar a 75kg: Saúde em foco; finanças em manutenção.",
    );
    assert.equal(out.altusGeneralPlan?.version, 1);
    assert.equal("generalPlanning" in out.altusPlans[0], false);
  });

  it("turns parked ideas into 'estacionar' Filter decisions linked to the plan", () => {
    const out = normalizeAltusState({ altusPlans: [legacyPlan] }, TODAY);
    assert.equal(out.altusFilter.length, 1);
    assert.deepEqual(
      { ...out.altusFilter[0], id: "x" },
      {
        id: "x",
        date: "2026-10-02",
        idea: "Comprar bicicleta",
        verdict: "estacionar",
        rationale: "",
        nextAction: "",
        macroGoalId: "g1",
        planId: "p1",
      },
    );
    assert.equal("parkedIdeas" in out.altusPlans[0], false);
  });

  it("keeps everything else of the plan as it was", () => {
    const [plan] = normalizeAltusState({ altusPlans: [legacyPlan] }, TODAY).altusPlans;
    assert.equal(plan.version, 2);
    assert.equal(plan.history.length, 2);
    assert.equal(plan.activeStageId, "s1");
    assert.equal(plan.microGoals[0].id, "m1");
    assert.equal(plan.decisions[0].text, "Treinar de manhã");
    assert.equal(plan.createdAt, legacyPlan.createdAt);
  });

  it("is idempotent: normalizing the result again changes nothing", () => {
    const once = normalizeAltusState({ altusPlans: [legacyPlan] }, TODAY);
    const twice = normalizeAltusState(once, TODAY);
    assert.deepEqual(twice, once);
  });

  it("appends a late legacy P.G. to an existing General Plan instead of overwriting it", () => {
    const once = normalizeAltusState({ altusPlans: [legacyPlan] }, TODAY);
    const out = normalizeAltusState(
      { ...once, altusPlans: [{ ...once.altusPlans[0], generalPlanning: "Novo texto" }] },
      TODAY,
    );
    assert.match(out.altusGeneralPlan!.summary, /Saúde em foco/);
    assert.match(out.altusGeneralPlan!.summary, /Chegar a 75kg: Novo texto/);
  });

  it("drops malformed records instead of breaking the app", () => {
    const out = normalizeAltusState(
      {
        altusPlans: [null, "x", { title: "sem id" }, legacyPlan],
        altusGeneralPlan: "bad",
        altusFilter: [
          { idea: "x", verdict: "talvez" },
          { idea: "ok", verdict: "TESTAR" },
        ],
      },
      TODAY,
    );
    assert.equal(out.altusPlans.length, 1);
    assert.deepEqual(
      out.altusFilter.map((f) => f.verdict),
      ["estacionar", "testar"],
    );
  });

  it("returns an empty state for accounts without planning", () => {
    assert.deepEqual(normalizeAltusState({}, TODAY), empty());
  });
});

describe("applyAltusProposal", () => {
  it("requires a Macro Goal link for a plan", () => {
    const p = { macroGoalName: "Nova meta", indicator: "x" };
    assert.equal(needsMacroLink(p, [], ["g1"]), true);
    assert.throws(() => applyAltusProposal(empty(), goals, p, TODAY, null), /macro_link_required/);
  });

  it("links to an existing goal chosen by the user", () => {
    const r = applyAltusProposal(empty(), goals, { macroGoalName: "Peso" }, TODAY, {
      kind: "existing",
      goalId: "g1",
    });
    assert.equal(r.plan?.macroGoalId, "g1");
    assert.equal(r.createdGoal, null);
  });

  it("creates the Macro Goal from the proposal when asked", () => {
    const r = applyAltusProposal(
      empty(),
      goals,
      {
        macroGoalName: "Ler 12 livros",
        deadline: "2026-12-31",
        macroGoal: {
          area: "Biblioteca",
          type: "numerica",
          currentValue: 3,
          targetValue: 12,
          unit: "livros",
        },
      },
      TODAY,
      { kind: "create" },
    );
    assert.ok(r.createdGoal);
    assert.equal(r.plan?.macroGoalId, r.createdGoal!.id);
    assert.deepEqual(
      { ...r.createdGoal, id: "x" },
      {
        id: "x",
        name: "Ler 12 livros",
        area: "Biblioteca",
        type: "numerica",
        currentValue: 3,
        targetValue: 12,
        unit: "livros",
        deadline: "2026-12-31",
        motivation: undefined,
        linkedModule: null,
        createdAt: TODAY,
      },
    );
  });

  it("one plan per Macro Goal: a proposal without planId revises the goal's plan", () => {
    const v1 = applyAltusProposal(
      empty(),
      goals,
      { macroGoalId: "g1", macroGoalName: "Peso" },
      TODAY,
    );
    const v2 = applyAltusProposal(
      v1.state,
      goals,
      { macroGoalId: "g1", macroGoalName: "Peso", strategy: "Nova" },
      TODAY,
    );
    assert.equal(v2.state.altusPlans.length, 1);
    assert.equal(v2.plan?.id, v1.plan?.id);
    assert.equal(v2.plan?.version, 2);
  });

  it("an invalid area or type falls back to safe values", () => {
    const r = applyAltusProposal(
      empty(),
      goals,
      { macroGoalName: "X", macroGoal: { area: "Lua", type: "magia", targetValue: "12" } },
      TODAY,
      { kind: "create" },
    );
    assert.equal(r.createdGoal?.area, "Geral");
    assert.equal(r.createdGoal?.type, "numerica");
    assert.equal(r.createdGoal?.targetValue, 0);
  });

  it("saves and versions the single General Plan, keeping only valid goal ids", () => {
    const v1 = applyAltusProposal(
      empty(),
      goals,
      {
        generalPlan: {
          summary: "Saúde primeiro",
          focusGoalIds: ["g1", "nope"],
          maintenanceGoalIds: ["g2", "g1"],
          capacity: "1h por dia",
        },
        changeSummary: "P.G. inicial",
      },
      TODAY,
    );
    assert.equal(v1.plan, null);
    assert.equal(v1.generalPlan?.version, 1);
    assert.deepEqual(v1.generalPlan?.focusGoalIds, ["g1"]);
    assert.deepEqual(
      v1.generalPlan?.maintenanceGoalIds,
      ["g2"],
      "a goal is not in focus and maintenance",
    );
    const v2 = applyAltusProposal(
      v1.state,
      goals,
      { generalPlan: { constraints: "Viagem em dezembro" } },
      TODAY,
    );
    assert.equal(v2.generalPlan?.version, 2);
    assert.equal(v2.generalPlan?.summary, "Saúde primeiro", "fields not sent are kept");
    assert.equal(v2.generalPlan?.constraints, "Viagem em dezembro");
    assert.equal(v2.state.altusPlans.length, 0);
  });

  it("records structured Filter decisions and rejects unknown verdicts", () => {
    const r = applyAltusProposal(
      empty(),
      goals,
      {
        filterDecisions: [
          {
            idea: "Curso de investimentos",
            verdict: "testar",
            rationale: "Hipótese",
            nextAction: "Aula grátis",
            macroGoalId: "g2",
          },
          { idea: "Maratona", verdict: "talvez" },
        ],
      },
      TODAY,
    );
    assert.equal(r.decisions.length, 1);
    assert.equal(r.decisions[0].verdict, "testar");
    assert.equal(r.decisions[0].macroGoalId, "g2");
    assert.equal(r.state.altusFilter.length, 1);
  });

  it("legacy parkedIdeas in a proposal become 'estacionar' decisions for that plan", () => {
    const r = applyAltusProposal(
      empty(),
      goals,
      { macroGoalId: "g1", macroGoalName: "Peso", parkedIdeas: [{ text: "Nutricionista" }] },
      TODAY,
    );
    assert.equal(r.decisions[0].verdict, "estacionar");
    assert.equal(r.decisions[0].planId, r.plan?.id);
  });

  it("an old-format proposal's generalPlanning is appended to the single P.G., not lost", () => {
    const v1 = applyAltusProposal(empty(), goals, { generalPlan: { summary: "Base" } }, TODAY);
    const r = applyAltusProposal(
      v1.state,
      goals,
      { macroGoalId: "g1", macroGoalName: "Peso", generalPlanning: "Saúde em foco" },
      TODAY,
    );
    assert.equal(r.generalPlan?.version, 2);
    assert.equal(r.generalPlan?.summary, "Base\n\nPeso: Saúde em foco");
    assert.equal("generalPlanning" in r.plan!, false);
  });

  it("parsePlanProposal accepts a proposal with only P.G. or only Filter decisions", () => {
    const wrap = (o: unknown) => "```altus-plan\n" + JSON.stringify(o) + "\n```";
    assert.ok(parsePlanProposal(wrap({ generalPlan: { summary: "x" } })));
    assert.ok(parsePlanProposal(wrap({ filterDecisions: [{ idea: "x", verdict: "testar" }] })));
    assert.equal(parsePlanProposal(wrap({ changeSummary: "nada" })), null);
  });
});

describe("buildMentorContext", () => {
  it("shows legacy data already in the new format, with goal names and link status", () => {
    const ctx = buildMentorContext(
      {
        goalsMacro: [{ id: "g1", name: "Chegar a 75kg" }],
        altusPlans: [
          legacyPlan,
          { ...legacyPlan, id: "p2", macroGoalId: "gone", generalPlanning: "" },
        ],
      },
      TODAY,
    );
    assert.equal(ctx.planejamento_geral?.visao_geral.includes("Saúde em foco"), true);
    assert.equal(ctx.planejamentos_altus[0].vinculo_meta_macro, "ok");
    assert.match(ctx.planejamentos_altus[1].vinculo_meta_macro, /SEM VÍNCULO/);
    assert.equal(ctx.planejamentos_altus[1].macroGoalId, null);
    assert.equal(ctx.planejamentos_altus[0].revisao_vencida, true);
    assert.equal(ctx.filtro_altus[0].veredito, "estacionar");
    assert.equal(ctx.metas_macro[0].planId_vinculado, "p1");
    assert.equal("planejamento_geral" in ctx.planejamentos_altus[0], false);
  });
});
