import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  balanceUntil,
  budgetLines,
  dailyBalanceSeries,
  defaultStartMonth,
  dueRecurring,
  filterTransactions,
  monthTotals,
  monthlySeries,
  normalizeBudgets,
  normalizeRecurring,
  pctChange,
  recurringDate,
  type FinTx,
  type RecurringTransaction,
} from "../src/lib/finance.ts";

let n = 0;
const tx = (
  type: FinTx["type"],
  value: number,
  date: string,
  category = "Outros",
  description = "x",
): FinTx => ({
  id: `t${n++}`,
  type,
  value,
  date,
  category,
  description,
});

const history = [
  tx("entrada", 5000, "2026-10-05", "Salário", "Salário outubro"),
  tx("saida", 1500, "2026-10-10", "Moradia", "Aluguel"),
  tx("saida", 500, "2026-10-20", "Alimentação", "Mercado"),
  tx("entrada", 5000, "2026-11-05", "Salário", "Salário novembro"),
  tx("saida", 300, "2026-11-06", "Alimentação", "Feira"),
];

describe("saldo acumulado vs. resultado do mês", () => {
  it("the month result resets every month, the accumulated balance does not", () => {
    // Primeiro dia de dezembro, sem lançamentos ainda: resultado 0, saldo preservado.
    assert.equal(monthTotals(history, "2026-12").net, 0);
    assert.equal(balanceUntil(history, 0, "2026-12-01"), 7700);
  });

  it("adds the opening balance", () => {
    assert.equal(balanceUntil(history, 1000, "2026-10-31"), 1000 + 3000);
    assert.equal(balanceUntil(history, 1000, "2026-11-30"), 1000 + 7700);
    assert.equal(balanceUntil([], 1000, "2026-11-30"), 1000);
  });

  it("ignores transactions after the date (future-dated entries)", () => {
    assert.equal(balanceUntil(history, 0, "2026-11-05"), 8000);
  });

  it("monthly totals and categories", () => {
    const oct = monthTotals(history, "2026-10");
    assert.deepEqual([oct.income, oct.expense, oct.net, oct.count], [5000, 2000, 3000, 3]);
    assert.deepEqual(oct.byCategory, { Moradia: 1500, Alimentação: 500 });
  });

  it("monthly series ends at the chosen month with the running balance", () => {
    const s = monthlySeries(history, 200, "2026-12", 3);
    assert.deepEqual(
      s.map((m) => [m.month, m.net, m.balance]),
      [
        ["2026-10", 3000, 3200],
        ["2026-11", 4700, 7900],
        ["2026-12", 0, 7900],
      ],
    );
  });

  it("daily series starts at the real balance, not at zero", () => {
    const s = dailyBalanceSeries(history, 0, ["2026-11-04", "2026-11-05"]);
    assert.deepEqual(
      s.map((d) => d.balance),
      [3000, 8000],
    );
  });

  it("percent change is null without a base", () => {
    assert.equal(pctChange(150, 100), 50);
    assert.equal(pctChange(50, -100), 150);
    assert.equal(pctChange(10, 0), null);
  });
});

describe("helpers de mês", () => {
  it("adds months across years and clamps the recurring day", () => {
    assert.equal(addMonths("2026-12", 1), "2027-01");
    assert.equal(addMonths("2026-01", -1), "2025-12");
    assert.equal(recurringDate({ dayOfMonth: 31 }, "2027-02"), "2027-02-28");
    assert.equal(recurringDate({ dayOfMonth: 31 }, "2028-02"), "2028-02-29");
  });

  it("a new rule starts this month only if its day has not passed", () => {
    assert.equal(defaultStartMonth(10, "2026-11-04"), "2026-11");
    assert.equal(defaultStartMonth(1, "2026-11-04"), "2026-12");
  });
});

describe("orçamento por categoria", () => {
  it("shows spending against the limit, budgeted categories first", () => {
    const lines = budgetLines({ Alimentação: 900, Lazer: 50 }, { Alimentação: 800, Moradia: 1500 });
    assert.deepEqual(
      lines.map((l) => [l.category, l.spent, l.limit, l.over]),
      [
        ["Alimentação", 900, 800, true],
        ["Moradia", 0, 1500, false],
        ["Lazer", 50, null, false],
      ],
    );
  });
});

describe("busca e filtro", () => {
  it("matches description or category, ignoring accents and case", () => {
    const all = { query: "", type: "todas" as const, category: "" };
    assert.equal(filterTransactions(history, { ...all, query: "salario" }).length, 2);
    assert.equal(filterTransactions(history, { ...all, query: "ALIMENTA" }).length, 2);
    assert.equal(filterTransactions(history, { ...all, type: "saida" }).length, 3);
    assert.equal(filterTransactions(history, { ...all, category: "Moradia" }).length, 1);
  });
});

