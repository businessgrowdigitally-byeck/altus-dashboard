/**
 * Cálculos financeiros do ALTUS, sem React, para a tela de Finanças, o
 * Dashboard, as metas vinculadas e o contexto do Mentor usarem os mesmos números.
 *
 * Dois conceitos que não podem ser confundidos:
 * - Resultado do mês: entradas − saídas DAQUELE mês (zera a cada mês, por definição).
 * - Saldo acumulado: saldo inicial + todo o histórico até uma data (não zera).
 */

export type FinTx = {
  id: string;
  type: "entrada" | "saida";
  value: number;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
  /** Gerado por um lançamento recorrente. */
  recurringId?: string;
};

export type RecurringTransaction = {
  id: string;
  type: "entrada" | "saida";
  value: number;
  description: string;
  category: string;
  /** Dia do mês (1–31); em meses mais curtos, cai no último dia. */
  dayOfMonth: number;
  /** Primeiro mês (YYYY-MM) em que o lançamento acontece. */
  startMonth: string;
  /** Último mês (YYYY-MM), ou vazio para sem fim. */
  endMonth?: string;
  active: boolean;
  /** Último mês já lançado — evita lançar de novo um mês que o usuário apagou. */
  lastPostedMonth?: string;
};

/** Limite mensal de gastos por categoria. */
export type CategoryBudgets = Record<string, number>;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Teto de meses lançados de uma vez (ex.: app aberto depois de muito tempo). */
const MAX_BACKFILL_MONTHS = 24;

