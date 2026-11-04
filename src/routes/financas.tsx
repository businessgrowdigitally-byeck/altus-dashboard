import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore, type RecurringTransaction } from "@/lib/store";
import { brl, CATEGORIES, fmtDate } from "@/lib/format";
import { GlassCard, KpiCard, PageHeader, Section } from "@/components/primitives";
import { TaxonomySelect, taxLabel } from "@/components/TaxonomySelect";
import { MonthPicker } from "@/components/MonthPicker";
import { useI18n } from "@/lib/i18n";
import { useToday } from "@/hooks/use-today";
import {
  addMonths,
  balanceUntil,
  budgetLines,
  defaultStartMonth,
  filterTransactions,
  monthEnd,
  monthLabel,
  monthTotals,
  monthlySeries,
  pctChange,
  recurringDate,
  type TxFilter,
} from "@/lib/finance";
import { Pause, Pencil, Play, Repeat, Search, Trash2 } from "lucide-react";
import { Modal, ConfirmButton, inpCls, btnGold } from "@/components/Modal";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/financas")({ component: Financas });

const COLORS = ["#F5C842", "#2ECC71", "#E74C3C", "#3498DB", "#9B59B6", "#1ABC9C", "#95A5A6"];

type T = (key: string, vars?: Record<string, string | number>) => string;

const pctText = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;

