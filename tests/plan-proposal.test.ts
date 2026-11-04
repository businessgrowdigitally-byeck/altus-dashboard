import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyPlanProposal,
  parsePlanProposal,
  stripPlanBlocks,
  type AltusPlan,
} from "../src/lib/ai/plan.ts";
import { defaultMacroLink, previewAltusProposal, proposalViews } from "../src/lib/ai/proposal.ts";

const TODAY = "2026-11-04";
const block = (obj: unknown) => "```altus-plan\n" + JSON.stringify(obj) + "\n```";
const reply = (text: string, obj?: unknown) => (obj ? `${text}\n\n${block(obj)}` : text);

const proposal = {
  macroGoalId: "g1",
  macroGoalName: "Chegar a 75kg",
  indicator: "Peso semanal",
  deadline: "2027-03-01",
  strategy: "Déficit calórico moderado + treino 4x/semana.",
  activeStageId: "s1",
  stages: [
    {
      id: "s1",
      title: "Base",
      status: "ativa",
      actions: [{ id: "a1", title: "Treinar", done: false }],
    },
    { id: "s2", title: "Ajuste", status: "pendente", actions: [] },
  ],
  microGoals: [{ title: "Agendar 4 treinos", stageId: "s1", estimateMinutes: 15 }],
  decisions: [{ text: "Priorizar treino de manhã" }],
  changeSummary: "Plano inicial",
};

describe("parsePlanProposal / stripPlanBlocks", () => {
  it("extracts the last valid block and hides it from the text", () => {
    const text = reply("Proponho salvar.", proposal);
    assert.equal(parsePlanProposal(text)?.macroGoalName, "Chegar a 75kg");
    assert.equal(stripPlanBlocks(text), "Proponho salvar.");
  });

  it("returns null for malformed JSON or a proposal without name or planId", () => {
    assert.equal(parsePlanProposal("```altus-plan\n{nope\n```"), null);
    assert.equal(parsePlanProposal(block({ indicator: "x" })), null);
  });

  it("hides an unfinished block while the reply is still streaming", () => {
    assert.equal(stripPlanBlocks('Texto\n```altus-plan\n{"macroGoal'), "Texto");
  });
});

describe("applyPlanProposal", () => {
  it("creates v1 and only links macro goals that exist", () => {
    const { plan } = applyPlanProposal([], proposal, TODAY, ["g1"]);
    assert.equal(plan.version, 1);
    assert.equal(plan.macroGoalId, "g1");
    assert.equal(plan.activeStageId, "s1");
    assert.equal(plan.microGoals[0].status, "pendente");
    assert.equal(applyPlanProposal([], proposal, TODAY, ["other"]).plan.macroGoalId, null);
  });

  it("revises in place: bumps the version, keeps untouched fields and appends logs", () => {
    const v1 = applyPlanProposal([], proposal, TODAY, ["g1"]);
    const { plans, plan } = applyPlanProposal(
      v1.plans,
      {
        planId: v1.plan.id,
        decisions: [{ text: "Trocar corrida por bike" }],
        changeSummary: "Ajuste",
      },
      TODAY,
      ["g1"],
    );
    assert.equal(plans.length, 1);
    assert.equal(plan.id, v1.plan.id);
    assert.equal(plan.version, 2);
    assert.equal(plan.strategy, v1.plan.strategy);
    assert.equal(plan.stages.length, 2);
    assert.deepEqual(
      plan.decisions.map((d) => d.text),
      ["Priorizar treino de manhã", "Trocar corrida por bike"],
    );
    assert.deepEqual(
      plan.history.map((h) => h.version),
      [1, 2],
    );
  });
});

describe("previewAltusProposal", () => {
  const goals = [{ id: "g1", name: "Chegar a 75kg" }];
  const empty = { altusPlans: [] as AltusPlan[], altusGeneralPlan: null, altusFilter: [] };

  it("describes a new plan without saving anything", () => {
    const p = previewAltusProposal(proposal, empty, goals, TODAY, null);
    assert.equal(p.fromVersion, null);
    assert.equal(p.needsLink, false);
    assert.equal(p.result.plan?.version, 1);
    assert.equal(p.linkedMacroName, "Chegar a 75kg");
    assert.equal(p.changeSummary, "Plano inicial");
    assert.equal(p.newEntries, 1);
    assert.equal(empty.altusPlans.length, 0);
  });

  it("describes a revision of an existing plan", () => {
    const { plans, plan } = applyPlanProposal([], proposal, TODAY, ["g1"]);
    const state = { ...empty, altusPlans: plans };
    const p = previewAltusProposal(
      { planId: plan.id, results: [{ text: "-1kg" }], reviews: [{ text: "Semana 1" }] },
      state,
      goals,
      TODAY,
      null,
    );
    assert.equal(p.fromVersion, 1);
    assert.equal(p.result.plan?.version, 2);
    assert.equal(p.newEntries, 2);
    assert.equal(plans[0].version, 1, "the stored plan is untouched");
  });

  it("asks for a Macro Goal link when the proposal has no valid id", () => {
    const { macroGoalId: _id, ...unlinked } = proposal;
    const p = previewAltusProposal(unlinked, empty, goals, TODAY, { kind: "create" });
    assert.equal(p.needsLink, true);
    assert.equal(p.result.createdGoal?.name, "Chegar a 75kg");
    assert.deepEqual(defaultMacroLink(unlinked, goals), { kind: "existing", goalId: "g1" });
    assert.deepEqual(defaultMacroLink({ macroGoalName: "Outra" }, goals), { kind: "create" });
  });
});

describe("proposalViews", () => {
  type Msg = Parameters<typeof proposalViews>[0][number];
  const u = (content: string): Msg => ({ role: "user", content });
  const a = (content: string, plan?: Msg["plan"]): Msg =>
    plan ? { role: "assistant", content, plan } : { role: "assistant", content };

  it("only the latest undecided proposal can be confirmed", () => {
    const chat = [
      u("1"),
      a(reply("v1", proposal)),
      u("2"),
      a(reply("v2", proposal)),
      u("3"),
      a("ok"),
    ];
    const kinds = proposalViews(chat, false).map((v) => v.kind);
    assert.deepEqual(kinds, ["none", "superseded", "none", "pending", "none", "none"]);
  });

  it("keeps the saved or discarded decision recorded on the message", () => {
    const chat = [
      a(reply("v1", proposal), { status: "saved", planId: "p", version: 3 }),
      a(reply("v2", proposal), { status: "discarded" }),
    ];
    assert.deepEqual(proposalViews(chat, false), [
      { kind: "saved", saved: { status: "saved", planId: "p", version: 3 } },
      { kind: "discarded" },
    ]);
  });

  it("flags an invalid block, but not while the reply is streaming", () => {
    const broken = "Texto\n```altus-plan\n{nope\n```";
    assert.equal(proposalViews([a(broken)], false)[0].kind, "invalid");
    assert.equal(proposalViews([a(broken)], true)[0].kind, "none");
    assert.equal(proposalViews([a(reply("x", proposal))], true)[0].kind, "none");
  });
});
