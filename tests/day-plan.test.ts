import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDayPlanProposal,
  applyRoutineChanges,
  applyWeekPlanProposal,
  cleanRoutineChanges,
  dayItems,
  keepDayDurations,
  moveItem,
  normalizeDayPlans,
  plannedOn,
  postponeAction,
  resetDay,
  toggleExtra,
  weekdayDate,
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

describe("plano da semana", () => {
  const D = (n: number) => {
    const [y, m, d] = TODAY.split("-").map(Number);
    const x = new Date(y, m - 1, d + n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };

  it("weekdayDate gives the next date (today included) for a weekday", () => {
    assert.equal(weekdayDate(TODAY, 5), TODAY); // sexta
    assert.equal(weekdayDate(TODAY, 6), TOMORROW);
    assert.equal(weekdayDate(TODAY, 4), D(6)); // quinta que vem
  });

  it("plans several days at once, growing study blocks; ignores dates outside the week and repeats", () => {
    const r = applyWeekPlanProposal(
      {},
      routine,
      [
        { date: D(2), adjust: [{ actionId: "ingles", durationMinutes: 60 }], reason: "prova" },
        { date: TODAY, adjust: [{ actionId: "ingles", durationMinutes: 50 }] },
        { date: D(2), adjust: [{ actionId: "ingles", durationMinutes: 999 }] },
        { date: D(7), adjust: [{ actionId: "ingles", durationMinutes: 90 }] },
        { date: D(-1), order: ["leitura"] },
        { date: "amanhã" },
      ],
      TODAY,
    );
    assert.deepEqual(
      r.days.map((d) => d.date),
      [TODAY, D(2)],
      "sorted, inside today…today+6, first entry per date",
    );
    const mins = (date: string) =>
      (r.plans[date] && dayItems(routine, r.plans, date).find((i) => i.key === "ingles")) as
        | { minutes: number }
        | undefined;
    assert.equal(mins(TODAY)?.minutes, 50);
    assert.equal(mins(D(2))?.minutes, 60);
    assert.equal(r.plans[D(7)], undefined);
    assert.equal(r.plans[D(2)].reason, "prova");
  });

  it("previews postponements between days of the same proposal", () => {
    const r = applyWeekPlanProposal(
      {},
      routine,
      [
        { date: TODAY, postpone: [{ actionId: "leitura", to: D(1) }] },
        { date: D(1), order: ["leitura", "ingles"] },
      ],
      TODAY,
    );
    assert.deepEqual(
      r.days[0].items.map((i) => i.key),
      ["treino", "ingles"],
    );
    const tomorrow = r.days[1].items.map((i) => i.key);
    assert.deepEqual(tomorrow.slice(0, 2), ["leitura", "ingles"]);
    assert.equal(
      dayItems(routine, r.plans, D(1)).filter((i) => i.key === "leitura").length,
      1,
      "no duplicate when the action is on the routine that day too",
    );
  });
});

describe("mudança na rotina fixa", () => {
  it("validates routine changes: known ids, 5-min steps, time and days; skips no-ops", () => {
    const changes = cleanRoutineChanges(routine, [
      { actionId: "ingles", durationMinutes: 32, reason: "sempre faço 30" },
      { actionId: "treino", suggestedTime: "06:30", daysOfWeek: [5, 1, 1, 3, 9] },
      { actionId: "leitura", durationMinutes: 30 }, // já é 30 (padrão): não muda nada
      { actionId: "inventada", durationMinutes: 20 },
      { actionId: "ingles", durationMinutes: 10 }, // repetida: vale a primeira
    ]);
    assert.deepEqual(
      changes.map((c) => [c.action.id, c.patch]),
      [
        ["ingles", { durationMinutes: 30 }],
        ["treino", { suggestedTime: "06:30", daysOfWeek: [1, 3, 5] }],
      ],
    );
    assert.equal(changes[0].reason, "sempre faço 30");
  });

  it("rejects a schedule that crosses midnight and invalid times", () => {
    assert.deepEqual(
      cleanRoutineChanges(routine, [
        { actionId: "leitura", durationMinutes: 180 }, // 22:00 + 3h passa da meia-noite
        { actionId: "treino", suggestedTime: "25:00" },
        { actionId: "treino", daysOfWeek: [] },
      ]),
      [],
    );
  });

  it("applies changes; an empty time removes the time", () => {
    const changes = cleanRoutineChanges(routine, [
      { actionId: "treino", suggestedTime: "", durationMinutes: 40 },
    ]);
    const next = applyRoutineChanges(routine, changes);
    const treino = next.find((x) => x.id === "treino")!;
    assert.equal(treino.durationMinutes, 40);
    assert.equal("suggestedTime" in treino, false);
    assert.equal(
      next.find((x) => x.id === "ingles"),
      routine[0],
      "others untouched",
    );
  });

  it("keepDayDurations turns the day's durations into the routine and clears them from the plan", () => {
    const r = applyDayPlanProposal(
      {},
      routine,
      {
        order: ["ingles", "treino"],
        adjust: [
          { actionId: "ingles", durationMinutes: 25, note: "só revisão" },
          { actionId: "treino", durationMinutes: 30 },
        ],
      },
      TODAY,
    );
    const k = keepDayDurations(r.plans, routine, TODAY);
    assert.deepEqual(
      k.changes.map((c) => [c.action.id, c.patch.durationMinutes]),
      [["ingles", 25]],
      "treino já tinha 30 (padrão)",
    );
    assert.deepEqual(k.plans[TODAY].durations, {});
    assert.deepEqual(k.plans[TODAY].order, ["ingles", "treino"], "order and notes stay");
    assert.equal(k.plans[TODAY].notes.ingles, "só revisão");
    assert.deepEqual(keepDayDurations({}, routine, TODAY).changes, []);
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

  it("the context lists the next 6 days and repeated adjustments of the last 14 days", () => {
    let plans: DayPlans = {};
    for (const date of ["2026-11-02", "2026-11-04", TODAY])
      plans = applyDayPlanProposal(
        plans,
        routine,
        { adjust: [{ actionId: "ingles", durationMinutes: 30 }] },
        TODAY,
        date,
      ).plans;
    plans = applyDayPlanProposal(
      plans,
      routine,
      { adjust: [{ actionId: "treino", durationMinutes: 10 }] },
      TODAY,
      "2026-11-03",
    ).plans;
    plans = applyDayPlanProposal(
      plans,
      routine,
      { reason: "prova", adjust: [{ actionId: "ingles", durationMinutes: 60 }] },
      TODAY,
      TOMORROW,
    ).plans;
    const ctx = buildMentorContext({ goalsDaily: routine, dayPlans: plans }, TODAY);
    assert.equal(ctx.proximos_dias.length, 6);
    assert.equal(ctx.proximos_dias[0].data, TOMORROW);
    assert.equal(ctx.proximos_dias[0].dia_da_semana, "sábado");
    assert.equal(ctx.proximos_dias[0].motivo, "prova");
    const ing = ctx.proximos_dias[0].itens.find((i) => "id" in i && i.id === "ingles");
    assert.ok(ing && ing.minutos === 60);
    assert.equal(ctx.proximos_dias[1].ajustado, null);
    assert.deepEqual(ctx.ajustes_recentes, [
      {
        id: "ingles",
        nome: "ingles",
        minutos_rotina: 45,
        dias_com_duracao_ajustada: 3,
        duracao_mais_usada: 30,
        vezes_adiada: 0,
      },
    ]);
  });

  it("week plans and routine changes alone are accepted proposals", () => {
    const wrap = (x: object) => "```altus-plan\n" + JSON.stringify(x) + "\n```";
    assert.ok(parsePlanProposal(wrap({ weekPlan: { days: [{ date: TODAY }] } })));
    assert.ok(parsePlanProposal(wrap({ routineChanges: [{ actionId: "ingles" }] })));
    assert.equal(parsePlanProposal(wrap({ weekPlan: { days: [] } })), null);
  });

  it("a proposal with only a dayPlan is accepted", () => {
    const block =
      "```altus-plan\n" + JSON.stringify({ dayPlan: { order: ["ingles"], reason: "x" } }) + "\n```";
    assert.ok(parsePlanProposal(block));
  });
});
