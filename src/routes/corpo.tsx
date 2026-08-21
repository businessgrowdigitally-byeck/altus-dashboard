import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, type WeightEntry, type Workout } from "@/lib/store";
import { fmtDate, kg, todayISO, WORKOUT_TYPES } from "@/lib/format";
import { GlassCard, KpiCard, PageHeader, Section } from "@/components/primitives";
import { Pencil, Trash2 } from "lucide-react";
import { Modal, ConfirmButton, inpCls, btnGold } from "@/components/Modal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/corpo")({ component: Corpo });

function Corpo() {
  const {
    weights,
    addWeight,
    updateWeight,
    removeWeight,
    profile,
    workouts,
    addWorkout,
    updateWorkout,
    removeWorkout,
  } = useStore();
  const [filter, setFilter] = useState<"1M" | "3M" | "6M" | "1A" | "ALL">("3M");

  const [editingWeight, setEditingWeight] = useState<WeightEntry | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);

  const sorted = useMemo(() => [...weights].sort((a, b) => a.date.localeCompare(b.date)), [weights]);
  const last = sorted[sorted.length - 1];
  const first = sorted[0];

  // Assume height 1.75 — user can adjust via settings later
  const height = 1.75;
  const imc = last ? last.weight / (height * height) : 0;
  const imcStatus = imc < 18.5 ? "Atenção" : imc < 25 ? "Normal" : imc < 30 ? "Atenção" : "Cuidado";

  const goal = profile.goalWeight;
  const goalProgress =
    first && last && first.weight !== goal
      ? Math.max(0, Math.min(100, ((first.weight - last.weight) / (first.weight - goal)) * 100))
      : 0;
  const variation = last && first ? last.weight - first.weight : 0;

  const chartData = useMemo(() => {
    const days = { "1M": 30, "3M": 90, "6M": 180, "1A": 365, ALL: 99999 }[filter];
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return sorted
      .filter((w) => w.date >= cutoff)
      .map((w) => ({ date: w.date.slice(5), peso: w.weight }));
  }, [sorted, filter]);

  const [wf, setWf] = useState({ weight: "", date: todayISO(), notes: "" });
  const submitWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(wf.weight.replace(",", "."));
    if (!v) return;
    addWeight({ weight: v, date: wf.date, notes: wf.notes });
    setWf({ weight: "", date: todayISO(), notes: "" });
  };

  const historyRows = useMemo(() => {
    const desc = [...weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    return desc.map((w, i) => {
      const next = desc[i + 1];
      return { ...w, delta: next ? w.weight - next.weight : 0 };
    });
  }, [weights]);

  const [wo, setWo] = useState({ date: todayISO(), type: "Musculação", duration: "", notes: "" });
  const submitWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseInt(wo.duration, 10);
    if (!d) return;
    addWorkout({ date: wo.date, type: wo.type, duration: d, notes: wo.notes });
    setWo({ date: todayISO(), type: "Musculação", duration: "", notes: "" });
  };

  return (
    <div>
      <PageHeader title="Seu Corpo, Sua Empresa" subtitle="Cuide do seu ativo mais valioso" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Peso Atual" value={last ? kg(last.weight) : "—"} icon="⚖️" tone="gold" />
        <KpiCard
          label="IMC"
          value={imc ? imc.toFixed(1) : "—"}
          icon="📊"
          delta={imc ? imcStatus : undefined}
          tone={imcStatus === "Normal" ? "positive" : imcStatus === "Cuidado" ? "negative" : "default"}
        />
        <KpiCard
          label="Meta de Peso"
          value={`${goal} kg`}
          icon="🎯"
          delta={`${goalProgress.toFixed(0)}% do caminho`}
        />
        <KpiCard
          label="Variação Total"
          value={`${variation >= 0 ? "+" : ""}${variation.toFixed(1)} kg`}
          icon={variation >= 0 ? "↑" : "↓"}
          tone={variation <= 0 ? "positive" : "negative"}
        />
      </div>

      <Section title="Evolução do Peso">
        <GlassCard>
          <div className="flex gap-2 mb-3">
            {(["1M", "3M", "6M", "1A", "ALL"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs transition ${filter === f ? "bg-gold text-[#0A0F1E] font-semibold" : "bg-white/5 hover:bg-white/10"}`}
              >
                {f === "ALL" ? "Tudo" : f}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="date" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} domain={["auto", "auto"]} />
              <Tooltip contentStyle={ttStyle} />
              <ReferenceLine y={goal} stroke="#F5C842" strokeDasharray="5 5" label={{ value: "Meta", fill: "#F5C842", fontSize: 11 }} />
              <Line type="monotone" dataKey="peso" stroke="#2ECC71" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </Section>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <GlassCard>
          <h3 className="font-display font-semibold mb-4">Registrar Peso</h3>
          <form onSubmit={submitWeight} className="space-y-3">
            <input className={inpCls} type="number" step="0.1" placeholder="Peso (kg)" value={wf.weight} onChange={(e) => setWf({ ...wf, weight: e.target.value })} required />
            <input className={inpCls} type="date" value={wf.date} onChange={(e) => setWf({ ...wf, date: e.target.value })} required />
            <textarea className={inpCls} placeholder="Observações (opcional)" rows={3} value={wf.notes} onChange={(e) => setWf({ ...wf, notes: e.target.value })} />
            <button className={`${btnGold} w-full`}>Registrar Peso</button>
          </form>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-semibold mb-4">Histórico de Peso</h3>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-white/10">
                <tr>
                  <th className="text-left py-1">Data</th>
                  <th className="text-right py-1">Peso</th>
                  <th className="text-right py-1">Δ</th>
                  <th className="text-left py-1 pl-3">Obs</th>
                  <th className="text-right py-1">Ações</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted-foreground text-xs">Nenhum peso registrado.</td>
                  </tr>
                )}
                {historyRows.map((w) => (
                  <tr key={w.id} className="border-b border-white/5 group hover:bg-white/5 transition">
                    <td className="py-2">{fmtDate(w.date)}</td>
                    <td className="text-right font-medium">{kg(w.weight)}</td>
                    <td className={`text-right ${w.delta > 0 ? "text-coral" : w.delta < 0 ? "text-emerald-bgt" : ""}`}>
                      {w.delta ? (w.delta > 0 ? "+" : "") + w.delta.toFixed(1) : "—"}
                    </td>
                    <td className="text-xs text-muted-foreground pl-3 truncate max-w-[100px]">{w.notes || "—"}</td>
                    <td className="text-right py-1">
                      <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => setEditingWeight(w)}
                          title="Editar"
                          className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil size={13} />
                        </button>
                        <ConfirmButton
                          onConfirm={() => removeWeight(w.id)}
                          message="Excluir este registro de peso?"
                          className="p-1 rounded hover:bg-white/10 text-coral"
                        >
                          <Trash2 size={13} />
                        </ConfirmButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      <Section title="Integrações">
        <div className="grid md:grid-cols-2 gap-4">
          <GlassCard>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🥗</span>
              <h4 className="font-semibold">MyFitnessPal</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Conecte seu MyFitnessPal para sincronizar dados de alimentação automaticamente.</p>
            <button className="text-sm text-gold hover:underline">Ver Como Integrar →</button>
          </GlassCard>
          <GlassCard>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💪</span>
              <h4 className="font-semibold">Strong App</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Conecte o Strong para importar seus treinos.</p>
            <button className="text-sm text-gold hover:underline">Ver Como Integrar →</button>
          </GlassCard>
        </div>
      </Section>

      <Section title="Resumo de Treinos">
        <div className="grid lg:grid-cols-2 gap-4">
          <GlassCard>
            <h3 className="font-display font-semibold mb-4">Registrar Treino</h3>
            <form onSubmit={submitWorkout} className="space-y-3">
              <input className={inpCls} type="date" value={wo.date} onChange={(e) => setWo({ ...wo, date: e.target.value })} required />
              <select className={inpCls} value={wo.type} onChange={(e) => setWo({ ...wo, type: e.target.value })}>
                {WORKOUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className={inpCls} type="number" placeholder="Duração (minutos)" value={wo.duration} onChange={(e) => setWo({ ...wo, duration: e.target.value })} required />
              <textarea className={inpCls} rows={2} placeholder="Notas (ex: Peito e tríceps, carga...)" value={wo.notes} onChange={(e) => setWo({ ...wo, notes: e.target.value })} />
              <button className={`${btnGold} w-full`}>Salvar Treino</button>
            </form>
          </GlassCard>
          <GlassCard>
            <h3 className="font-display font-semibold mb-4">Últimos Treinos</h3>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {workouts.slice(0, 10).map((w) => (
                <div key={w.id} className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/5">
                  <div>
                    <div className="text-sm font-medium">{w.type}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(w.date)} • {w.duration}min {w.notes ? `• ${w.notes}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => setEditingWorkout(w)}
                      title="Editar"
                      className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={14} />
                    </button>
                    <ConfirmButton
                      onConfirm={() => removeWorkout(w.id)}
                      message="Excluir este treino?"
                      className="p-1 rounded hover:bg-white/10 text-coral"
                    >
                      <Trash2 size={14} />
                    </ConfirmButton>
                  </div>
                </div>
              ))}
              {workouts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum treino registrado.</p>}
            </div>
          </GlassCard>
        </div>
      </Section>

      {/* Modal Editar Peso */}
      {editingWeight && (
        <Modal open={!!editingWeight} onClose={() => setEditingWeight(null)} title="Editar Peso">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateWeight(editingWeight.id, {
                weight: parseFloat(String(fd.get("weight")) || String(editingWeight.weight)),
                date: String(fd.get("date") || editingWeight.date),
                notes: String(fd.get("notes") || ""),
              });
              setEditingWeight(null);
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Peso (kg)</label>
              <input name="weight" type="number" step="0.1" defaultValue={editingWeight.weight} className={inpCls} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data</label>
              <input name="date" type="date" defaultValue={editingWeight.date} className={inpCls} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Observações</label>
              <textarea name="notes" defaultValue={editingWeight.notes ?? ""} rows={3} className={inpCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingWeight(null)} className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition">
                Cancelar
              </button>
              <button type="submit" className={btnGold}>
                Salvar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Editar Treino */}
      {editingWorkout && (
        <Modal open={!!editingWorkout} onClose={() => setEditingWorkout(null)} title="Editar Treino">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateWorkout(editingWorkout.id, {
                type: String(fd.get("type") || editingWorkout.type),
                duration: parseInt(String(fd.get("duration")), 10) || editingWorkout.duration,
                date: String(fd.get("date") || editingWorkout.date),
                notes: String(fd.get("notes") || ""),
              });
              setEditingWorkout(null);
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo de Treino</label>
              <select name="type" defaultValue={editingWorkout.type} className={inpCls}>
                {WORKOUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Duração (minutos)</label>
              <input name="duration" type="number" defaultValue={editingWorkout.duration} className={inpCls} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data</label>
              <input name="date" type="date" defaultValue={editingWorkout.date} className={inpCls} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Notas</label>
              <textarea name="notes" defaultValue={editingWorkout.notes ?? ""} rows={2} className={inpCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingWorkout(null)} className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition">
                Cancelar
              </button>
              <button type="submit" className={btnGold}>
                Salvar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const ttStyle = {
  backgroundColor: "rgba(12,11,24,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
};