import { useMemo, useState } from "react";
import { Pencil, Trash2, Plus, Check } from "lucide-react";
import { useStore, type GoalArea, type GoalMacro, type GoalDaily } from "@/lib/store";
import { GlassCard } from "@/components/primitives";
import { Modal, ConfirmButton, inpCls, btnGold } from "@/components/Modal";
import { brl, todayISO } from "@/lib/format";

const AREAS: GoalArea[] = ["Finanças", "Corpo & Saúde", "Biblioteca", "Estudos", "Geral"];
const AREA_COLORS: Record<GoalArea, string> = {
  "Finanças": "bg-gold/20 text-gold",
  "Corpo & Saúde": "bg-emerald-bgt/20 text-emerald-bgt",
  "Biblioteca": "bg-purple-500/20 text-purple-300",
  "Estudos": "bg-blue-500/20 text-blue-300",
  "Geral": "bg-white/10 text-white",
};
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function GoalsSection() {
  const [tab, setTab] = useState<"macro" | "daily">("macro");
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-xl font-semibold">🎯 Metas &amp; Sistema Diário</h2>
        <div className="flex rounded-xl border border-white/10 overflow-hidden text-sm">
          <button onClick={() => setTab("macro")} className={`px-4 py-2 ${tab === "macro" ? "bg-gold text-[#0A0F1E] font-semibold" : "hover:bg-white/5"}`}>
            Metas Macro
          </button>
          <button onClick={() => setTab("daily")} className={`px-4 py-2 ${tab === "daily" ? "bg-gold text-[#0A0F1E] font-semibold" : "hover:bg-white/5"}`}>
            Rotina Diária
          </button>
        </div>
      </div>
      {tab === "macro" ? <MacroTab /> : <DailyTab />}
    </section>
  );
}

function emptyMacro(): Omit<GoalMacro, "id" | "createdAt"> {
  return { name: "", area: "Geral", type: "numerica", currentValue: 0, targetValue: 0, unit: "", deadline: "", motivation: "", linkedModule: null };
}

