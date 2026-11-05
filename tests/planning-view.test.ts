import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterDecisions,
  linkableGoals,
  microProgress,
  overduePlans,
} from "../src/lib/ai/planning-view.ts";
import { normalizeAltusState, type AltusFilterDecision } from "../src/lib/ai/plan.ts";

const TODAY = "2026-11-05";
const base = {
  macroGoalName: "X",
  indicator: "",
  deadline: "",
  strategy: "",
  activeStageId: null,
  stages: [],
  decisions: [],
  results: [],
  reviews: [],
  version: 1,
  history: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};
const { altusPlans: plans } = normalizeAltusState(
  {
    altusPlans: [
      {
        ...base,
        id: "p1",
        macroGoalId: "g1",
        nextReview: "2026-11-01",
        microGoals: [
          { id: "m1", title: "a", status: "concluida" },
          { id: "m2", title: "b" },
        ],
      },
      { ...base, id: "p2", macroGoalId: null, nextReview: "2026-11-12", microGoals: [] },
      { ...base, id: "p3", macroGoalId: "g2", nextReview: "", microGoals: [] },
    ],
  },
  TODAY,
);

describe("tela de planejamento", () => {
  it("lists plans whose weekly review is due (today or earlier)", () => {
    assert.deepEqual(
      overduePlans(plans, TODAY).map((p) => p.id),
      ["p1"],
    );
    assert.deepEqual(
      overduePlans(plans, "2026-11-12").map((p) => p.id),
      ["p1", "p2"],
    );
  });

  it("offers only goals not linked to another plan (one S.P. per Macro Goal)", () => {
    const goals = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];
    assert.deepEqual(
      linkableGoals(goals, plans, "p2").map((g) => g.id),
      ["g3"],
    );
    assert.deepEqual(
      linkableGoals(goals, plans, "p1").map((g) => g.id),
      ["g1", "g3"],
      "a plan can keep its own goal",
    );
  });

  it("counts completed Micro Goals", () => {
    assert.deepEqual(microProgress(plans[0]), { done: 1, total: 2 });
    assert.deepEqual(microProgress(plans[1]), { done: 0, total: 0 });
  });

  it("filters ALTUS Filter decisions by verdict", () => {
    const d = (verdict: AltusFilterDecision["verdict"]): AltusFilterDecision => ({
      id: verdict,
      date: TODAY,
      idea: verdict,
      verdict,
      rationale: "",
      nextAction: "",
      macroGoalId: null,
      planId: null,
    });
    const all = [d("executar"), d("testar"), d("estacionar")];
    assert.equal(filterDecisions(all, "todas").length, 3);
    assert.deepEqual(
      filterDecisions(all, "testar").map((x) => x.id),
      ["testar"],
    );
  });
});