export const isMonthKey = (v: unknown): v is string => typeof v === "string" && MONTH_RE.test(v);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Nome do mês no idioma do app (o `<input type="month">` usa o idioma do navegador). */
export function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const monthEnd = (month: string) =>
  `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

const sum = (tx: FinTx[], type: FinTx["type"]) =>
  tx.reduce((a, t) => (t.type === type ? a + t.value : a), 0);

export type MonthTotals = {
  month: string;
  income: number;
  expense: number;
  net: number;
  byCategory: Record<string, number>;
  count: number;
};

export function monthTotals(tx: FinTx[], month: string): MonthTotals {
  const mt = tx.filter((t) => t.date.startsWith(month));
  const byCategory: Record<string, number> = {};
  for (const t of mt)
    if (t.type === "saida") byCategory[t.category] = (byCategory[t.category] ?? 0) + t.value;
  const income = sum(mt, "entrada");
  const expense = sum(mt, "saida");
  return { month, income, expense, net: income - expense, byCategory, count: mt.length };
}

/** Saldo inicial + entradas − saídas com data até `until` (inclusive). */
export function balanceUntil(tx: FinTx[], openingBalance: number, until: string): number {
  return tx.reduce(
    (a, t) => (t.date <= until ? a + (t.type === "entrada" ? t.value : -t.value) : a),
    Number.isFinite(openingBalance) ? openingBalance : 0,
  );
}

/** Saldo acumulado ao fim de cada mês + resultado do mês, terminando em `endMonth`. */
export function monthlySeries(
  tx: FinTx[],
  openingBalance: number,
  endMonth: string,
  months: number,
) {
  return Array.from({ length: months }, (_, i) => {
    const month = addMonths(endMonth, i - months + 1);
    const totals = monthTotals(tx, month);
    return {
      month,
      income: totals.income,
      expense: totals.expense,
      net: totals.net,
      balance: balanceUntil(tx, openingBalance, monthEnd(month)),
    };
  });
}

/** Saldo acumulado dia a dia nos últimos `days` dias (começa no saldo real, não em zero). */
export function dailyBalanceSeries(tx: FinTx[], openingBalance: number, dates: string[]) {
  return dates.map((date) => ({ date, balance: balanceUntil(tx, openingBalance, date) }));
}

/** Variação percentual; null quando não há base de comparação. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type BudgetLine = {
  category: string;
  spent: number;
  limit: number | null;
  pct: number | null;
  over: boolean;
};

/** Gastos do mês por categoria, com o orçamento quando houver (categorias com limite primeiro). */
export function budgetLines(
  byCategory: Record<string, number>,
  budgets: CategoryBudgets,
): BudgetLine[] {
  const cats = new Set([
    ...Object.keys(byCategory),
    ...Object.keys(budgets).filter((c) => budgets[c] > 0),
  ]);
  return [...cats]
    .map((category) => {
      const spent = byCategory[category] ?? 0;
      const limit = budgets[category] > 0 ? budgets[category] : null;
      return {
        category,
        spent,
        limit,
        pct: limit ? (spent / limit) * 100 : null,
        over: limit !== null && spent > limit,
      };
    })
    .sort((a, b) => Number(b.limit !== null) - Number(a.limit !== null) || b.spent - a.spent);
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type TxFilter = { query: string; type: "todas" | FinTx["type"]; category: string };

export function filterTransactions(tx: FinTx[], f: TxFilter): FinTx[] {
  const q = fold(f.query.trim());
  return tx.filter(
    (t) =>
      (f.type === "todas" || t.type === f.type) &&
      (!f.category || t.category === f.category) &&
      (!q || fold(t.description).includes(q) || fold(t.category).includes(q)),
  );
}

/** Data em que a regra lança no mês (dia ajustado ao tamanho do mês). */
export function recurringDate(
  rule: Pick<RecurringTransaction, "dayOfMonth">,
  month: string,
): string {
  const day = Math.min(Math.max(1, Math.round(rule.dayOfMonth) || 1), daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Primeiro mês em que uma regra nova lançaria: este mês se o dia ainda não passou, senão o próximo. */
export function defaultStartMonth(dayOfMonth: number, today: string): string {
  const month = today.slice(0, 7);
  return recurringDate({ dayOfMonth }, month) >= today ? month : addMonths(month, 1);
}

/**
 * Lançamentos recorrentes que já venceram e ainda não foram lançados.
 * Idempotente: o id é determinístico (regra + mês) e `lastPostedMonth` avança,
 * então rodar de novo — ou em outro aparelho — não duplica, e um lançamento
 * apagado pelo usuário não volta.
 */
export function dueRecurring(
  rules: RecurringTransaction[],
  existing: FinTx[],
  today: string,
): { transactions: FinTx[]; rules: RecurringTransaction[] } {
  const ids = new Set(existing.map((t) => t.id));
  const currentMonth = today.slice(0, 7);
  const created: FinTx[] = [];
  const next = rules.map((rule) => {
    if (!rule.active || !isMonthKey(rule.startMonth) || !(rule.value > 0)) return rule;
    let month =
      rule.lastPostedMonth && isMonthKey(rule.lastPostedMonth)
        ? addMonths(rule.lastPostedMonth, 1)
        : rule.startMonth;
    if (month < rule.startMonth) month = rule.startMonth;
    let last = rule.lastPostedMonth;
    for (
      let i = 0;
      i < MAX_BACKFILL_MONTHS && month <= currentMonth;
      i++, month = addMonths(month, 1)
    ) {
      if (rule.endMonth && isMonthKey(rule.endMonth) && month > rule.endMonth) break;
      const date = recurringDate(rule, month);
      if (date > today) break;
      const id = `rec-${rule.id}-${month}`;
      if (!ids.has(id)) {
        created.push({
          id,
          type: rule.type,
          value: rule.value,
          description: rule.description,
          category: rule.category,
          date,
          recurringId: rule.id,
        });
        ids.add(id);
      }
      last = month;
    }
    return last === rule.lastPostedMonth ? rule : { ...rule, lastPostedMonth: last };
  });
  return { transactions: created, rules: next };
}

/** Valida regras e orçamentos vindos da nuvem/importação (dados malformados são descartados). */
export function normalizeRecurring(raw: unknown): RecurringTransaction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): RecurringTransaction | null => {
      if (!r || typeof r !== "object") return null;
      const x = r as Record<string, unknown>;
      const value = Number(x.value);
      if (typeof x.id !== "string" || !x.id || !(value > 0) || !isMonthKey(x.startMonth))
        return null;
      if (x.type !== "entrada" && x.type !== "saida") return null;
      return {
        id: x.id.slice(0, 80),
        type: x.type,
        value,
        description: String(x.description ?? "").slice(0, 200),
        category: String(x.category ?? "Outros").slice(0, 60),
        dayOfMonth: Math.min(31, Math.max(1, Math.round(Number(x.dayOfMonth)) || 1)),
        startMonth: x.startMonth,
        endMonth: isMonthKey(x.endMonth) ? x.endMonth : undefined,
        active: x.active !== false,
        lastPostedMonth: isMonthKey(x.lastPostedMonth) ? x.lastPostedMonth : undefined,
      };
    })
    .filter((r): r is RecurringTransaction => r !== null)
    .slice(0, 100);
}

export function normalizeBudgets(raw: unknown): CategoryBudgets {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CategoryBudgets = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 100)) {
    const n = Number(v);
    if (k && Number.isFinite(n) && n > 0) out[k.slice(0, 60)] = n;
  }
  return out;
}

export const isISODate = (v: unknown): v is string => typeof v === "string" && DATE_RE.test(v);