function MacroTab() {
  const { goalsMacro, addGoalMacro, updateGoalMacro, removeGoalMacro, recomputeLinkedGoals } = useStore();
  const [editing, setEditing] = useState<GoalMacro | null>(null);
  const [creating, setCreating] = useState(false);

  const sorted = useMemo(() => {
    return [...goalsMacro].sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
  }, [goalsMacro]);

  return (
    <div>
      <button onClick={() => setCreating(true)} className={btnGold + " mb-4 inline-flex items-center gap-2"}>
        <Plus size={16} /> Nova Meta
      </button>

      {sorted.length === 0 && (
        <GlassCard><p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p></GlassCard>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((g) => {
          const pct = g.targetValue
            ? g.linkedModule === "weight"
              ? Math.max(0, Math.min(100, ((g.currentValue ? (sortedDiff(g)) : 0))))
              : Math.max(0, Math.min(100, (g.currentValue / g.targetValue) * 100))
            : 0;
          const days = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000) : null;
          return (
            <GlassCard key={g.id} className="group flex flex-col">
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="min-w-0">
                  <h4 className="font-semibold leading-tight">{g.name}</h4>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-1 ${AREA_COLORS[g.area]}`}>{g.area}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 md:opacity-0 transition">
                  <button onClick={() => setEditing(g)} className="p-1.5 rounded hover:bg-white/10 text-muted-foreground"><Pencil size={14} /></button>
                  <ConfirmButton onConfirm={() => removeGoalMacro(g.id)} className="p-1.5 rounded hover:bg-white/10 text-coral"><Trash2 size={14} /></ConfirmButton>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                <span>{formatValue(g.currentValue, g.unit)} / {formatValue(g.targetValue, g.unit)}</span>
                <span>{pct.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {g.deadline && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {days! >= 0 ? `${days} dias restantes` : `${Math.abs(days!)} dias atrás (vencida)`}
                </div>
              )}
              {g.motivation && <p className="text-xs italic text-muted-foreground mt-2 line-clamp-2">"{g.motivation}"</p>}
            </GlassCard>
          );
        })}
      </div>

      <MacroFormModal
        open={creating || !!editing}
        initial={editing ?? emptyMacro()}
        title={editing ? "Editar Meta" : "Nova Meta"}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(data) => {
          if (editing) updateGoalMacro(editing.id, data);
          else addGoalMacro(data);
          recomputeLinkedGoals();
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function sortedDiff(g: GoalMacro) {
  // for weight goals: progress from start toward target. Approximate using current vs target
  if (g.targetValue === 0) return 0;
  // simple: if current near target -> 100
  const diff = Math.abs(g.targetValue - g.currentValue);
  const start = Math.max(diff * 4, 1);
  return ((start - diff) / start) * 100;
}

function formatValue(v: number, unit: string) {
  if (unit === "R$") return brl(v);
  return `${v.toLocaleString("pt-BR")}${unit ? " " + unit : ""}`;
}

function MacroFormModal({
  open, onClose, onSave, initial, title,
}: {
  open: boolean; onClose: () => void;
  onSave: (g: Omit<GoalMacro, "id" | "createdAt">) => void;
  initial: Omit<GoalMacro, "id" | "createdAt">;
  title: string;
}) {
  const [f, setF] = useState(initial);
  // Reset form when initial changes
  useMemo(() => setF(initial), [initial]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); if (f.name && f.targetValue) onSave(f); }} className="space-y-3">
        <Field label="Nome da meta">
          <input className={inpCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Área">
            <select className={inpCls} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as GoalArea })}>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select className={inpCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as any })}>
              <option value="numerica">Numérica</option>
              <option value="data">Data limite</option>
              <option value="habito">Hábito</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Valor atual">
            <input className={inpCls} type="number" step="0.01" value={f.currentValue} onChange={(e) => setF({ ...f, currentValue: +e.target.value })} />
          </Field>
          <Field label="Valor alvo">
            <input className={inpCls} type="number" step="0.01" value={f.targetValue} onChange={(e) => setF({ ...f, targetValue: +e.target.value })} required />
          </Field>
          <Field label="Unidade">
            <input className={inpCls} placeholder="kg, R$, livros..." value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          </Field>
        </div>
        <Field label="Auto-vincular módulo (opcional)">
          <select className={inpCls} value={f.linkedModule ?? ""} onChange={(e) => setF({ ...f, linkedModule: (e.target.value || null) as any })}>
            <option value="">Nenhum (atualizar manualmente)</option>
            <option value="weight">Peso atual (Corpo)</option>
            <option value="books">Livros lidos no ano (Biblioteca)</option>
            <option value="finance_saved">Saldo total (Finanças)</option>
            <option value="study_hours">Horas de estudo totais</option>
          </select>
        </Field>
        <Field label="Data limite">
          <input className={inpCls} type="date" value={f.deadline ?? ""} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
        </Field>
        <Field label="Motivação — por que isso importa?">
          <textarea className={inpCls} rows={3} value={f.motivation ?? ""} onChange={(e) => setF({ ...f, motivation: e.target.value })} />
        </Field>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-sm">Cancelar</button>
          <button type="submit" className={btnGold}>Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

function emptyDaily(): Omit<GoalDaily, "id"> {
  return { name: "", area: "Geral", linkedGoalId: null, suggestedTime: "", daysOfWeek: [1,2,3,4,5] };
}

function DailyTab() {
  const { goalsDaily, goalsMacro, completions, addGoalDaily, updateGoalDaily, removeGoalDaily, toggleCompletion } = useStore();
  const [editing, setEditing] = useState<GoalDaily | null>(null);
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  const todayDow = new Date().getDay();

  const todayActions = goalsDaily.filter((a) => a.daysOfWeek.includes(todayDow));
  const doneIds = new Set(completions.filter((c) => c.date === today).map((c) => c.actionId));
  const completed = todayActions.filter((a) => doneIds.has(a.id)).length;

  const sorted = useMemo(() => {
    return [...todayActions].sort((a, b) => {
      const ad = doneIds.has(a.id) ? 1 : 0;
      const bd = doneIds.has(b.id) ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return (a.suggestedTime || "").localeCompare(b.suggestedTime || "");
    });
  }, [todayActions, doneIds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={() => setCreating(true)} className={btnGold + " inline-flex items-center gap-2"}>
          <Plus size={16} /> Nova Ação
        </button>
        <div className="text-sm text-muted-foreground">
          <span className="text-gold font-semibold">{completed}</span> de {todayActions.length} ações concluídas hoje
        </div>
      </div>

      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-gold transition-all" style={{ width: `${todayActions.length ? (completed / todayActions.length) * 100 : 0}%` }} />
      </div>

      <GlassCard className="space-y-2">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ação para hoje. Crie uma rotina!</p>}
        {sorted.map((a) => {
          const done = doneIds.has(a.id);
          const linked = goalsMacro.find((g) => g.id === a.linkedGoalId);
          return (
            <div key={a.id} className={`group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition ${done ? "opacity-50" : ""}`}>
              <button
                onClick={() => toggleCompletion(a.id, today)}
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition shrink-0 ${done ? "bg-emerald-bgt border-emerald-bgt" : "border-white/20 hover:border-gold"}`}
              >
                {done && <Check size={14} className="text-black" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${done ? "line-through" : ""}`}>{a.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded ${AREA_COLORS[a.area]} text-[10px]`}>{a.area}</span>
                  {a.suggestedTime && <span>⏰ {a.suggestedTime}</span>}
                  {linked && <span className="italic">→ {linked.name}</span>}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 md:opacity-0 transition">
                <button onClick={() => setEditing(a)} className="p-1.5 rounded hover:bg-white/10 text-muted-foreground"><Pencil size={14} /></button>
                <ConfirmButton onConfirm={() => removeGoalDaily(a.id)} className="p-1.5 rounded hover:bg-white/10 text-coral"><Trash2 size={14} /></ConfirmButton>
              </div>
            </div>
          );
        })}
      </GlassCard>

      <Heatmap />

      <DailyFormModal
        open={creating || !!editing}
        initial={editing ?? emptyDaily()}
        title={editing ? "Editar Ação" : "Nova Ação"}
        macros={goalsMacro}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(data) => {
          if (editing) updateGoalDaily(editing.id, data);
          else addGoalDaily(data);
          setCreating(false); setEditing(null);
        }}
      />
    </div>
  );
}

