import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { brl, CATEGORIES, fmtDate, todayISO } from "@/lib/format";
import { GlassCard, KpiCard, PageHeader, Section } from "@/components/primitives";
import { Pencil, Trash2 } from "lucide-react";
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

function Financas() {
  const { transactions, addTransaction, updateTransaction, removeTransaction } = useStore();
  const [monthSel, setMonthSel] = useState(todayISO().slice(0, 7));
  const [editing, setEditing] = useState<null | (typeof transactions)[number]>(null);

  const [form, setForm] = useState({
    type: "saida" as "entrada" | "saida",
    value: "",
    description: "",
    category: "Alimentação",
    date: todayISO(),
  });

  const monthTx = transactions.filter((t) => t.date.startsWith(monthSel));
  const income = monthTx.filter((t) => t.type === "entrada").reduce((a, b) => a + b.value, 0);
  const expense = monthTx.filter((t) => t.type === "saida").reduce((a, b) => a + b.value, 0);
  const net = income - expense;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthTx
      .filter((t) => t.type === "saida")
      .forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.value));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [monthTx]);

  const balanceTrend = useMemo(() => {
    const arr: { mes: string; saldo: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const tx = transactions.filter((t) => t.date.startsWith(key));
      const sal =
        tx.filter((t) => t.type === "entrada").reduce((a, b) => a + b.value, 0) -
        tx.filter((t) => t.type === "saida").reduce((a, b) => a + b.value, 0);
      arr.push({ mes: key.slice(5) + "/" + key.slice(2, 4), saldo: sal });
    }
    return arr;
  }, [transactions]);

  const monthlySummary = useMemo(() => {
    const arr: { mes: string; entradas: number; saidas: number; saldo: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const tx = transactions.filter((t) => t.date.startsWith(key));
      const e = tx.filter((t) => t.type === "entrada").reduce((a, b) => a + b.value, 0);
      const s = tx.filter((t) => t.type === "saida").reduce((a, b) => a + b.value, 0);
      arr.push({ mes: key, entradas: e, saidas: s, saldo: e - s });
    }
    return arr.reverse();
  }, [transactions]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(form.value.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Descreva a transação para reconhecê-la depois.");
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

  return (
    <div>
      <PageHeader
        title="Central Financeira"
        subtitle="Sua gestão de capital pessoal"
        right={
          <input
            type="month"
            value={monthSel}
            onChange={(e) => setMonthSel(e.target.value)}
            className="bg-secondary border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Total Entradas" value={brl(income)} icon="📈" tone="positive" />
        <KpiCard label="Total Saídas" value={brl(expense)} icon="📉" tone="negative" />
        <KpiCard label="Saldo Líquido" value={brl(net)} icon="💎" tone={net >= 0 ? "gold" : "negative"} />
      </div>

      <Section title="Despesas por Categoria">
        <GlassCard>
          {byCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem despesas neste mês.</p>
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
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </Section>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <GlassCard>
          <h3 className="font-display font-semibold mb-4">Registrar Transação</h3>
          <form onSubmit={submit} className="space-y-3">
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "entrada" })}
                className={`flex-1 py-2 text-sm font-medium transition ${form.type === "entrada" ? "bg-emerald-bgt text-black" : "hover:bg-white/5"}`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "saida" })}
                className={`flex-1 py-2 text-sm font-medium transition ${form.type === "saida" ? "bg-coral text-white" : "hover:bg-white/5"}`}
              >
                Saída
              </button>
            </div>
            <Input
              type="number"
              step="0.01"
              placeholder="Valor (R$)"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
            <Input
              placeholder="Descrição"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.id}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <button
              type="submit"
              className="w-full bg-gold text-[#0A0F1E] font-semibold py-2.5 rounded-lg hover:brightness-110 transition"
            >
              Registrar
            </button>
          </form>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-semibold mb-4">Histórico do Mês</h3>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {monthTx.length === 0 && (
              <p className="text-muted-foreground text-sm">Nenhuma transação registrada.</p>
            )}
            {monthTx.map((t) => {
              const cat = CATEGORIES.find((c) => c.id === t.category);
              return (
                <div key={t.id} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition">
                  <span className="text-xl">{cat?.icon || "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{t.description}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(t.date)} • {t.category}</div>
                  </div>
                  <div className={`font-semibold ${t.type === "entrada" ? "text-emerald-bgt" : "text-coral"}`}>
                    {t.type === "entrada" ? "+" : "-"}{brl(t.value)}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => setEditing(t)} title="Editar" className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/10">
                      <Pencil size={14} />
                    </button>
                    <ConfirmButton
                      onConfirm={() => removeTransaction(t.id)}
                      message={`Excluir a transação "${t.description}" (${brl(t.value)})?`}
                      className="text-coral p-1 rounded hover:bg-white/10"
                    >
                      <Trash2 size={14} />
                    </ConfirmButton>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <Section title="Evolução do Saldo (6 meses)">
        <GlassCard>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={balanceTrend}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => brl(v)} />
              <Line type="monotone" dataKey="saldo" stroke="#F5C842" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </Section>

      <Section title="Resumo dos Últimos 12 Meses">
        <GlassCard className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b border-white/10">
              <tr>
                <th className="text-left py-2 px-2">Mês</th>
                <th className="text-right py-2 px-2">Entradas</th>
                <th className="text-right py-2 px-2">Saídas</th>
                <th className="text-right py-2 px-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((m) => (
                <tr key={m.mes} className="border-b border-white/5">
                  <td className="py-2 px-2">{m.mes}</td>
                  <td className="text-right text-emerald-bgt">{brl(m.entradas)}</td>
                  <td className="text-right text-coral">{brl(m.saidas)}</td>
                  <td className={`text-right font-semibold ${m.saldo >= 0 ? "text-gold" : "text-coral"}`}>{brl(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </Section>

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar Transação">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const valor = parseFloat(String(fd.get("value") ?? "").replace(",", "."));
              const descricao = String(fd.get("description") ?? "").trim();
              if (!Number.isFinite(valor) || valor <= 0) {
                toast.error("Informe um valor maior que zero.");
                return;
              }
              if (!descricao) {
                toast.error("A descrição não pode ficar vazia.");
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
              toast.success("Transação atualizada.");
            }}
            className="space-y-3"
          >
            <select name="type" defaultValue={editing.type} className={inpCls}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
            <input name="description" defaultValue={editing.description} className={inpCls} placeholder="Descrição" required />
            <input name="value" defaultValue={editing.value} type="number" step="0.01" min="0.01" className={inpCls} required />
            <select name="category" defaultValue={editing.category} className={inpCls}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.id}</option>)}
            </select>
            <input name="date" defaultValue={editing.date} type="date" className={inpCls} required />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-white/10 text-sm">Cancelar</button>
              <button type="submit" className={btnGold}>Salvar</button>
            </div>
          </form>
        </Modal>
      )}
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
      className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
    />
  );
}