function Financas() {
  const { t, locale } = useI18n();
  const {
    transactions,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addCustomItem,
    customTaxonomy,
    profile,
    categoryBudgets,
    recurringTransactions,
    postDueRecurring,
  } = useStore();
  const today = useToday();
  const currentMonth = today.slice(0, 7);
  // null = acompanha o mês atual (inclusive na virada do mês com o app aberto).
  const [picked, setPicked] = useState<string | null>(null);
  const monthSel = picked ?? currentMonth;
  const [editing, setEditing] = useState<null | (typeof transactions)[number]>(null);
  const [filter, setFilter] = useState<TxFilter>({ query: "", type: "todas", category: "" });

  // Recorrentes vencidos (ex.: virou o dia com o app aberto).
  useEffect(() => {
    const n = postDueRecurring(today);
    if (n > 0) toast.success(t("financas.recurringPosted", { n }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const [form, setForm] = useState({
    type: "saida" as "entrada" | "saida",
    value: "",
    description: "",
    category: "Alimentação",
    date: today,
  });

  const opening = profile.openingBalance ?? 0;
  const cur = useMemo(() => monthTotals(transactions, monthSel), [transactions, monthSel]);
  const prev = useMemo(
    () => monthTotals(transactions, addMonths(monthSel, -1)),
    [transactions, monthSel],
  );
  // Mês atual: saldo até hoje. Outros meses: saldo no fim do mês.
  const balanceDate = monthSel === currentMonth ? today : monthEnd(monthSel);
  const balance = balanceUntil(transactions, opening, balanceDate);

  const byCategory = useMemo(
    () => Object.entries(cur.byCategory).map(([name, value]) => ({ name, value })),
    [cur],
  );
  const budgets = useMemo(
    () => budgetLines(cur.byCategory, categoryBudgets),
    [cur, categoryBudgets],
  );
  const series = useMemo(
    () => monthlySeries(transactions, opening, monthSel, 12),
    [transactions, opening, monthSel],
  );
  const monthTx = useMemo(
    () =>
      transactions
        .filter((x) => x.date.startsWith(monthSel))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, monthSel],
  );
  const shownTx = useMemo(() => filterTransactions(monthTx, filter), [monthTx, filter]);
  const monthCategories = useMemo(() => [...new Set(monthTx.map((x) => x.category))], [monthTx]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(form.value.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error(t("financas.toastValue"));
      return;
    }
    if (!form.description.trim()) {
      toast.error(t("financas.toastDescribe"));
      return;
    }
    addTransaction({
      type: form.type,
      value: v,
      description: form.description,
      category: form.category,
      date: form.date,
    });
    setForm({ ...form, value: "", description: "" });
  };

  const vsPrev = (current: number, previous: number) => {
    const p = pctChange(current, previous);
    return p === null ? t("financas.noPrev") : t("financas.vsPrev", { pct: pctText(p) });
  };
  const incomePct = profile.incomeTarget > 0 ? (cur.income / profile.incomeTarget) * 100 : null;
  const capPct = profile.maxExpenses > 0 ? (cur.expense / profile.maxExpenses) * 100 : null;
  const catName = (id: string) => taxLabel(t, "cat.", id);
  const catIcon = (id: string) =>
    CATEGORIES.find((c) => c.id === id)?.icon ||
    customTaxonomy.financeCategories.find((c) => c.id === id)?.icon ||
    "📦";

  return (
    <div>
      <PageHeader
        title={t("financas.title")}
        subtitle={t("financas.subtitle")}
        right={
          <MonthPicker
            value={monthSel}
            current={currentMonth}
            onChange={(m) => setPicked(m === currentMonth ? null : m)}
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label={t("financas.kpiIncome")}
          value={brl(cur.income)}
          icon="📈"
          tone="positive"
          delta={
            <>
              <div>{vsPrev(cur.income, prev.income)}</div>
              {incomePct !== null && (
                <Progress
                  pct={incomePct}
                  tone="positive"
                  label={t("financas.incomeGoal", {
                    pct: incomePct.toFixed(0),
                    target: brl(profile.incomeTarget),
                  })}
                />
              )}
            </>
          }
        />
        <KpiCard
          label={t("financas.kpiExpense")}
          value={brl(cur.expense)}
          icon="📉"
          tone="negative"
          delta={
            <>
              <div>{vsPrev(cur.expense, prev.expense)}</div>
              {capPct !== null && (
                <Progress
                  pct={capPct}
                  tone={capPct > 100 ? "negative" : "gold"}
                  label={
                    t("financas.expenseCap", {
                      pct: capPct.toFixed(0),
                      cap: brl(profile.maxExpenses),
                    }) + (capPct > 100 ? ` · ${t("financas.overCap")}` : "")
                  }
                />
              )}
            </>
          }
        />
        <KpiCard
          label={t("financas.kpiNet")}
          value={brl(cur.net)}
          icon="📊"
          tone={cur.net >= 0 ? "gold" : "negative"}
          delta={vsPrev(cur.net, prev.net)}
        />
        <div data-kpi="balance" className="contents">
          <KpiCard
            label={t("financas.kpiBalance")}
            value={brl(balance)}
            icon="💎"
            tone={balance >= 0 ? "gold" : "negative"}
            delta={
              <>
                <div>
                  {monthSel === currentMonth
                    ? t("financas.balanceToday")
                    : t("financas.balanceMonthEnd")}
                </div>
                {profile.openingBalance === undefined ? (
                  <Link to="/configuracoes" className="text-gold hover:underline">
                    {t("financas.openingMissing")}
                  </Link>
                ) : (
                  <div>{t("financas.openingHint", { value: brl(opening) })}</div>
                )}
              </>
            }
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <Section title={t("financas.expensesByCategory")} className="mt-0 min-w-0">
          <GlassCard>
            {byCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("financas.emptyExpenses")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} formatter={(v: number) => brl(v)} />
                  <Legend formatter={(v: string) => catName(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </Section>
        <Section title={t("financas.budgetTitle")} className="mt-0 min-w-0">
          <BudgetCard
            t={t}
            lines={budgets}
            prev={prev.byCategory}
            catName={catName}
            catIcon={catIcon}
          />
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <GlassCard className="min-w-0">
          <h3 className="font-display font-semibold mb-4">{t("financas.register")}</h3>
          <form onSubmit={submit} className="space-y-3">
            <TypeToggle t={t} value={form.type} onChange={(type) => setForm({ ...form, type })} />
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder={t("financas.valuePlaceholder")}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
            <Input
              placeholder={t("financas.descriptionPlaceholder")}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TaxonomySelect
              scope="financeCategories"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              onAdd={addCustomItem}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
            />
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <button
              type="submit"
              className="w-full bg-gold text-[#0A0F1E] font-semibold py-2.5 rounded-lg hover:brightness-110 transition"
            >
              {t("financas.registerBtn")}
            </button>
          </form>
        </GlassCard>

        <GlassCard className="min-w-0">
          <h3 className="font-display font-semibold mb-3">{t("financas.history")}</h3>
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                data-tx-search
                value={filter.query}
                onChange={(e) => setFilter({ ...filter, query: e.target.value })}
                placeholder={t("financas.search")}
                className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label={t("financas.filterType")}
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value as TxFilter["type"] })}
                className="min-w-0 bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
              >
                <option value="todas">{t("financas.filterAll")}</option>
                <option value="entrada">{t("financas.entrada")}</option>
                <option value="saida">{t("financas.saida")}</option>
              </select>
              <select
                aria-label={t("financas.filterCategory")}
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="min-w-0 bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
              >
                <option value="">{t("financas.filterAllCats")}</option>
                {monthCategories.map((c) => (
                  <option key={c} value={c}>
                    {catName(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {monthTx.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("financas.emptyTx")}</p>
            )}
            {monthTx.length > 0 && shownTx.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("financas.noResults")}</p>
            )}
            {shownTx.map((tx) => (
              <div
                key={tx.id}
                data-tx={tx.id}
                className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition"
              >
                <span className="text-xl">{catIcon(tx.category)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{tx.description}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {fmtDate(tx.date)} • {catName(tx.category)}
                    {tx.recurringId && (
                      <span className="inline-flex items-center gap-0.5 text-gold">
                        • <Repeat size={10} /> {t("financas.recurringBadge")}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`font-semibold whitespace-nowrap ${tx.type === "entrada" ? "text-emerald-bgt" : "text-coral"}`}
                >
                  {tx.type === "entrada" ? "+" : "-"}
                  {brl(tx.value)}
                </div>
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition">
                  <button
                    onClick={() => setEditing(tx)}
                    title={t("action.edit")}
                    className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80"
                  >
                    <Pencil size={14} />
                  </button>
                  <ConfirmButton
                    onConfirm={() => removeTransaction(tx.id)}
                    message={t("financas.confirmDelete", {
                      desc: tx.description,
                      value: brl(tx.value),
                    })}
                    className="text-coral p-1 rounded hover:bg-muted/80"
                  >
                    <Trash2 size={14} />
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <Section title={t("financas.recurringTitle")}>
        <RecurringCard t={t} today={today} rules={recurringTransactions} catName={catName} />
      </Section>

      <Section title={t("financas.balanceTrend")}>
        <GlassCard>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={series.map((m) => ({
                mes: monthLabel(m.month, locale).slice(0, 3) + "/" + m.month.slice(2, 4),
                saldo: m.balance,
                resultado: m.net,
              }))}
            >
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} width={56} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => brl(v)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="saldo"
                name={t("financas.accumulated")}
                stroke="#F5C842"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="resultado"
                name={t("financas.kpiNet")}
                stroke="#3498DB"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </Section>

      <Section title={t("financas.summary12")}>
        <GlassCard className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-2">{t("financas.month")}</th>
                <th className="text-right py-2 px-2">{t("financas.income")}</th>
                <th className="text-right py-2 px-2">{t("financas.expenses")}</th>
                <th className="text-right py-2 px-2">{t("financas.kpiNet")}</th>
                <th className="text-right py-2 px-2">{t("financas.accumulated")}</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((m) => (
                <tr key={m.month} className="border-b border-border">
                  <td className="py-2 px-2 whitespace-nowrap">{monthLabel(m.month, locale)}</td>
                  <td className="text-right text-emerald-bgt px-2">{brl(m.income)}</td>
                  <td className="text-right text-coral px-2">{brl(m.expense)}</td>
                  <td className={`text-right px-2 ${m.net >= 0 ? "text-gold" : "text-coral"}`}>
                    {brl(m.net)}
                  </td>
                  <td
                    className={`text-right font-semibold px-2 ${m.balance >= 0 ? "text-gold" : "text-coral"}`}
                  >
                    {brl(m.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </Section>

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title={t("financas.editTitle")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const valor = parseFloat(String(fd.get("value") ?? "").replace(",", "."));
              const descricao = String(fd.get("description") ?? "").trim();
              if (!Number.isFinite(valor) || valor <= 0) {
                toast.error(t("financas.toastValue"));
                return;
              }
              if (!descricao) {
                toast.error(t("financas.toastEmptyDesc"));
                return;
              }
              updateTransaction(editing.id, {
                description: descricao,
                value: valor,
                category: String(fd.get("category") || editing.category),
                date: String(fd.get("date") || editing.date),
                type: String(fd.get("type") || editing.type) as "entrada" | "saida",
              });
              setEditing(null);
              toast.success(t("financas.toastUpdated"));
            }}
            className="space-y-3"
          >
            <select name="type" defaultValue={editing.type} className={inpCls}>
              <option value="entrada">{t("financas.entrada")}</option>
              <option value="saida">{t("financas.saida")}</option>
            </select>
            <input
              name="description"
              defaultValue={editing.description}
              className={inpCls}
              placeholder={t("financas.editDescription")}
              required
            />
            <input
              name="value"
              defaultValue={editing.value}
              type="number"
              step="0.01"
              min="0.01"
              className={inpCls}
              required
            />
            <TaxonomySelect
              scope="financeCategories"
              name="category"
              defaultValue={editing.category}
              onAdd={addCustomItem}
              className={inpCls}
            />
            <input
              name="date"
              defaultValue={editing.date}
              type="date"
              className={inpCls}
              placeholder={t("financas.editDate")}
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm"
              >
                {t("financas.cancel")}
              </button>
              <button type="submit" className={btnGold}>
                {t("financas.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Progress({
  pct,
  tone,
  label,
}: {
  pct: number;
  tone: "positive" | "negative" | "gold";
  label: string;
}) {
  const bar = tone === "positive" ? "bg-emerald-bgt" : tone === "negative" ? "bg-coral" : "bg-gold";
  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <div>{label}</div>
    </div>
  );
}

function TypeToggle({
  t,
  value,
  onChange,
}: {
  t: T;
  value: "entrada" | "saida";
  onChange: (v: "entrada" | "saida") => void;
}) {
  return (
    <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-border">
      <button
        type="button"
        onClick={() => onChange("entrada")}
        className={`py-2 text-sm font-medium transition ${value === "entrada" ? "bg-emerald-bgt text-black" : "hover:bg-muted/50"}`}
      >
        {t("financas.entrada")}
      </button>
      <button
        type="button"
        onClick={() => onChange("saida")}
        className={`py-2 text-sm font-medium transition ${value === "saida" ? "bg-coral text-white" : "hover:bg-muted/50"}`}
      >
        {t("financas.saida")}
      </button>
    </div>
  );
}

function BudgetCard({
  t,
  lines,
  prev,
  catName,
  catIcon,
}: {
  t: T;
  lines: ReturnType<typeof budgetLines>;
  prev: Record<string, number>;
  catName: (id: string) => string;
  catIcon: (id: string) => string;
}) {
  const setCategoryBudget = useStore((s) => s.setCategoryBudget);
  const options = useStore((s) => s.customTaxonomy.financeCategories);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Categoria escolhida em "Definir orçamento" que ainda não tem gasto nem limite.
  const [adding, setAdding] = useState<string | null>(null);
  const shown =
    adding && !lines.some((l) => l.category === adding)
      ? [...lines, { category: adding, spent: 0, limit: null, pct: null, over: false }]
      : lines;
  const allCats = [...CATEGORIES.map((c) => c.id), ...options.map((c) => c.id)].filter(
    (c) => !shown.some((l) => l.category === c && l.limit !== null) && c !== adding,
  );

  const save = (cat: string) => {
    const v = parseFloat(draft.replace(",", "."));
    setCategoryBudget(cat, Number.isFinite(v) && v > 0 ? v : null);
    setEditing(null);
    setAdding(null);
  };

  return (
    <GlassCard>
      {shown.length === 0 && (
        <p className="text-muted-foreground text-sm mb-3">{t("financas.budgetEmpty")}</p>
      )}
      <ul className="space-y-3">
        {shown.map((l) => (
          <li key={l.category} data-budget={l.category} className="text-sm">
            <div className="flex items-center gap-2">
              <span>{catIcon(l.category)}</span>
              <span className="flex-1 min-w-0 truncate">{catName(l.category)}</span>
              {editing === l.category ? (
                <form
                  className="flex gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(l.category);
                  }}
                >
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("financas.budgetPlaceholder")}
                    className="w-24 bg-secondary border border-border rounded px-2 py-1 text-sm"
                  />
                  <button type="submit" className="text-xs text-gold px-1">
                    {t("financas.save")}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(l.category);
                    setDraft(l.limit ? String(l.limit) : "");
                  }}
                  className="text-xs text-muted-foreground hover:text-gold whitespace-nowrap"
                >
                  {l.limit
                    ? t("financas.budgetOf", { spent: brl(l.spent), limit: brl(l.limit) })
                    : `${brl(l.spent)} · ${t("financas.budgetSet")}`}
                </button>
              )}
            </div>
            {l.limit !== null && (
              <div className="mt-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={`h-full ${l.over ? "bg-coral" : "bg-gold"}`}
                  style={{ width: `${Math.min(100, l.pct ?? 0)}%` }}
                />
              </div>
            )}
            <div className="mt-0.5 text-xs text-muted-foreground">
              {l.over && <span className="text-coral">{t("financas.budgetOver")} · </span>}
              {t("financas.prevMonthCat", { value: brl(prev[l.category] ?? 0) })}
            </div>
          </li>
        ))}
      </ul>
      {allCats.length > 0 && (
        <select
          aria-label={t("financas.budgetAddCategory")}
          value=""
          onChange={(e) => {
            const c = e.target.value;
            if (!c) return;
            setAdding(c);
            setEditing(c);
            setDraft("");
          }}
          className="mt-4 w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
        >
          <option value="">{t("financas.budgetAddCategory")}</option>
          {allCats.map((c) => (
            <option key={c} value={c}>
              {catName(c)}
            </option>
          ))}
        </select>
      )}
    </GlassCard>
  );
}

function RecurringCard({
  t,
  today,
  rules,
  catName,
}: {
  t: T;
  today: string;
  rules: RecurringTransaction[];
  catName: (id: string) => string;
}) {
  const { addRecurring, updateRecurring, removeRecurring, postDueRecurring, addCustomItem } =
    useStore();
  const [form, setForm] = useState({
    type: "entrada" as "entrada" | "saida",
    value: "",
    description: "",
    category: "Investimento",
    day: "5",
  });
  const day = Math.min(31, Math.max(1, parseInt(form.day, 10) || 1));
  const startMonth = defaultStartMonth(day, today);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(form.value.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error(t("financas.toastValue"));
      return;
    }
    if (!form.description.trim()) {
      toast.error(t("financas.toastDescribe"));
      return;
    }
    addRecurring({
      type: form.type,
      value: v,
      description: form.description.trim(),
      category: form.category,
      dayOfMonth: day,
      startMonth,
      active: true,
    });
    postDueRecurring(today);
    setForm({ ...form, value: "", description: "" });
    toast.success(
      t("financas.recurringAdded", {
        date: fmtDate(recurringDate({ dayOfMonth: day }, startMonth)),
      }),
    );
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <GlassCard className="min-w-0">
        <p className="text-xs text-muted-foreground mb-3">{t("financas.recurringHint")}</p>
        {rules.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("financas.recurringEmpty")}</p>
        )}
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} data-recurring={r.id} className="flex items-center gap-2 text-sm">
              <Repeat size={14} className={r.active ? "text-gold" : "text-muted-foreground"} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{r.description}</div>
                <div className="text-xs text-muted-foreground">
                  {t("financas.recurringEvery", { day: r.dayOfMonth })} • {catName(r.category)}
                  {!r.active && ` • ${t("financas.recurringPaused")}`}
                </div>
              </div>
              <span
                className={`whitespace-nowrap font-semibold ${r.type === "entrada" ? "text-emerald-bgt" : "text-coral"}`}
              >
                {r.type === "entrada" ? "+" : "-"}
                {brl(r.value)}
              </span>
              <button
                type="button"
                title={r.active ? t("financas.recurringPause") : t("financas.recurringResume")}
                onClick={() => {
                  // Ao retomar, não lança os meses em que a regra ficou pausada.
                  const resume = !r.active;
                  updateRecurring(r.id, {
                    active: resume,
                    ...(resume
                      ? { lastPostedMonth: addMonths(defaultStartMonth(r.dayOfMonth, today), -1) }
                      : {}),
                  });
                  if (resume) postDueRecurring(today);
                }}
                className="p-1 rounded hover:bg-muted/80 text-muted-foreground"
              >
                {r.active ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <ConfirmButton
                onConfirm={() => removeRecurring(r.id)}
                message={t("financas.recurringDeleteConfirm", { desc: r.description })}
                className="text-coral p-1 rounded hover:bg-muted/80"
              >
                <Trash2 size={14} />
              </ConfirmButton>
            </li>
          ))}
        </ul>
      </GlassCard>
      <GlassCard className="min-w-0">
        <h3 className="font-display font-semibold mb-3">{t("financas.recurringAdd")}</h3>
        <form onSubmit={submit} className="space-y-3" data-recurring-form>
          <TypeToggle t={t} value={form.type} onChange={(type) => setForm({ ...form, type })} />
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder={t("financas.valuePlaceholder")}
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          <Input
            placeholder={t("financas.descriptionPlaceholder")}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <TaxonomySelect
            scope="financeCategories"
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            onAdd={addCustomItem}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
          />
          <label className="block text-xs text-muted-foreground">
            {t("financas.recurringDay")}
            <Input
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {t("financas.recurringFirst", {
              date: fmtDate(recurringDate({ dayOfMonth: day }, startMonth)),
            })}
          </p>
          <button
            type="submit"
            className="w-full bg-gold text-[#0A0F1E] font-semibold py-2.5 rounded-lg hover:brightness-110 transition"
          >
            {t("financas.recurringAdd")}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}

const ttStyle = {
  backgroundColor: "rgba(20,25,45,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full min-w-0 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
    />
  );
}
