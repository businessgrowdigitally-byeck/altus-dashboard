import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDayPlanProposal,
  dayItems,
  moveItem,
  normalizeDayPlans,
  plannedOn,
  postponeAction,
  resetDay,
  toggleExtra,
  type DayPlans,
} from "../src/lib/day-plan.ts";
import { actionStreak, weekProgress } from "../src/lib/daily-stats.ts";

// 2026-11-06 é uma sexta-feira.
const TODAY = "2026-11-06";
const TOMORROW = "2026-11-07";
const all = [0, 1, 2, 3, 4, 5, 6];
const a = (id: string, suggestedTime?: string, extra: object = {}) => ({
  id,
  name: id,
  area: "Geral" as const,
  daysOfWeek: all,
  suggestedTime,
  ...extra,
});
const routine = [
  a("ingles", "20:00", { durationMinutes: 45 }),
  a("treino", "07:00"),
  a("leitura", "22:00"),
];
const keys = (plans: DayPlans, date = TODAY) => dayItems(routine, plans, date).map((i) => i.key);

describe("plano do dia", () => {
  it("without a plan, the day follows the routine ordered by time", () => {
    assert.deepEqual(keys({}), ["treino", "ingles", "leitura"]);
    assert.equal((dayItems(routine, {}, TODAY)[1] as { minutes: number }).minutes, 45);
  });

  it("reorders only this day", () => {
    const plans = moveItem({}, TODAY, keys({}), "ingles", -1);
    assert.deepEqual(keys(plans), ["ingles", "treino", "leitura"]);
    assert.deepEqual(
      keys(plans, TOMORROW),
      ["treino", "ingles", "leitura"],
      "tomorrow is the routine again",
    );
    assert.equal(plans[TODAY].source, "manual");
  });

  it("postponing moves the action out of today and into the target day", () => {
    const plans = postponeAction({}, TODAY, "leitura", TOMORROW, "sem tempo");
    assert.deepEqual(keys(plans), ["treino", "ingles"]);
    assert.ok(!plannedOn(routine[2], TODAY, plans));
    // Amanhã a leitura já é da rotina; numa ação de seg–sex, sábado ganha a ação trazida.
    const weekdays = [a("relatorio", "09:00", { daysOfWeek: [1, 2, 3, 4, 5] })];
    const p2 = postponeAction({}, TODAY, "relatorio", TOMORROW);
    const tomorrow = dayItems(weekdays, p2, TOMORROW);
    assert.deepEqual(
      tomorrow.map((i) => i.key),
      ["relatorio"],
    );
    assert.equal(tomorrow[0].kind === "action" && tomorrow[0].from, TODAY);
  });

  it("a postponed action does not count as missed nor break the streak", () => {
    const comps = ["2026-11-03", "2026-11-04", "2026-11-05"].map((date) => ({
      date,
      actionId: "ingles",
    }));
    const plansYesterday = postponeAction({}, "2026-11-02", "ingles", "2026-11-09"); // adiou segunda
    // Sem plano, segunda (02/11) sem conclusão quebraria em 3; com o adiamento, a sequência pula esse dia.
    const comps2 = [...comps, { date: "2026-11-01", actionId: "ingles" }];
    assert.equal(actionStreak(routine[0], comps2, TODAY), 3);
    assert.equal(actionStreak(routine[0], comps2, TODAY, plansYesterday), 4);
    assert.deepEqual(weekProgress(routine[0], comps, TODAY), { done: 3, scheduled: 7 });
    assert.deepEqual(weekProgress(routine[0], comps, TODAY, plansYesterday), {
      done: 3,
      scheduled: 6,
    });
  });

  it("reset brings the routine back for the day", () => {
    const plans = postponeAction(
      moveItem({}, TODAY, keys({}), "leitura", -1),
      TODAY,
      "treino",
      TOMORROW,
    );
    assert.deepEqual(keys(resetDay(plans, TODAY)), ["treino", "ingles", "leitura"]);
  });

  it("normalizes stored plans and drops bad or old data", () => {
    const out = normalizeDayPlans(
      {
        [TODAY]: {
          order: ["x"],
          durations: { ingles: 10, bad: 9999 },
          postponed: [{ actionId: "y", to: "nope" }],
          extras: [{ title: "" }, { title: "Revisar" }],
        },
        "2026-01-01": { order: ["old"] },
        nope: {},
      },
      TODAY,
    );
    assert.deepEqual(Object.keys(out), [TODAY]);
    assert.deepEqual(out[TODAY].durations, { ingles: 10 });
    assert.equal(out[TODAY].postponed.length, 0);
    assert.equal(out[TODAY].extras.length, 1);
    assert.equal(out[TODAY].extras[0].done, false);
  });
});

