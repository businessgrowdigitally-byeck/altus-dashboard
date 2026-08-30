import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, type StudyEntry } from "@/lib/store";
import { daysAgoISO, fmtDate, STUDY_AREAS, STUDY_TYPES, todayISO } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { GlassCard, KpiCard, PageHeader, Section } from "@/components/primitives";
import { Pencil, Trash2 } from "lucide-react";
import { Modal, ConfirmButton, inpCls, btnGold } from "@/components/Modal";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/estudos")({ component: Estudos });

function Estudos() {
  const t = useT();
  const { studies, addStudy, updateStudy, removeStudy } = useStore();
  const [page, setPage] = useState(1);
  const [editingStudy, setEditingStudy] = useState<StudyEntry | null>(null);

  const month = todayISO().slice(0, 7);
  const monthEntries = studies.filter((s) => s.date.startsWith(month));
  const hours = monthEntries.reduce((a, s) => a + s.duration, 0) / 60;

  const streak = useMemo(() => {
    const days = new Set(studies.map((s) => s.date));
    let n = 0;
    for (let i = 0; i < 365; i++) {
      const d = daysAgoISO(i);
      if (days.has(d)) n++;
      else if (i > 0) break;
    }
    return n;
  }, [studies]);

  const inProgress = studies.filter((s) => s.status === "progresso").length;

  const [form, setForm] = useState({
    date: todayISO(),
    topic: "",
    area: "Tecnologia",
    type: "Leitura",
    duration: "",
    learned: "",
    insights: "",
    status: "progresso" as "progresso" | "concluido",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseInt(form.duration, 10);
    if (!form.topic.trim()) {
      toast.error(t("estudos.toastTema"));
      return;
    }
    if (!Number.isFinite(d) || d <= 0) {
      toast.error(t("estudos.toastDuracao"));
      return;
    }
    addStudy({ ...form, duration: d });
    setForm({ ...form, topic: "", duration: "", learned: "", insights: "" });
    toast.success(t("estudos.toastRegistrado"));
  };

  const grouped = useMemo(() => {
    const sorted = [...studies].sort((a, b) => b.date.localeCompare(a.date)).slice(0, page * 20);
    const groups = new Map<string, typeof sorted>();
    sorted.forEach((s) => {
      const arr = groups.get(s.date) || [];
      arr.push(s);
      groups.set(s.date, arr);
    });
    return Array.from(groups);
  }, [studies, page]);

  const byArea = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries.forEach((s) => map.set(s.area, (map.get(s.area) || 0) + s.duration));
    return Array.from(map, ([area, mins]) => ({ area, horas: +(mins / 60).toFixed(1) }));
  }, [monthEntries]);

  const weekly = useMemo(() => {
    const arr: { sem: string; horas: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const startISO = daysAgoISO(i * 7);
      const endISO = daysAgoISO(i * 7 - 7);
      const mins = studies
        .filter((s) => s.date >= startISO && s.date < endISO)
        .reduce((a, s) => a + s.duration, 0);
      arr.push({ sem: startISO.slice(5), horas: +(mins / 60).toFixed(1) });
    }
    return arr;
  }, [studies]);

  return (
    <div>
      <PageHeader title={t("estudos.pageTitle")} subtitle={t("estudos.pageSubtitle")} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("estudos.kpiEntradas")} value={monthEntries.length} icon="📝" />
        <KpiCard
          label={t("estudos.kpiHoras")}
          value={`${hours.toFixed(1)}h`}
          icon="⏱️"
          tone="gold"
        />
        <KpiCard label={t("estudos.kpiStreak")} value={`${streak}d`} icon="🔥" tone="gold" />
        <KpiCard label={t("estudos.kpiProgresso")} value={inProgress} icon="⚡" />
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mt-6">
        <div className="lg:col-span-3">
          <h2 className="font-display text-xl font-semibold mb-3">{t("estudos.diary")}</h2>
          <div className="space-y-4">
            {grouped.map(([date, items]) => (
              <div key={date}>
                <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  {fmtDate(date)}
                </div>
                <div className="space-y-2">
                  {items.map((s) => {
                    const icon = STUDY_TYPES.find((t) => t.id === s.type)?.icon || "📚";
                    return (
                      <GlassCard key={s.id} className="!p-4 group hover:border-gold/30 transition">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold">{s.topic}</h4>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
                                  {s.area}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
                                  {s.duration}min
                                </span>
                                {s.status === "concluido" ? (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-bgt/20 text-emerald-bgt">
                                    {t("estudos.statusConcluido")}
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold">
                                    {t("estudos.statusProgresso")}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button
                                  onClick={() => setEditingStudy(s)}
                                  title={t("estudos.editarBtn")}
                                  className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil size={13} />
                                </button>
                                <ConfirmButton
                                  onConfirm={() => removeStudy(s.id)}
                                  message={t("estudos.confirmDelete", { topic: s.topic })}
                                  className="p-1 rounded hover:bg-white/10 text-coral"
                                >
                                  <Trash2 size={13} />
                                </ConfirmButton>
                              </div>
                            </div>
                            {s.learned && (
                              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                                {s.learned}
                              </p>
                            )}
                            {s.insights && (
                              <div className="mt-2 text-xs text-gold border-l-2 border-gold pl-3 whitespace-pre-wrap">
                                💡 {s.insights}
                              </div>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="text-muted-foreground text-sm py-4">{t("estudos.emptyDiary")}</p>
            )}
            {studies.length > page * 20 && (
              <button
                onClick={() => setPage(page + 1)}
                className="text-sm text-gold hover:underline"
              >
                {t("estudos.verMais")}
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <GlassCard>
            <h3 className="font-display font-semibold mb-3">{t("estudos.novaEntrada")}</h3>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.data")}
                </label>
                <input
                  className={inpCls}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.topico")}
                </label>
                <input
                  className={inpCls}
                  placeholder="ex: Zustand state management"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {t("estudos.area")}
                  </label>
                  <select
                    className={inpCls}
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  >
                    {STUDY_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {t("area." + a)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {t("estudos.formato")}
                  </label>
                  <select
                    className={inpCls}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {STUDY_TYPES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.icon} {t("studyType." + st.id)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.duracao")}
                </label>
                <input
                  className={inpCls}
                  type="number"
                  placeholder="ex: 45"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.oQueAprendi")}
                </label>
                <textarea
                  className={inpCls}
                  rows={3}
                  placeholder="Principais conceitos..."
                  value={form.learned}
                  onChange={(e) => setForm({ ...form, learned: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.insights")}
                </label>
                <textarea
                  className={inpCls}
                  rows={2}
                  placeholder="Ideias para aplicar..."
                  value={form.insights}
                  onChange={(e) => setForm({ ...form, insights: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.status")}
                </label>
                <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: "progresso" })}
                    className={`flex-1 py-2 font-medium transition ${form.status === "progresso" ? "bg-gold text-[#0A0F1E]" : "hover:bg-white/5"}`}
                  >
                    {t("estudos.statusProgresso")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: "concluido" })}
                    className={`flex-1 py-2 font-medium transition ${form.status === "concluido" ? "bg-emerald-bgt text-black" : "hover:bg-white/5"}`}
                  >
                    {t("estudos.statusConcluido")}
                  </button>
                </div>
              </div>
              <button type="submit" className={`${btnGold} w-full`}>
                {t("estudos.registrar")}
              </button>
            </form>
          </GlassCard>

          <GlassCard>
            <h3 className="font-display font-semibold mb-3">{t("estudos.minhasAreas")}</h3>
            {byArea.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("estudos.semDados")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byArea} layout="vertical">
                  <CartesianGrid strokeOpacity={0.1} />
                  <XAxis type="number" fontSize={10} stroke="#888" />
                  <YAxis type="category" dataKey="area" fontSize={10} stroke="#888" width={70} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="horas" fill="#2ECC71" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>
      </div>

      <Section title={t("estudos.horasSemana")}>
        <GlassCard>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="sem" fontSize={11} stroke="#888" />
              <YAxis fontSize={11} stroke="#888" />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="horas" fill="#F5C842" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </Section>

      {/* Modal Editar Estudo */}
      {editingStudy && (
        <Modal
          open={!!editingStudy}
          onClose={() => setEditingStudy(null)}
          title={t("estudos.editar")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateStudy(editingStudy.id, {
                topic: String(fd.get("topic") || editingStudy.topic),
                date: String(fd.get("date") || editingStudy.date),
                area: String(fd.get("area") || editingStudy.area),
                type: String(fd.get("type") || editingStudy.type),
                duration: parseInt(String(fd.get("duration")), 10) || editingStudy.duration,
                learned: String(fd.get("learned") || ""),
                insights: String(fd.get("insights") || ""),
                status: String(fd.get("status") || editingStudy.status) as
                  "progresso" | "concluido",
              });
              setEditingStudy(null);
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("estudos.topico")}
              </label>
              <input name="topic" defaultValue={editingStudy.topic} className={inpCls} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.data")}
                </label>
                <input
                  name="date"
                  type="date"
                  defaultValue={editingStudy.date}
                  className={inpCls}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.duracao")}
                </label>
                <input
                  name="duration"
                  type="number"
                  defaultValue={editingStudy.duration}
                  className={inpCls}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.area")}
                </label>
                <select name="area" defaultValue={editingStudy.area} className={inpCls}>
                  {STUDY_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {t("area." + a)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("estudos.formato")}
                </label>
                <select name="type" defaultValue={editingStudy.type} className={inpCls}>
                  {STUDY_TYPES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.icon} {t("studyType." + st.id)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("estudos.status")}
              </label>
              <select name="status" defaultValue={editingStudy.status} className={inpCls}>
                <option value="progresso">{t("estudos.statusProgresso")}</option>
                <option value="concluido">{t("estudos.statusConcluido")}</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("estudos.oQueAprendi")}
              </label>
              <textarea
                name="learned"
                defaultValue={editingStudy.learned ?? ""}
                rows={3}
                className={inpCls}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("estudos.insights")}
              </label>
              <textarea
                name="insights"
                defaultValue={editingStudy.insights ?? ""}
                rows={2}
                className={inpCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingStudy(null)}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition"
              >
                {t("estudos.cancelar")}
              </button>
              <button type="submit" className={btnGold}>
                {t("estudos.salvarAlteracoes")}
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