describe("lançamentos recorrentes", () => {
  const rule: RecurringTransaction = {
    id: "sal",
    type: "entrada",
    value: 5000,
    description: "Salário",
    category: "Salário",
    dayOfMonth: 5,
    startMonth: "2026-09",
    active: true,
  };

  it("posts every due month once, with deterministic ids", () => {
    const r = dueRecurring([rule], [], "2026-11-04");
    assert.deepEqual(
      r.transactions.map((t) => [t.id, t.date]),
      [
        ["rec-sal-2026-09", "2026-09-05"],
        ["rec-sal-2026-10", "2026-10-05"],
      ],
      "November's is not due yet",
    );
    assert.equal(r.rules[0].lastPostedMonth, "2026-10");
    assert.equal(r.transactions[0].recurringId, "sal");
  });

  it("is idempotent and does not bring back a deleted entry", () => {
    const first = dueRecurring([rule], [], "2026-11-04");
    const again = dueRecurring(first.rules, first.transactions, "2026-11-04");
    assert.equal(again.transactions.length, 0);
    // O usuário apagou o de outubro: não volta.
    const deleted = dueRecurring(first.rules, [first.transactions[0]], "2026-11-04");
    assert.equal(deleted.transactions.length, 0);
    // No dia 5 de novembro, só o novo mês é lançado.
    const nov = dueRecurring(first.rules, first.transactions, "2026-11-05");
    assert.deepEqual(
      nov.transactions.map((t) => t.id),
      ["rec-sal-2026-11"],
    );
  });

  it("does not duplicate an id that already exists (other device)", () => {
    const r = dueRecurring(
      [rule],
      [{ ...tx("entrada", 5000, "2026-09-05"), id: "rec-sal-2026-09" }],
      "2026-10-01",
    );
    assert.equal(r.transactions.length, 0);
    assert.equal(r.rules[0].lastPostedMonth, "2026-09");
  });

  it("respects end month, paused rules and invalid values", () => {
    assert.equal(
      dueRecurring([{ ...rule, endMonth: "2026-09" }], [], "2026-11-30").transactions.length,
      1,
    );
    assert.equal(
      dueRecurring([{ ...rule, active: false }], [], "2026-11-30").transactions.length,
      0,
    );
    assert.equal(dueRecurring([{ ...rule, value: 0 }], [], "2026-11-30").transactions.length, 0);
  });

  it("normalizes stored rules and budgets, dropping malformed data", () => {
    const rules = normalizeRecurring([
      rule,
      { id: "x" },
      null,
      { ...rule, id: "b", dayOfMonth: 99, type: "saida" },
    ]);
    assert.deepEqual(
      rules.map((r) => [r.id, r.dayOfMonth]),
      [
        ["sal", 5],
        ["b", 31],
      ],
    );
    assert.deepEqual(normalizeBudgets({ A: 100, B: -1, C: "x", D: "50" }), { A: 100, D: 50 });
    assert.deepEqual(normalizeBudgets([1]), {});
  });
});

describe("contexto do Mentor (finanças)", async () => {
  const { buildMentorContext } = await import("../src/lib/ai/context.ts");
  it("reports the accumulated balance, the month result and whether the opening balance is set", () => {
    const ctx = buildMentorContext(
      {
        profile: { openingBalance: 1000 },
        transactions: history,
        categoryBudgets: { Alimentação: 800, bad: -5 },
        recurringTransactions: [
          {
            id: "r",
            type: "entrada",
            value: 5000,
            description: "Salário",
            category: "Salário",
            dayOfMonth: 5,
            startMonth: "2026-09",
            active: true,
          },
        ],
      },
      "2026-12-01",
    );
    assert.equal(ctx.financas.saldo_acumulado_hoje, 8700);
    assert.equal(ctx.financas.saldo_inicial_informado, true);
    assert.equal(ctx.financas.ultimos_3_meses[0].resultado_do_mes, 0);
    assert.deepEqual(ctx.financas.orcamento_mensal_por_categoria, { Alimentação: 800 });
    assert.equal(ctx.financas.recorrentes[0].dia, 5);
    const none = buildMentorContext({ transactions: history }, "2026-12-01");
    assert.equal(none.financas.saldo_inicial, null);
    assert.equal(none.financas.saldo_acumulado_hoje, 7700);
  });
});