function DailyFormModal({
  open, onClose, onSave, initial, title, macros,
}: {
  open: boolean; onClose: () => void; title: string;
  onSave: (g: Omit<GoalDaily, "id">) => void;
  initial: Omit<GoalDaily, "id">;
  macros: GoalMacro[];
}) {
  const [f, setF] = useState(initial);
  useMemo(() => setF(initial), [initial]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); if (f.name) onSave(f); }} className="space-y-3">
        <Field label="Nome da ação">
          <input className={inpCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Área">
            <select className={inpCls} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as GoalArea })}>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Horário sugerido">
            <input className={inpCls} type="time" value={f.suggestedTime ?? ""} onChange={(e) => setF({ ...f, suggestedTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Vincular meta macro (opcional)">
          <select className={inpCls} value={f.linkedGoalId ?? ""} onChange={(e) => setF({ ...f, linkedGoalId: e.target.value || null })}>
            <option value="">Nenhuma</option>
            {macros.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Dias da semana">
          <div className="flex gap-1 flex-wrap">
            {WEEKDAYS.map((d, i) => {
              const active = f.daysOfWeek.includes(i);
              return (
                <button type="button" key={i}
                  onClick={() => setF({ ...f, daysOfWeek: active ? f.daysOfWeek.filter((x) => x !== i) : [...f.daysOfWeek, i] })}
                  className={`px-3 py-1.5 rounded-lg text-xs transition ${active ? "bg-gold text-[#0A0F1E] font-semibold" : "bg-white/5 hover:bg-white/10"}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-sm">Cancelar</button>
          <button type="submit" className={btnGold}>Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Heatmap() {
  const { goalsDaily, completions } = useStore();
  const [hoveredDay, setHoveredDay] = useState<{ date: string; done: number; planned: number; ratio: number } | null>(null);

  // Generate last 14 weeks (98 days) aligned with Sunday..Saturday
  const { weeks, stats } = useMemo(() => {
    const today = new Date();
    const days: { date: string; done: number; planned: number; ratio: number; dow: number }[] = [];

    // Calculate start date to align with Sunday (14 weeks ago)
    const totalDays = 14 * 7;
    const todayDow = today.getDay();
    const daysBack = totalDays - 1 - (6 - todayDow);

    let totalDone = 0;
    let totalPlanned = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (let i = daysBack; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      const planned = goalsDaily.filter((a) => a.daysOfWeek.includes(dow)).length;
      const done = completions.filter((c) => c.date === iso).length;
      const ratio = planned > 0 ? Math.min(1, done / planned) : done > 0 ? 1 : 0;

      days.push({ date: iso, done, planned, ratio, dow });
      totalDone += done;
      totalPlanned += planned;

      if (ratio >= 0.5) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else if (i > 0) {
        tempStreak = 0;
      }
    }

    // Current streak ending today/yesterday
    let streakCount = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].ratio >= 0.5) {
        streakCount++;
      } else if (i === days.length - 1 && days[i].ratio === 0) {
        // today might not be finished yet
        continue;
      } else {
        break;
      }
    }
    currentStreak = streakCount;

    // Group into columns of 7 days
    const weekCols: { monthLabel?: string; days: typeof days }[] = [];
    let currentWeek: typeof days = [];
    let lastMonth = "";

    days.forEach((day, idx) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || idx === days.length - 1) {
        const firstDayDate = new Date(currentWeek[0].date + "T12:00:00");
        const monthName = firstDayDate.toLocaleDateString("pt-BR", { month: "short" });
        const isNewMonth = monthName !== lastMonth;
        if (isNewMonth) lastMonth = monthName;

        weekCols.push({
          monthLabel: isNewMonth ? monthName.replace(".", "") : undefined,
          days: currentWeek,
        });
        currentWeek = [];
      }
    });

    const consistencyRate = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;

    return {
      weeks: weekCols,
      stats: { totalDone, consistencyRate, currentStreak, bestStreak },
    };
  }, [goalsDaily, completions]);

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="font-display font-semibold text-base flex items-center gap-2">
            <span>🔥</span> Consistência &amp; Hábitos (Últimas 14 Semanas)
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.totalDone} hábitos concluídos • Taxa de consistência de {stats.consistencyRate}%
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            <span className="text-gold font-bold">⚡ {stats.currentStreak}d</span>
            <span className="text-muted-foreground">streak atual</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>menos</span>
            {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
              <span key={i} className="w-3 h-3 rounded-sm border border-black/20" style={{ background: colorFor(r) }} />
            ))}
            <span>mais</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col min-w-full">
          {/* Month headers */}
          <div className="flex pl-8 mb-1 text-[10px] text-muted-foreground font-medium">
            {weeks.map((w, idx) => (
              <div key={idx} className="w-4 shrink-0 mr-1 text-center">
                {w.monthLabel ? <span className="capitalize">{w.monthLabel}</span> : null}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Weekday axis */}
            <div className="flex flex-col justify-between pr-2 text-[9px] text-muted-foreground h-[116px] select-none">
              <span>Dom</span>
              <span>Ter</span>
              <span>Qui</span>
              <span>Sáb</span>
            </div>

            {/* Grid of squares */}
            <div className="flex gap-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.days.map((day) => (
                    <button
                      key={day.date}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      title={`${day.date}: ${day.done}/${day.planned} (${Math.round(day.ratio * 100)}%)`}
                      className="w-3.5 h-3.5 rounded-sm transition-transform hover:scale-125 hover:z-10 focus:outline-none"
                      style={{ background: colorFor(day.ratio) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hoveredDay && (
        <div className="text-xs bg-white/5 border border-white/10 rounded-lg p-2.5 flex items-center justify-between text-muted-foreground animate-fadeIn">
          <div>
            <span className="font-semibold text-foreground">{hoveredDay.date}</span>: {hoveredDay.done} de {hoveredDay.planned} ações concluídas
          </div>
          <span className="font-bold text-gold">{Math.round(hoveredDay.ratio * 100)}% de sucesso</span>
        </div>
      )}
    </GlassCard>
  );
}

function colorFor(r: number) {
  if (r === 0) return "rgba(255, 255, 255, 0.05)";
  if (r <= 0.25) return "rgba(139, 92, 246, 0.3)";
  if (r <= 0.5) return "rgba(139, 92, 246, 0.6)";
  if (r < 1) return "rgba(168, 85, 247, 0.85)";
  return "#A855F7";
}