describe("proposta do Mentor para hoje", () => {
  const proposal = {
    reason: "Prova de inglês na próxima semana",
    order: ["ingles", "extra:0", "treino"],
    adjust: [
      { actionId: "treino", durationMinutes: 20, note: "versão mínima" },
      { actionId: "inventada", durationMinutes: 5 },
    ],
    postpone: [
      { actionId: "leitura", to: TOMORROW, reason: "foco na prova" },
      { actionId: "treino", to: "2026-01-01" },
      { actionId: "ingles", to: "2027-01-01" },
    ],
    extras: [{ title: "Simulado de listening", minutes: 40 }],
  };

  it("applies order, durations, extras and valid postponements only", () => {
    const r = applyDayPlanProposal({}, routine, proposal, TODAY);
    assert.equal(r.date, TODAY);
    assert.deepEqual(
      r.items.map((i) => (i.kind === "action" ? i.key : i.extra.title)),
      ["ingles", "Simulado de listening", "treino"],
    );
    const treino = r.items.find((i) => i.key === "treino");
    assert.ok(
      treino &&
        treino.kind === "action" &&
        treino.minutes === 20 &&
        treino.note === "versão mínima",
    );
    assert.deepEqual(
      r.postponed.map((p) => [p.action.id, p.to]),
      [["leitura", TOMORROW]],
    );
    assert.equal(r.plans[TODAY].source, "mentor");
    assert.equal(r.reason, "Prova de inglês na próxima semana");
  });

  it("extras can be checked off", () => {
    const r = applyDayPlanProposal({}, routine, proposal, TODAY);
    const id = r.plans[TODAY].extras[0].id;
    assert.equal(toggleExtra(r.plans, TODAY, id)[TODAY].extras[0].done, true);
  });
});

describe("Mentor: contexto e proposta do plano do dia", async () => {
  const { buildMentorContext } = await import("../src/lib/ai/context.ts");
  const { parsePlanProposal } = await import("../src/lib/ai/plan.ts");

  it("the context lists today's items with ids, minutes, week and streak, and the current plan", () => {
    const plans = postponeAction({}, TODAY, "leitura", TOMORROW, "prova");
    const ctx = buildMentorContext(
      {
        goalsDaily: routine,
        completions: [{ date: "2026-11-05", actionId: "treino" }],
        dayPlans: plans,
      },
      TODAY,
    );
    assert.equal(ctx.hoje.data, TODAY);
    assert.equal(ctx.hoje.dia_da_semana, "sexta");
    assert.deepEqual(
      ctx.hoje.itens.map((i) => ("id" in i ? i.id : i.extra)),
      ["treino", "ingles"],
    );
    const ingles = ctx.hoje.itens.find((i) => "id" in i && i.id === "ingles");
    assert.ok(ingles && "minutos" in ingles && ingles.minutos === 45);
    const treino = ctx.hoje.itens.find((i) => "id" in i && i.id === "treino");
    assert.ok(treino && "sequencia_dias" in treino && treino.sequencia_dias === 1);
    assert.deepEqual(ctx.hoje.plano_do_dia?.adiadas, [
      { id: "leitura", para: TOMORROW, motivo: "prova" },
    ]);
    assert.equal(ctx.rotina.acoes[0].id, "ingles");
  });

  it("a proposal with only a dayPlan is accepted", () => {
    const block =
      "```altus-plan\n" + JSON.stringify({ dayPlan: { order: ["ingles"], reason: "x" } }) + "\n```";
    assert.ok(parsePlanProposal(block));
  });
});
