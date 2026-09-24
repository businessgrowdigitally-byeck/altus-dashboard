import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, type WeightEntry, type Workout } from "@/lib/store";
import { daysAgoISO, fmtDate, kg, toISODate, todayISO } from "@/lib/format";
import { GlassCard, KpiCard, PageHeader, Section } from "@/components/primitives";
import { TaxonomySelect, taxLabel } from "@/components/TaxonomySelect";
import { Activity, Check, Dumbbell, Flame, HeartPulse, Pencil, Timer, Trash2, Trophy } from "lucide-react";
import { Modal, ConfirmButton, inpCls, btnGold } from "@/components/Modal";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const TITLE = "Corpo & Saúde | ALTUS";
const DESCRIPTION = "Acompanhe peso, IMC, constância e evolução dos seus treinos no ALTUS.";

export const Route = createFileRoute("/corpo")({
  component: Corpo,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

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
    addCustomItem,
  } = useStore();
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<"1M" | "3M" | "6M" | "1A" | "ALL">("3M");
  const [workoutMetric, setWorkoutMetric] = useState<"sessions" | "minutes">("sessions");

  const [editingWeight, setEditingWeight] = useState<WeightEntry | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);

  const sorted = useMemo(
    () => [...weights].sort((a, b) => a.date.localeCompare(b.date)),
    [weights],
  );
  const last = sorted[sorted.length - 1];
  const first = sorted[0];

  // Altura vem do perfil. Sem ela não há IMC — nunca invente um valor aqui.
  const height = profile.height;
  const imc = height > 0 && last ? last.weight / (height * height) : 0;
  const imcStatus = imc < 18.5 ? "Atenção" : imc < 25 ? "Normal" : imc < 30 ? "Atenção" : "Cuidado";
  const imcStatusKey =
    imc < 18.5
      ? "corpo.statusAtencao"
      : imc < 25
        ? "corpo.statusNormal"
        : imc < 30
          ? "corpo.statusAtencao"
          : "corpo.statusCuidado";

  const goal = profile.goalWeight;
  const goalProgress =
    first && last && first.weight !== goal
      ? Math.max(0, Math.min(100, ((first.weight - last.weight) / (first.weight - goal)) * 100))
      : 0;
  const variation = last && first ? last.weight - first.weight : 0;

  const chartData = useMemo(() => {
    const days = { "1M": 30, "3M": 90, "6M": 180, "1A": 365, ALL: 99999 }[filter];
    const cutoff = daysAgoISO(days);
    return sorted
      .filter((w) => w.date >= cutoff)
      .map((w) => ({ date: w.date.slice(5), peso: w.weight }));
  }, [sorted, filter]);

  const [wf, setWf] = useState({ weight: "", date: todayISO(), notes: "" });
  const submitWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(wf.weight.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error(t("corpo.toastPesoInvalido"));
      return;
    }
    addWeight({ weight: v, date: wf.date, notes: wf.notes });
    setWf({ weight: "", date: todayISO(), notes: "" });
    toast.success(t("corpo.toastPesoRegistrado"));
  };

  const historyRows = useMemo(() => {
    const desc = [...weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    return desc.map((w, i) => {
      const next = desc[i + 1];
      return { ...w, delta: next ? w.weight - next.weight : 0 };
    });
  }, [weights]);

  const [wo, setWo] = useState({ date: todayISO(), type: "Musculação", duration: "", notes: "" });

  const workoutInsights = useMemo(() => {
    const uniqueDates = [...new Set(workouts.map((workout) => workout.date))].sort();
    const dateSet = new Set(uniqueDates);
    const reference = new Date(`${todayISO()}T12:00:00`);
    if (!dateSet.has(toISODate(reference))) reference.setDate(reference.getDate() - 1);

    let currentStreak = 0;
    const cursor = new Date(reference);
    while (dateSet.has(toISODate(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    let bestStreak = 0;
    let runningStreak = 0;
    let previous: Date | null = null;
    uniqueDates.forEach((date) => {
      const current = new Date(`${date}T12:00:00`);
      const gap = previous ? Math.round((current.getTime() - previous.getTime()) / 86_400_000) : 0;
      runningStreak = previous && gap === 1 ? runningStreak + 1 : 1;
      bestStreak = Math.max(bestStreak, runningStreak);
      previous = current;
    });

    const today = new Date(`${todayISO()}T12:00:00`);
    const startOfWeek = new Date(today);
    const mondayOffset = (today.getDay() + 6) % 7;
    startOfWeek.setDate(today.getDate() - mondayOffset);
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      const iso = toISODate(date);
      return { iso, label: new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(date), day: date.getDate(), trained: dateSet.has(iso), future: date > today };
    });
    const thisWeek = weekDays.filter((day) => day.trained).length;

    const weekly = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(startOfWeek);
      start.setDate(startOfWeek.getDate() - (5 - index) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const inWeek = workouts.filter((workout) => workout.date >= toISODate(start) && workout.date <= toISODate(end));
      return {
        week: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(start),
        sessions: inWeek.length,
        minutes: inWeek.reduce((total, workout) => total + workout.duration, 0),
      };
    });

    return { currentStreak, bestStreak, thisWeek, weekDays, weekly };
  }, [locale, workouts]);
  const submitWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseInt(wo.duration, 10);
    if (!Number.isFinite(d) || d <= 0) {
      toast.error(t("corpo.toastDuracaoTreino"));
      return;
    }
    addWorkout({ date: wo.date, type: wo.type, duration: d, notes: wo.notes });
    setWo({ date: todayISO(), type: "Musculação", duration: "", notes: "" });
    toast.success(t("corpo.toastTreinoSalvo"));
  };

  return (
    <div>
      <PageHeader title={t("corpo.pageTitle")} subtitle={t("corpo.pageSubtitle")} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t("corpo.pesoAtual")}
          value={last ? kg(last.weight) : "—"}
          icon="⚖️"
          tone="gold"
        />
        <KpiCard
          label={t("corpo.imc")}
          value={imc ? imc.toFixed(1) : "—"}
          icon="📊"
          delta={
            imc
              ? t(imcStatusKey)
              : height > 0
                ? t("corpo.registreSeuPeso")
                : t("corpo.informeSuaAltura")
          }
          tone={
            !imc
              ? "default"
              : imcStatus === "Normal"
                ? "positive"
                : imcStatus === "Cuidado"
                  ? "negative"
                  : "default"
          }
        />
        <KpiCard
          label={t("corpo.metaDePeso")}
          value={`${goal} kg`}
          icon="🎯"
          delta={t("corpo.percentOfWay", { v: goalProgress.toFixed(0) })}
        />
        <KpiCard
          label={t("corpo.variacaoTotal")}
          value={`${variation >= 0 ? "+" : ""}${variation.toFixed(1)} kg`}
          icon={variation >= 0 ? "↑" : "↓"}
          tone={variation <= 0 ? "positive" : "negative"}
        />
      </div>

      <Section title={t("corpo.evoluçãoDoPeso")}>
        <GlassCard>
          <div className="flex gap-2 mb-3">
            {(["1M", "3M", "6M", "1A", "ALL"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs transition ${filter === f ? "bg-gold text-[#0A0F1E] font-semibold" : "bg-muted/50 hover:bg-muted/80"}`}
              >
                {f === "ALL" ? t("corpo.tudo") : f}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="date" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} domain={["auto", "auto"]} />
              <Tooltip contentStyle={ttStyle} />
              <ReferenceLine
                y={goal}
                stroke="#F5C842"
                strokeDasharray="5 5"
                label={{ value: t("corpo.meta"), fill: "#F5C842", fontSize: 11 }}
              />
              <Line type="monotone" dataKey="peso" stroke="#2ECC71" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </Section>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <GlassCard>
          <h3 className="font-display font-semibold mb-4">{t("corpo.registrarPeso")}</h3>
          <form onSubmit={submitWeight} className="space-y-3">
            <input
              className={inpCls}
              type="number"
              step="0.1"
              placeholder={t("corpo.pesoKg")}
              value={wf.weight}
              onChange={(e) => setWf({ ...wf, weight: e.target.value })}
              required
            />
            <input
              className={inpCls}
              type="date"
              value={wf.date}
              onChange={(e) => setWf({ ...wf, date: e.target.value })}
              required
            />
            <textarea
              className={inpCls}
              placeholder={`${t("common.notes")} (${t("common.optional")})`}
              rows={3}
              value={wf.notes}
              onChange={(e) => setWf({ ...wf, notes: e.target.value })}
            />
            <button className={`${btnGold} w-full`}>{t("corpo.registrarPeso")}</button>
          </form>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-semibold mb-4">{t("corpo.historicoDePeso")}</h3>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-1">{t("common.date")}</th>
                  <th className="text-right py-1">{t("corpo.peso")}</th>
                  <th className="text-right py-1">Δ</th>
                  <th className="text-left py-1 pl-3">{t("corpo.obs")}</th>
                  <th className="text-right py-1">{t("corpo.acoes")}</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted-foreground text-xs">
                      {t("corpo.nenhumPesoRegistrado")}
                    </td>
                  </tr>
                )}
                {historyRows.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-border group hover:bg-muted/50 transition"
                  >
                    <td className="py-2">{fmtDate(w.date)}</td>
                    <td className="text-right font-medium">{kg(w.weight)}</td>
                    <td
                      className={`text-right ${w.delta > 0 ? "text-coral" : w.delta < 0 ? "text-emerald-bgt" : ""}`}
                    >
                      {w.delta ? (w.delta > 0 ? "+" : "") + w.delta.toFixed(1) : "—"}
                    </td>
                    <td className="text-xs text-muted-foreground pl-3 truncate max-w-[100px]">
                      {w.notes || "—"}
                    </td>
                    <td className="text-right py-1">
                      <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => setEditingWeight(w)}
                          title={t("common.edit")}
                          className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil size={13} />
                        </button>
                        <ConfirmButton
                          onConfirm={() => removeWeight(w.id)}
                          message={t("corpo.confirmExcluirPeso")}
                          className="p-1 rounded hover:bg-muted/80 text-coral"
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

      <Section title={t("corpo.resumoDeTreinos")}>
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
          <GlassCard className="relative overflow-hidden border-primary/20 bg-primary/5 hover:border-primary/30">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Flame className="size-4 text-gold" />
                  {t("corpo.constancia")}
                </div>
                <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  {workoutInsights.thisWeek} {t("corpo.treinos")}
                </span>
              </div>
              <div className="mt-5 flex items-end gap-2">
                <strong className="font-display text-5xl leading-none text-foreground">{workoutInsights.currentStreak}</strong>
                <span className="pb-1 text-sm text-muted-foreground">{t("corpo.diasSeguidosLabel")}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {workoutInsights.currentStreak ? t("corpo.continueAssim") : t("corpo.comeceSequencia")}
              </p>
              <div className="mt-5 grid grid-cols-7 gap-1.5" aria-label={t("corpo.frequenciaSemanal")}>
                {workoutInsights.weekDays.map((day) => (
                  <div key={day.iso} className="text-center">
                    <span className="mb-2 block text-[10px] font-semibold uppercase text-muted-foreground">{day.label}</span>
                    <div className={`mx-auto flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition ${day.trained ? "border-success bg-success text-primary-foreground shadow-[0_0_18px_color-mix(in_oklch,var(--success)_35%,transparent)]" : day.future ? "border-border bg-muted/20 text-muted-foreground/50" : "border-border bg-muted/50 text-muted-foreground"}`}>
                      {day.trained ? <Check className="size-4" strokeWidth={3} /> : day.day}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 divide-x divide-border border-t border-border pt-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Trophy className="size-3.5 text-gold" />{t("corpo.melhorSequencia")}</div>
                  <div className="mt-1 font-display text-xl font-semibold">{workoutInsights.bestStreak} {t("corpo.dias")}</div>
                </div>
                <div className="pl-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="size-3.5 text-success" />{t("corpo.frequenciaSemanal")}</div>
                  <div className="mt-1 font-display text-xl font-semibold">{workoutInsights.thisWeek}<span className="text-sm text-muted-foreground">/7</span></div>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold">{t("corpo.progressoTreinos")}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("corpo.ultimasSemanas")}</p>
              </div>
              <div className="flex rounded-lg border border-border bg-muted/30 p-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setWorkoutMetric("sessions")} className={workoutMetric === "sessions" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}>{t("corpo.sessoes")}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setWorkoutMetric("minutes")} className={workoutMetric === "minutes" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}>{t("corpo.minutos")}</Button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={workoutInsights.weekly} barCategoryGap="32%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.55} />
                <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={ttStyle} cursor={{ fill: "var(--muted)", opacity: 0.25 }} />
                <Bar dataKey={workoutMetric} fill="var(--success)" radius={[5, 5, 2, 2]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          <GlassCard>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Dumbbell className="size-4" /></div>
              <h3 className="font-display font-semibold">{t("corpo.registrarTreino")}</h3>
            </div>
            <form onSubmit={submitWorkout} className="space-y-3">
              <input
                className={inpCls}
                type="date"
                value={wo.date}
                onChange={(e) => setWo({ ...wo, date: e.target.value })}
                required
              />
              <TaxonomySelect
                scope="workoutTypes"
                value={wo.type}
                onChange={(v) => setWo({ ...wo, type: v })}
                onAdd={addCustomItem}
                className={inpCls}
              />
              <input
                className={inpCls}
                type="number"
                placeholder={t("corpo.duracaoMinutos")}
                value={wo.duration}
                onChange={(e) => setWo({ ...wo, duration: e.target.value })}
                required
              />
              <textarea
                className={inpCls}
                rows={2}
                placeholder={t("corpo.notasPlaceholder")}
                value={wo.notes}
                onChange={(e) => setWo({ ...wo, notes: e.target.value })}
              />
              <button className={`${btnGold} w-full`}>{t("corpo.salvarTreino")}</button>
            </form>
          </GlassCard>
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display font-semibold">{t("corpo.ultimosTreinos")}</h3>
              <span className="text-xs text-muted-foreground">{workouts.length} {t("corpo.treinos")}</span>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {workouts.slice(0, 10).map((w) => (
                <div
                  key={w.id}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 transition hover:border-primary/25 hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {w.type.toLowerCase().includes("cardio") ? <HeartPulse className="size-4" /> : <Dumbbell className="size-4" />}
                    </div>
                    <div className="min-w-0">
                    <div className="text-sm font-medium">{taxLabel(t, "workout.", w.type)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{fmtDate(w.date)}</span><span className="flex items-center gap-1"><Timer className="size-3" />{w.duration} min</span>{w.notes && <span className="truncate">{w.notes}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 hidden items-center gap-1 text-[10px] font-semibold text-success sm:flex"><Check className="size-3" />{t("corpo.concluido")}</span>
                    <button
                      onClick={() => setEditingWorkout(w)}
                      title={t("common.edit")}
                      className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={14} />
                    </button>
                    <ConfirmButton
                      onConfirm={() => removeWorkout(w.id)}
                      message={t("corpo.confirmExcluirTreino")}
                      className="p-1 rounded hover:bg-muted/80 text-coral"
                    >
                      <Trash2 size={14} />
                    </ConfirmButton>
                  </div>
                </div>
              ))}
              {workouts.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("corpo.nenhumTreinoRegistrado")}</p>
              )}
            </div>
          </GlassCard>
        </div>
      </Section>

      {/* Modal Editar Peso */}
      {editingWeight && (
        <Modal
          open={!!editingWeight}
          onClose={() => setEditingWeight(null)}
          title={t("corpo.editarPeso")}
        >
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
              <label className="text-xs text-muted-foreground block mb-1">
                {t("corpo.pesoKg")}
              </label>
              <input
                name="weight"
                type="number"
                step="0.1"
                defaultValue={editingWeight.weight}
                className={inpCls}
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("common.date")}</label>
              <input
                name="date"
                type="date"
                defaultValue={editingWeight.date}
                className={inpCls}
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("common.notes")}
              </label>
              <textarea
                name="notes"
                defaultValue={editingWeight.notes ?? ""}
                rows={3}
                className={inpCls}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingWeight(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition"
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className={btnGold}>
                {t("common.saveChanges")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Editar Treino */}
      {editingWorkout && (
        <Modal
          open={!!editingWorkout}
          onClose={() => setEditingWorkout(null)}
          title={t("corpo.editarTreino")}
        >
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
              <label className="text-xs text-muted-foreground block mb-1">
                {t("corpo.tipoDeTreino")}
              </label>
              <TaxonomySelect
                  scope="workoutTypes"
                  name="type"
                  defaultValue={editingWorkout.type}
                  onAdd={addCustomItem}
                  className={inpCls}
                />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("corpo.duracaoMinutos")}
              </label>
              <input
                name="duration"
                type="number"
                defaultValue={editingWorkout.duration}
                className={inpCls}
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("common.date")}</label>
              <input
                name="date"
                type="date"
                defaultValue={editingWorkout.date}
                className={inpCls}
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("common.notes")}
              </label>
              <textarea
                name="notes"
                defaultValue={editingWorkout.notes ?? ""}
                rows={2}
                className={inpCls}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingWorkout(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition"
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className={btnGold}>
                {t("common.saveChanges")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const ttStyle = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};
