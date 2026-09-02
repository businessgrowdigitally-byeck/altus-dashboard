import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, type StudyEntry } from "@/lib/store";
import { daysAgoISO, fmtDate, STUDY_AREAS, STUDY_TYPES, todayISO } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { GlassCard, KpiCard, PageHeader, Section } from "@/components/primitives";
import { Pencil, Trash2, Search } from "lucide-react";
import { Modal, ConfirmButton, inpCls, btnGold } from "@/components/Modal";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/estudos")({ component: Estudos });

type Tab = "trilhas" | "calendario" | "insights" | "diario";

function Estudos() {
  const t = useT();
  const { studies, addStudy, updateStudy, removeStudy } = useStore();
  const [page, setPage] = useState(1);
  const [editingStudy, setEditingStudy] = useState<StudyEntry | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("trilhas");
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("Todos");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // Filtered studies for search + area
  const filteredStudies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return studies.filter((s) => {
      if (filterArea !== "Todos" && s.area !== filterArea) return false;
      if (!q) return true;
      return (
        s.topic.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q) ||
        (s.learned && s.learned.toLowerCase().includes(q)) ||
        (s.insights && s.insights.toLowerCase().includes(q))
      );
    });
  }, [studies, search, filterArea]);

  const grouped = useMemo(() => {
    const sorted = [...filteredStudies].sort((a, b) => b.date.localeCompare(a.date)).slice(0, page * 20);
    const groups = new Map<string, typeof sorted>();
    sorted.forEach((s) => {
      const arr = groups.get(s.date) || [];
      arr.push(s);
      groups.set(s.date, arr);
    });
    return Array.from(groups);
  }, [filteredStudies, page]);

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

  // Trilhas: agrupado por área
  const trilhas = useMemo(() => {
    const map = new Map<string, { area: string; totalHoras: number; emProgresso: StudyEntry[]; concluidos: StudyEntry[] }>();
    filteredStudies.forEach((s) => {
      if (!map.has(s.area)) map.set(s.area, { area: s.area, totalHoras: 0, emProgresso: [], concluidos: [] });
      const g = map.get(s.area)!;
      g.totalHoras += s.duration / 60;
      if (s.status === "progresso") g.emProgresso.push(s);
      else g.concluidos.push(s);
    });
    return Array.from(map.values()).sort((a, b) => b.totalHoras - a.totalHoras);
  }, [filteredStudies]);

  // Calendário 30 dias
  const calendario = useMemo(() => {
    const days: { date: string; count: number; totalMin: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = daysAgoISO(i);
      const dayStudies = filteredStudies.filter((s) => s.date === d);
      days.push({ date: d, count: dayStudies.length, totalMin: dayStudies.reduce((a, s) => a + s.duration, 0) });
    }
    return days;
  }, [filteredStudies]);

  const insightsBank = useMemo(() => {
    return filteredStudies.filter((s) => (s.learned && s.learned.trim()) || (s.insights && s.insights.trim()));
  }, [filteredStudies]);

  const selectedDayStudies = useMemo(() => {
    if (!selectedDate) return [];
    return filteredStudies.filter((s) => s.date === selectedDate);
  }, [filteredStudies, selectedDate]);

  return (
    <div>
      <PageHeader title={t("estudos.pageTitle")} subtitle={t("estudos.pageSubtitle")} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("estudos.kpiEntradas")} value={monthEntries.length} icon="📝" />
        <KpiCard label={t("estudos.kpiHoras")} value={`${hours.toFixed(1)}h`} icon="⏱️" tone="gold" />
        <KpiCard label={t("estudos.kpiStreak")} value={`${streak}d`} icon="🔥" tone="gold" />
        <KpiCard label={t("estudos.kpiProgresso")} value={inProgress} icon="⚡" />
      </div>

      {/* Busca & Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-white placeholder:text-muted-foreground/60"
            placeholder={t("estudos.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-white min-w-[180px]"
          value={filterArea}
          onChange={(e) => {
            setFilterArea(e.target.value);
            setPage(1);
          }}
        >
          <option value="Todos" className="bg-[#0A0F1E]">{t("estudos.filterAll")}</option>
          {STUDY_AREAS.map((a) => (
            <option key={a} value={a} className="bg-[#0A0F1E]">{t("area." + a)}</option>
          ))}
        </select>
      </div>

      {/* Seletor de Abas */}
      <div className="flex gap-2 mt-4 mb-6 overflow-x-auto pb-1">
        {[
          { id: "trilhas" as Tab, label: t("estudos.tabsTrilhas"), icon: "📘" },
          { id: "calendario" as Tab, label: t("estudos.tabsCalendario"), icon: "📅" },
          { id: "insights" as Tab, label: t("estudos.tabsInsights"), icon: "💡" },
          { id: "diario" as Tab, label: t("estudos.tabsDiario"), icon: "📝" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-gold text-[#0A0F1E] font-semibold shadow-lg shadow-gold/20"
                : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border border-white/10"
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          {activeTab === "trilhas" && (
            <div className="space-y-4">
              {trilhas.length === 0 && <p className="text-muted-foreground text-sm py-4">{t("estudos.trilhasEmpty")}</p>}
              {trilhas.map((g) => (
                <GlassCard key={g.area} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gold" /> {t("area." + g.area)}
                    </h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-gold/20 text-gold">{t("estudos.totalHoras", { h: g.totalHoras.toFixed(1) })}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-gold mb-2 flex items-center gap-1">⚡ {t("estudos.emProgresso")} ({g.emProgresso.length})</div>
                      <div className="space-y-2">
                        {g.emProgresso.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                        {g.emProgresso.map((s) => (
                          <div key={s.id} className="p-2 rounded-lg bg-white/5 border border-white/10">
                            <div className="text-sm font-medium truncate">{s.topic}</div>
                            <div className="text-xs text-muted-foreground">{s.duration}min • {fmtDate(s.date)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-emerald-bgt mb-2 flex items-center gap-1">✅ {t("estudos.concluidos")} ({g.concluidos.length})</div>
                      <div className="space-y-2">
                        {g.concluidos.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                        {g.concluidos.map((s) => (
                          <div key={s.id} className="p-2 rounded-lg bg-white/5 border border-white/10">
                            <div className="text-sm font-medium truncate">{s.topic}</div>
                            <div className="text-xs text-muted-foreground">{s.duration}min • {fmtDate(s.date)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {activeTab === "calendario" && (
            <div className="space-y-4">
              <GlassCard>
                <div className="grid grid-cols-7 gap-1.5">
                  {calendario.map((d) => {
                    const isSelected = selectedDate === d.date;
                    const intensity = d.count === 0 ? 0 : d.count === 1 ? 1 : d.count >= 3 ? 3 : 2;
                    const bg = intensity === 0 ? "bg-white/5 border-white/10" : intensity === 1 ? "bg-purple-500/30 border-purple-500/40" : intensity === 2 ? "bg-purple-500/60 border-purple-500/60" : "bg-gold border-gold text-[#0A0F1E]";
                    return (
                      <button
                        key={d.date}
                        onClick={() => setSelectedDate(d.date)}
                        className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-center text-xs transition hover:scale-105 ${bg} ${isSelected ? "ring-2 ring-gold ring-offset-1 ring-offset-background" : ""}`}
                        title={`${fmtDate(d.date)} — ${d.count} estudos, ${d.totalMin}min`}
                      >
                        <span className="text-[10px] opacity-70">{d.date.slice(8)}</span>
                        <span className="font-bold">{d.count > 0 ? `${d.count}` : "·"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-3">
                  <span>menos</span>
                  <span className="w-3 h-3 rounded-sm bg-white/5 border border-white/10" />
                  <span className="w-3 h-3 rounded-sm bg-purple-500/30 border border-purple-500/40" />
                  <span className="w-3 h-3 rounded-sm bg-purple-500/60 border border-purple-500/60" />
                  <span className="w-3 h-3 rounded-sm bg-gold border border-gold" />
                  <span>mais</span>
                </div>
              </GlassCard>
              <GlassCard>
                <h4 className="font-semibold mb-3">{selectedDate ? fmtDate(selectedDate) : t("estudos.selecioneData")}</h4>
                {!selectedDate && <p className="text-sm text-muted-foreground">{t("estudos.selecioneData")}</p>}
                {selectedDate && selectedDayStudies.length === 0 && <p className="text-sm text-muted-foreground">{t("estudos.calendarioEmpty")}</p>}
                <div className="space-y-2">
                  {selectedDayStudies.map((s) => (
                    <div key={s.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="font-medium text-sm">{s.topic}</div>
                      <div className="text-xs text-muted-foreground">{t("area." + s.area)} • {s.duration}min • {t("studyType." + s.type)}</div>
                      {s.learned && <p className="text-xs mt-1 whitespace-pre-wrap">{s.learned}</p>}
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === "insights" && (
            <div className="space-y-3">
              {insightsBank.length === 0 && <p className="text-muted-foreground text-sm py-4">{t("estudos.insightsEmpty")}</p>}
              {insightsBank.map((s) => (
                <GlassCard key={s.id} className="!p-4 hover:border-gold/30 transition">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold">{t("area." + s.area)}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(s.date)} • {s.topic}</span>
                  </div>
                  {s.learned && <p className="text-sm whitespace-pre-wrap">{s.learned}</p>}
                  {s.insights && <div className="mt-2 text-xs text-gold border-l-2 border-gold pl-3 whitespace-pre-wrap">💡 {s.insights}</div>}
                </GlassCard>
              ))}
            </div>
          )}

          {activeTab === "diario" && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold">{t("estudos.diary")}</h2>
              <div className="space-y-4">
                {grouped.map(([date, items]) => (
                  <div key={date}>
                    <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{fmtDate(date)}</div>
                    <div className="space-y-2">
                      {items.map((s) => {
                        const icon = STUDY_TYPES.find((x) => x.id === s.type)?.icon || "📚";
                        return (
                          <GlassCard key={s.id} className="!p-4 group hover:border-gold/30 transition">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold">{s.topic}</h4>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">{t("area." + s.area)}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">{s.duration}min</span>
                                    {s.status === "concluido" ? (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-bgt/20 text-emerald-bgt">{t("estudos.statusConcluido")}</span>
                                    ) : (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold">{t("estudos.statusProgresso")}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                    <button onClick={() => setEditingStudy(s)} title={t("estudos.editarBtn")} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground">
                                      <Pencil size={13} />
                                    </button>
                                    <ConfirmButton onConfirm={() => removeStudy(s.id)} message={t("estudos.confirmDelete", { topic: s.topic })} className="p-1 rounded hover:bg-white/10 text-coral">
                                      <Trash2 size={13} />
                                    </ConfirmButton>
                                  </div>
                                </div>
                                {s.learned && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{s.learned}</p>}
                                {s.insights && <div className="mt-2 text-xs text-gold border-l-2 border-gold pl-3 whitespace-pre-wrap">💡 {s.insights}</div>}
                              </div>
                            </div>
                          </GlassCard>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {grouped.length === 0 && <p className="text-muted-foreground text-sm py-4">{t("estudos.emptyDiary")}</p>}
                {filteredStudies.length > page * 20 && (
                  <button onClick={() => setPage(page + 1)} className="text-sm text-gold hover:underline">{t("estudos.verMais")}</button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <GlassCard>
            <h3 className="font-display font-semibold mb-3">{t("estudos.novaEntrada")}</h3>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.data")}</label>
                <input className={inpCls} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.topico")}</label>
                <input className={inpCls} placeholder="ex: Zustand state management" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t("estudos.area")}</label>
                  <select className={inpCls} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                    {STUDY_AREAS.map((a) => (
                      <option key={a} value={a}>{t("area." + a)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t("estudos.formato")}</label>
                  <select className={inpCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {STUDY_TYPES.map((st) => (
                      <option key={st.id} value={st.id}>{st.icon} {t("studyType." + st.id)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.duracao")}</label>
                <input className={inpCls} type="number" placeholder="ex: 45" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.oQueAprendi")}</label>
                <textarea className={inpCls} rows={3} placeholder="Principais conceitos..." value={form.learned} onChange={(e) => setForm({ ...form, learned: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.insights")}</label>
                <textarea className={inpCls} rows={2} placeholder="Ideias para aplicar..." value={form.insights} onChange={(e) => setForm({ ...form, insights: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.status")}</label>
                <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm">
                  <button type="button" onClick={() => setForm({ ...form, status: "progresso" })} className={`flex-1 py-2 font-medium transition ${form.status === "progresso" ? "bg-gold text-[#0A0F1E]" : "hover:bg-white/5"}`}>
                    {t("estudos.statusProgresso")}
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, status: "concluido" })} className={`flex-1 py-2 font-medium transition ${form.status === "concluido" ? "bg-emerald-bgt text-black" : "hover:bg-white/5"}`}>
                    {t("estudos.statusConcluido")}
                  </button>
                </div>
              </div>
              <button type="submit" className={`${btnGold} w-full`}>{t("estudos.registrar")}</button>
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

      {editingStudy && (
        <Modal open={!!editingStudy} onClose={() => setEditingStudy(null)} title={t("estudos.editar")}>
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
                status: String(fd.get("status") || editingStudy.status) as "progresso" | "concluido",
              });
              setEditingStudy(null);
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("estudos.topico")}</label>
              <input name="topic" defaultValue={editingStudy.topic} className={inpCls} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.data")}</label>
                <input name="date" type="date" defaultValue={editingStudy.date} className={inpCls} required />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.duracao")}</label>
                <input name="duration" type="number" defaultValue={editingStudy.duration} className={inpCls} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.area")}</label>
                <select name="area" defaultValue={editingStudy.area} className={inpCls}>
                  {STUDY_AREAS.map((a) => (
                    <option key={a} value={a}>{t("area." + a)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t("estudos.formato")}</label>
                <select name="type" defaultValue={editingStudy.type} className={inpCls}>
                  {STUDY_TYPES.map((st) => (
                    <option key={st.id} value={st.id}>{st.icon} {t("studyType." + st.id)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("estudos.status")}</label>
              <select name="status" defaultValue={editingStudy.status} className={inpCls}>
                <option value="progresso">{t("estudos.statusProgresso")}</option>
                <option value="concluido">{t("estudos.statusConcluido")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("estudos.oQueAprendi")}</label>
              <textarea name="learned" defaultValue={editingStudy.learned ?? ""} rows={3} className={inpCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("estudos.insights")}</label>
              <textarea name="insights" defaultValue={editingStudy.insights ?? ""} rows={2} className={inpCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingStudy(null)} className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition">
                {t("estudos.cancelar")}
              </button>
              <button type="submit" className={btnGold}>{t("estudos.salvarAlteracoes")}</button>
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
