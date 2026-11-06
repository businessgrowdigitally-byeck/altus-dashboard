import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, kaizenForToday } from "../src/lib/insights.ts";
import { postponeAction } from "../src/lib/day-plan.ts";

// 2026-11-06 é uma sexta-feira.
const TODAY = "2026-11-06";
const all = [0, 1, 2, 3, 4, 5, 6];
const fmt = { money: (n: number) => `R$ ${n}`, kg: (n: number) => `${n.toFixed(1)} kg` };
const day = (n: number) => {
  const d = new Date(2026, 10, 6 + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ids = (x: ReturnType<typeof buildInsights>) => x.map((i) => i.id);

describe("insights da semana", () => {
  it("with no data there are no insights (the Home shows the fallback)", () => {
    assert.deepEqual(buildInsights({}, TODAY, fmt), []);
  });

  it("spending says what it is about and shows both amounts", () => {
    const r = buildInsights(
      {
        transactions: [
          { type: "saida", value: 46, date: day(-1), category: "Mercado" },
          { type: "saida", value: 100, date: day(-8), category: "Mercado" },
          { type: "entrada", value: 999, date: day(-1), category: "Salário" },
        ],
      },
      TODAY,
      fmt,
    );
    assert.deepEqual(r, [
      {
        id: "expenses",
        key: "insight.expensesLess",
        vars: { diff: 54, week: "R$ 46", prev: "R$ 100" },
        tone: "good",
      },
    ]);
  });

  it("small spending changes (< 5%) are not worth an insight", () => {
    const r = buildInsights(
      {
        transactions: [
          { type: "saida", value: 98, date: day(0), category: "x" },
          { type: "saida", value: 100, date: day(-7), category: "x" },
        ],
      },
      TODAY,
      fmt,
    );
    assert.deepEqual(r, []);
  });

  it("routine over 7 days counts planned vs done; postponing is not a miss", () => {
    const goalsDaily = [
      { id: "ingles", name: "Inglês", area: "Estudos" as const, daysOfWeek: all },
    ];
    const completions = [0, -1, -2, -3, -4].map((n) => ({ date: day(n), actionId: "ingles" }));
    // Dois dias sem fazer, mas um deles foi adiado de propósito.
    const dayPlans = postponeAction({}, day(-5), "ingles", day(-4));
    const r = buildInsights({ goalsDaily, completions, dayPlans }, TODAY, fmt);
    const routine = r.find((i) => i.id === "routine")!;
    assert.deepEqual(routine.vars, { done: 5, planned: 6, pct: 83 });
    assert.equal(routine.tone, "good");
    const streak = r.find((i) => i.id === "streak")!;
    assert.deepEqual(streak.vars, { name: "Inglês", n: 5 });
  });

  it("flags the action that fell behind", () => {
    const goalsDaily = [{ id: "treino", name: "Treinar", area: "Geral" as const, daysOfWeek: all }];
    const r = buildInsights(
      { goalsDaily, completions: [{ date: day(-3), actionId: "treino" }] },
      TODAY,
      fmt,
    );
    const lag = r.find((i) => i.id === "lagging")!;
    assert.deepEqual(lag.vars, { name: "Treinar", done: 1, scheduled: 7 });
    assert.equal(r.find((i) => i.id === "routine")!.tone, "warn");
  });

  it("yesterday's Kaizen comes first; older or empty answers are ignored", () => {
    const kaizen = [
      { date: day(-1), improveTomorrow: "  BGD Finance as the resource to make money " },
      { date: day(-5), improveTomorrow: "antigo" },
      { date: TODAY, improveTomorrow: "de hoje (vale amanhã)" },
    ];
    assert.deepEqual(kaizenForToday(kaizen, TODAY), {
      date: day(-1),
      text: "BGD Finance as the resource to make money",
    });
    assert.equal(kaizenForToday([{ date: day(-1), improveTomorrow: " " }], TODAY), null);
    assert.equal(kaizenForToday([{ date: day(-3), improveTomorrow: "x" }], TODAY), null);
    const r = buildInsights({ kaizen }, TODAY, fmt);
    assert.equal(r[0].key, "insight.kaizen");
  });

  it("P.E.: overdue review and the next Micro Goal of the active stage", () => {
    const r = buildInsights(
      {
        altusPlans: [
          {
            macroGoalName: "Juntar R$ 10 mil",
            activeStageId: "s2",
            nextReview: day(-1),
            microGoals: [
              { id: "m1", title: "Primeira", stageId: "s1", status: "pendente" },
              { id: "m2", title: "Da etapa ativa", stageId: "s2", status: "pendente" },
            ],
          },
        ],
      },
      TODAY,
      fmt,
    );
    assert.deepEqual(ids(r), ["review:Juntar R$ 10 mil", "micro"]);
    assert.equal(r[1].vars.title, "Da etapa ativa");
  });

  it("budget over the limit this month", () => {
    const r = buildInsights(
      {
        transactions: [{ type: "saida", value: 600, date: "2026-11-02", category: "Lazer" }],
        categoryBudgets: { Lazer: 500, Mercado: 800 },
      },
      TODAY,
      fmt,
    );
    assert.deepEqual(r.find((i) => i.id === "budget")?.vars, {
      category: "Lazer",
      spent: "R$ 600",
      limit: "R$ 500",
    });
  });

  it("weight, books and study streak; at most 6 insights", () => {
    const r = buildInsights(
      {
        weights: [
          { weight: 80, date: "2026-10-01" },
          { weight: 78.5, date: "2026-11-01" },
        ],
        books: [{ finishedAt: "2026-03-01" }, { finishedAt: "2025-03-01" }],
        studies: [{ date: day(0) }, { date: day(-1) }],
      },
      TODAY,
      fmt,
    );
    assert.deepEqual(
      r.map((i) => [i.key, i.vars]),
      [
        ["insight.weightDown", { kg: "1.5 kg" }],
        ["booksOne", { count: 1, year: "2026" }],
        ["streakMany", { n: 2 }],
      ],
    );
  });
});
