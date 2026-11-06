import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { brl, daysAgoISO, fmtDate, fmtDateLong, greeting, kg, todayISO } from "@/lib/format";
import { balanceUntil, dailyBalanceSeries, monthTotals } from "@/lib/finance";
import { actionStreak, weekProgress } from "@/lib/daily-stats";
import { toast } from "sonner";
import { GlassCard, Section } from "@/components/primitives";
import { GoalsSection, GOALS_SECTION_ID } from "@/components/GoalsSection";
import { PrimaryAreaPicker } from "@/components/PrimaryAreaPicker";
import { Modal, btnGold } from "@/components/Modal";
import {
  Check,
  ArrowRight,
  Brain,
  Sparkles,
  Target,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSyncStatus } from "@/lib/sync";
import { useT } from "@/lib/i18n";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AREA_DEFS, type AreaKey } from "@/lib/areas";
import { AI_AGENT_ENABLED } from "@/lib/features";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import ogImage from "@/assets/altus-og.jpg.asset.json";

const SITE = "https://altus-dashboard.lovable.app";
const OG_IMAGE = `${SITE}${ogImage.url}`;
const TITLE = "ALTUS — Organize. Foque. Conquiste.";
const DESCRIPTION =
  "Painel pessoal que reúne finanças, corpo, leitura, estudos, metas e hábitos diários em um só lugar. Acompanhe seu progresso e evolua todos os dias.";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE}/` }],
  }),
});

function Dashboard() {
  const {
    transactions,
    weights,
    books,
    studies,
    profile,
    goalsMacro,
    goalsDaily,
    completions,
    primaryAreas,
    toggleCompletion,
    setProfile,
    setPrimaryAreas,
    altusGeneralPlan,
  } = useStore();
  const t = useT();

  // Avoid SSR/CSR hydration mismatch: render time-dependent strings only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const now = new Date();
  const monthKey = todayISO().slice(0, 7);
  const yearKey = now.getFullYear();
  const today = todayISO();
  const todayDow = now.getDay();

  // Saldo acumulado (saldo inicial + histórico até hoje): não zera na virada do mês.
  const { income, expense, net: monthNet } = monthTotals(transactions, monthKey);
  const opening = profile.openingBalance ?? 0;
  const balance = balanceUntil(transactions, opening, today);

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const lastW = sortedWeights[sortedWeights.length - 1];
  const weekAgo = daysAgoISO(7);
  const prevW = [...sortedWeights].reverse().find((w) => w.date <= weekAgo);
  const weightDelta = lastW && prevW ? lastW.weight - prevW.weight : 0;

  const booksThisYear = books.filter((b) => b.finishedAt.startsWith(String(yearKey))).length;

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

  // Today actions
  const todayActions = goalsDaily.filter((a) => a.daysOfWeek.includes(todayDow));
  const doneIds = new Set(completions.filter((c) => c.date === today).map((c) => c.actionId));
  const todayDone = todayActions.filter((a) => doneIds.has(a.id)).length;
  // Sem ações hoje não há progresso a mostrar: 0 e estado vazio, nunca um número inventado.
  const weeklyProgress =
    todayActions.length > 0 ? Math.round((todayDone / todayActions.length) * 100) : 0;
  // Marca/desmarca pelo checkbox; ao marcar, o toast permite desfazer por 4 s.
  const toggleAction = (id: string, name: string, wasDone: boolean) => {
    toggleCompletion(id, today);
    if (wasDone) return;
    toast.success(t("homeMarked", { name }), {
      duration: 4000,
      action: {
        label: t("homeUndo"),
        onClick: () => {
          // Só desfaz se ainda estiver marcada (o usuário pode ter desmarcado antes).
          const still = useStore
            .getState()
            .completions.some((c) => c.actionId === id && c.date === today);
          if (still) toggleCompletion(id, today);
        },
      },
    });
  };
  const [goalsTab, setGoalsTab] = useState<{ tab: "macro" | "daily"; nonce: number }>();
  const goToGoals = (tab: "macro" | "daily") => {
    setGoalsTab({ tab, nonce: Date.now() });
    requestAnimationFrame(() =>
      document
        .getElementById(GOALS_SECTION_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const goToCreateAction = () => goToGoals("daily");
  const goToToday = () =>
    document
      .getElementById("sistema-diario")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  // 30-day financial trend
  const finTrend = useMemo(
    () =>
      dailyBalanceSeries(
        transactions,
        opening,
        Array.from({ length: 30 }, (_, i) => daysAgoISO(29 - i)),
      ).map((d) => ({ date: d.date.slice(5), saldo: d.balance })),
    [transactions, opening],
  );

  const weightTrend = useMemo(() => {
    const cutoff = daysAgoISO(60);
    return sortedWeights
      .filter((w) => w.date >= cutoff)
      .map((w) => ({ date: w.date.slice(5), peso: w.weight }));
  }, [sortedWeights]);

  const booksPerMonth = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, i) => ({
      mes: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i],
      livros: 0,
    }));
    books
      .filter((b) => b.finishedAt.startsWith(String(yearKey)))
      .forEach((b) => {
        const m = parseInt(b.finishedAt.slice(5, 7), 10) - 1;
        counts[m].livros++;
      });
    return counts;
  }, [books, yearKey]);

  const studyWeekly = useMemo(() => {
    const buckets: { sem: string; horas: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const startISO = daysAgoISO(i * 7);
      const endISO = daysAgoISO(i * 7 - 7);
      const mins = studies
        .filter((s) => s.date >= startISO && s.date < endISO)
        .reduce((a, s) => a + s.duration, 0);
      buckets.push({ sem: startISO.slice(5), horas: +(mins / 60).toFixed(1) });
    }
    return buckets;
  }, [studies]);

  type Activity = { date: string; icon: string; text: string };
  const recent: Activity[] = useMemo(() => {
    const items: Activity[] = [];
    transactions.slice(0, 10).forEach((tx) =>
      items.push({
        date: tx.date,
        icon: tx.type === "entrada" ? "💰" : "💸",
        text: `${tx.type === "entrada" ? t("entrada") : t("saida")}: ${tx.description} (${brl(tx.value)})`,
      }),
    );
    weights
      .slice(0, 5)
      .forEach((w) =>
        items.push({ date: w.date, icon: "⚖️", text: `${t("weightLogged")} ${kg(w.weight)}` }),
      );
    books
      .slice(0, 5)
      .forEach((b) =>
        items.push({ date: b.finishedAt, icon: "📚", text: `${t("bookDone")} ${b.title}` }),
      );
    studies.slice(0, 5).forEach((s) =>
      items.push({
        date: s.date,
        icon: "🎓",
        text: `${t("studyLabel")} ${s.topic} (${s.duration}min)`,
      }),
    );
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [transactions, weights, books, studies, t]);

  const insights = useMemo(() => {
    const out: string[] = [];
    const sumExp = (from: string, to: string) =>
      transactions
        .filter((t) => t.type === "saida" && t.date >= from && t.date < to)
        .reduce((a, b) => a + b.value, 0);
    // Duas janelas de exatamente 7 dias: a que termina hoje e a anterior a ela.
    const thisWeek = sumExp(daysAgoISO(6), daysAgoISO(-1));
    const prevWeek = sumExp(daysAgoISO(13), daysAgoISO(6));
    if (prevWeek > 0) {
      const diff = Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
      if (diff !== 0)
        out.push(
          diff > 0
            ? t("insight.spentMore", { diff })
            : t("insight.spentLess", { diff: Math.abs(diff) }),
        );
    }
    if (sortedWeights.length >= 2) {
      const first = sortedWeights[0];
      const last = sortedWeights[sortedWeights.length - 1];
      const diff = last.weight - first.weight;
      if (Math.abs(diff) < 0.3) out.push(t("insight.weightStable"));
      else
        out.push(
          t("insight.weightChange", {
            dir: diff > 0 ? "ganhou" : "perdeu",
            kg: Math.abs(diff).toFixed(1),
          }),
        );
    }
    if (booksThisYear > 0) {
      out.push(
        booksThisYear === 1
          ? t("booksOne", { count: booksThisYear, year: yearKey })
          : t("booksMany", { count: booksThisYear, year: yearKey }),
      );
    }
    if (streak > 0)
      out.push(streak === 1 ? t("streakOne", { n: streak }) : t("streakMany", { n: streak }));
    // Só insights reais; a frase genérica aparece apenas quando não há nenhum.
    if (out.length === 0) out.push(t("insight.fallback"));
    return out.slice(0, 3);
  }, [transactions, sortedWeights, booksThisYear, streak, yearKey, t]);

  const { user } = useAuth();
  const { status: syncStatus } = useSyncStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [chartArea, setChartArea] = useState<AreaKey | null>(null);
  const [insight, setInsight] = useState(0);
  const insightIdx = insight < insights.length ? insight : 0;
  // Foco da semana: as metas em foco no P.G.; sem P.G., a frase de sempre.
  const focusText =
    (altusGeneralPlan?.focusGoalIds ?? [])
      .map((id) => goalsMacro.find((g) => g.id === id)?.name)
      .filter(Boolean)
      .join(" · ") || t("consistencia");

  const userName =
    profile.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Visionário";

  // Hierarquia do dashboard: áreas prioritárias primeiro, resto ao final.
  const orderedAreas: AreaKey[] = useMemo(() => {
    const rest = AREA_DEFS.map((d) => d.key).filter((k) => !primaryAreas.includes(k));
    return [...(primaryAreas.length > 0 ? primaryAreas : AREA_DEFS.map((d) => d.key)), ...rest];
  }, [primaryAreas]);

  const kpiOrder = (key: AreaKey) => {
    const i = orderedAreas.indexOf(key);
    return i === -1 ? orderedAreas.length : i;
  };

  const prioritySet = useMemo(() => new Set(primaryAreas), [primaryAreas]);

  // Variações exibidas acima de cada gráfico (mesmos dados dos gráficos).
  const signed = (v: number, fmt: (n: number) => string) =>
    `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v))}`;
  const finDelta =
    finTrend.length > 1 ? finTrend[finTrend.length - 1].saldo - finTrend[0].saldo : 0;
  const weightPeriodDelta =
    weightTrend.length > 1 ? weightTrend[weightTrend.length - 1].peso - weightTrend[0].peso : null;
  const studyHours = +studyWeekly.reduce((a, w) => a + w.horas, 0).toFixed(1);

  const miniCharts: {
    area: AreaKey;
    tab: string;
    title: string;
    summary: string;
    node: React.ReactNode;
  }[] = [
    {
      area: "financas",
      tab: t("homeTabSaldo"),
      title: t("chartSaldo"),
      summary: `${brl(balance)} · ${t("homeDeltaPeriod", { delta: signed(finDelta, brl) })}`,
      node: (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={finTrend}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="date" fontSize={10} stroke="#888" />
              <YAxis fontSize={10} stroke="#888" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => brl(v)} />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      ),
    },
    {
      area: "corpo",
      tab: t("homeTabPeso"),
      title: t("chartPeso"),
      summary: lastW
        ? weightPeriodDelta === null
          ? kg(lastW.weight)
          : `${kg(lastW.weight)} · ${t("homeDeltaPeriod", { delta: signed(weightPeriodDelta, kg) })}`
        : t("deltaNoData"),
      node: (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightTrend}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="date" fontSize={10} stroke="#888" />
              <YAxis domain={["auto", "auto"]} fontSize={10} stroke="#888" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="peso" stroke="#2ECC71" strokeWidth={2.5} dot />
            </LineChart>
          </ResponsiveContainer>
        </>
      ),
    },
    {
      area: "biblioteca",
      tab: t("homeTabLivros"),
      title: t("chartLivros", { year: yearKey }),
      summary: t("homeBooksYear", { n: booksThisYear, year: yearKey }),
      node: (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={booksPerMonth}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="mes" fontSize={10} stroke="#888" />
              <YAxis fontSize={10} stroke="#888" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="livros" fill="#F5C842" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      ),
    },
    {
      area: "estudos",
      tab: t("homeTabEstudos"),
      title: t("chartEstudo"),
      summary: t("homeStudyHours", { h: studyHours }),
      node: (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={studyWeekly}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="sem" fontSize={10} stroke="#888" />
              <YAxis fontSize={10} stroke="#888" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="horas" fill="#A855F7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      ),
    },
  ];

  const visibleCharts = miniCharts
    .filter((k) => prioritySet.has(k.area))
    .sort((a, b) => kpiOrder(a.area) - kpiOrder(b.area));
  const activeChart = visibleCharts.find((c) => c.area === chartArea) ?? visibleCharts[0];

  useEffect(() => {
    if (mounted && syncStatus === "saved" && user) {
      if (!profile.name) {
        const sessionSkipped = sessionStorage.getItem("altus_onboarding_skipped");
        if (!sessionSkipped) {
          setShowOnboarding(true);
        }
      } else if (primaryAreas.length === 0) {
        // conta antiga sem preferência persistida: mantém tudo visível
        setPrimaryAreas(AREA_DEFS.map((d) => d.key));
      }
    }
  }, [mounted, syncStatus, profile.name, primaryAreas.length, user, setPrimaryAreas]);

  const handleOnboardingComplete = (name: string, areas: AreaKey[]) => {
    setProfile({ name });
    setPrimaryAreas(areas.length > 0 ? areas : AREA_DEFS.map((d) => d.key));
    setShowOnboarding(false);
    sessionStorage.removeItem("altus_onboarding_skipped");
  };

  const handleOnboardingSkip = () => {
    if (!profile.name) {
      setProfile({ name: userName });
    }
    setPrimaryAreas(AREA_DEFS.map((d) => d.key));
    setShowOnboarding(false);
    sessionStorage.setItem("altus_onboarding_skipped", "true");
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* a) Cabeçalho compacto: o logo já está na barra do app (celular) e na lateral (computador). */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowAreaPicker(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/40 bg-purple-500/10 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors"
        >
          <Sparkles size={14} />
          {t("homeAreas")}
        </button>
      </div>

      {/* b) Saudação + progresso da semana */}
      <div className="glass-strong rounded-2xl p-4 md:p-5 border border-purple-500/20 relative overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-lg text-foreground truncate">
              {greeting()}, {userName} ☀️
            </h3>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {mounted ? fmtDateLong(now) : t("loadingDate")}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-muted-foreground">{t("weeklyProgress")}</span>
            <div className="font-display text-2xl font-black text-purple-700 dark:text-purple-300">
              {weeklyProgress}%
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden border border-border p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-purple-400 to-indigo-400 shadow-[0_0_12px_rgba(168,85,247,0.8)] transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, weeklyProgress))}%` }}
            />
          </div>
        </div>

        {/* Vocabulário único: Metas (goalsMacro) e Ações (goalsDaily). */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 mt-3 pt-3 border-t border-border text-xs">
          {(
            [
              {
                key: "goals",
                icon: Target,
                label: t("homeCountGoals"),
                value: String(goalsMacro.length),
                onClick: () => goToGoals("macro"),
              },
              {
                key: "actions",
                icon: CheckSquare,
                label: t("homeCountActions"),
                value: String(todayActions.length),
                onClick: goToToday,
              },
              {
                key: "done",
                icon: Sparkles,
                label: t("homeCountDone"),
                value: `${todayDone}/${todayActions.length}`,
                onClick: goToToday,
              },
            ] as const
          ).map(({ key, icon: Icon, label, value, onClick }) => (
            <button
              key={key}
              type="button"
              data-counter={key}
              onClick={onClick}
              className="min-w-0 flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:justify-between p-2 rounded-xl bg-muted/50 text-left hover:bg-muted/80 transition-colors"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                <Icon size={14} className="text-purple-500 shrink-0" />
                <span className="leading-tight">{label}</span>
              </span>
              <span className="font-bold text-foreground">{value} →</span>
            </button>
          ))}
        </div>
      </div>

      {/* c) Hoje (checklist diário) */}
      <div
        id="sistema-diario"
        className="glass-strong rounded-2xl p-4 md:p-6 border border-purple-500/20 space-y-3 md:space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <span>📅</span> {t("hoje")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("hojeSub")}</p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            {t("actionsDone", { done: todayDone, total: todayActions.length })}
          </span>
        </div>

        <div className="space-y-2.5">
          {todayActions.length === 0 && (
            <div data-empty-today className="py-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{t("emptyToday")}</p>
              <button
                type="button"
                onClick={goToCreateAction}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/40 bg-purple-500/10 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors"
              >
                {t("emptyTodayCta")}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {todayActions.map((a) => {
            const done = doneIds.has(a.id);
            const week = weekProgress(a, completions, today);
            const streakDays = actionStreak(a, completions, today);
            const weekPct = week.scheduled ? (week.done / week.scheduled) * 100 : 0;
            return (
              // A linha só mostra; quem marca é o checkbox (evita marcar sem querer ao rolar).
              <div
                key={a.id}
                data-action={a.id}
                className={`group flex items-center gap-1 py-1.5 pl-1 pr-3.5 rounded-xl border transition ${
                  done
                    ? "bg-purple-950/20 border-purple-500/30 opacity-70"
                    : "bg-muted/50 border-border hover:border-purple-500/40 hover:bg-muted/80"
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={t(done ? "homeUncheck" : "homeCheck", { name: a.name })}
                  onClick={() => toggleAction(a.id, a.name, done)}
                  className="size-11 shrink-0 flex items-center justify-center rounded-lg"
                >
                  <span
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${
                      done
                        ? "bg-purple-600 border-purple-500 text-white"
                        : "border-muted-foreground/30 group-hover:border-purple-400"
                    }`}
                  >
                    {done && <Check size={14} className="stroke-[3]" />}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span
                      className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {a.name}
                    </span>
                    <span className="text-xs text-purple-400/80 ml-2">
                      ({t(`goals.area.${a.area}`)})
                    </span>
                  </div>
                  <div
                    className="mt-1 flex items-center gap-2"
                    data-week={`${week.done}/${week.scheduled}`}
                  >
                    <div className="h-1.5 w-12 sm:w-20 shrink-0 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-600 via-purple-400 to-indigo-400"
                        style={{ width: `${weekPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {t("homeWeekCount", { done: week.done, total: week.scheduled })}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground font-mono">
                    {a.suggestedTime || t("homeAnyTime")}
                  </div>
                  <div
                    className="text-[11px] text-purple-700 dark:text-purple-300"
                    data-streak={streakDays}
                    title={t("homeStreakTitle")}
                  >
                    🔥 {t("homeStreak", { n: streakDays })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* d) Foco da semana, em uma linha: o foco real vem do P.G., quando existe. */}
      <Link
        to={AI_AGENT_ENABLED ? "/planejamento" : "/"}
        data-week-focus
        className="glass-strong rounded-2xl px-4 py-3 border border-purple-500/20 flex items-center gap-3 hover:border-purple-500/40 transition-colors"
      >
        <Brain size={20} className="text-purple-400 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="font-display font-bold text-xs tracking-wide uppercase text-foreground">
            {t("focoDaSemana")}
          </span>
          <span className="block text-sm text-purple-700 dark:text-purple-200 truncate">
            {focusText}
          </span>
        </span>
        <ArrowRight size={16} className="text-purple-700 dark:text-purple-300 shrink-0" />
      </Link>

      {/* e) Seu progresso: um gráfico por vez, só das áreas prioritárias. */}
      {activeChart && (
        <GlassCard>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-display font-semibold text-foreground">{t("homeProgress")}</h3>
          </div>
          {visibleCharts.length > 1 && (
            <div
              role="tablist"
              aria-label={t("homeProgress")}
              className="flex rounded-xl border border-border overflow-hidden text-sm mb-3"
            >
              {visibleCharts.map((c) => (
                <button
                  key={c.area}
                  type="button"
                  role="tab"
                  aria-selected={c.area === activeChart.area}
                  data-chart-tab={c.area}
                  onClick={() => setChartArea(c.area)}
                  className={`flex-1 px-2 py-2 ${c.area === activeChart.area ? "bg-gold text-[#0A0F1E] font-semibold" : "hover:bg-muted/50"}`}
                >
                  {c.tab}
                </button>
              ))}
            </div>
          )}
          <div
            className="flex items-baseline justify-between gap-2 mb-2"
            data-chart-active={activeChart.area}
          >
            <div className="text-sm font-semibold text-muted-foreground">{activeChart.title}</div>
            <div className="text-sm font-semibold text-foreground text-right" data-chart-summary>
              {activeChart.summary}
            </div>
          </div>
          {activeChart.node}
        </GlassCard>
      )}

      {/* f) Insights: um cartão, um insight por vez. */}
      <Section title={t("insightsWeek")} className="mt-0">
        <GlassCard className="border-l-4 border-l-purple-500">
          <p className="text-sm leading-relaxed text-foreground/90 min-h-[2.75rem]" data-insight>
            {insights[insightIdx]}
          </p>
          {insights.length > 1 && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInsight((insightIdx - 1 + insights.length) % insights.length)}
                aria-label={t("homeInsightPrev")}
                className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1.5">
                {insights.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInsight(i)}
                    aria-label={t("homeInsightGo", { n: i + 1 })}
                    aria-current={i === insightIdx}
                    className="p-1"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all ${i === insightIdx ? "w-4 bg-purple-500" : "w-2 bg-muted-foreground/30"}`}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setInsight((insightIdx + 1) % insights.length)}
                aria-label={t("homeInsightNext")}
                className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                <ChevronRight size={16} />
              </button>
              <span className="ml-auto text-xs text-muted-foreground" data-insight-count>
                {t("homeInsightCount", { n: insightIdx + 1, total: insights.length })}
              </span>
            </div>
          )}
        </GlassCard>
      </Section>

      {/* g) Atalhos */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Link to="/kaizen" data-shortcut="kaizen" className="block">
          <GlassCard className="h-full flex items-center gap-3 p-4">
            <span className="text-2xl">🌱</span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
              {t("homeKaizenToday")}
            </span>
            <ArrowRight size={14} className="text-muted-foreground shrink-0" />
          </GlassCard>
        </Link>
        <button
          type="button"
          data-shortcut="recent"
          onClick={() => setShowRecent(true)}
          className="block text-left"
        >
          <GlassCard className="h-full flex items-center gap-3 p-4">
            <span className="text-2xl">🕒</span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
              {t("recentActivity")}
            </span>
            <ArrowRight size={14} className="text-muted-foreground shrink-0" />
          </GlassCard>
        </button>
      </div>

      {/* h) Metas e ações */}
      <GoalsSection requestedTab={goalsTab} />

      <Modal open={showRecent} onClose={() => setShowRecent(false)} title={t("recentActivity")}>
        {recent.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("emptyActivity")}</p>
        )}
        <ul className="divide-y divide-white/5">
          {recent.map((r, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <span className="text-xl">{r.icon}</span>
              <span className="flex-1 text-sm text-foreground/90">{r.text}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(r.date)}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <OnboardingModal
        open={showOnboarding}
        initialName={userName}
        initialAreas={primaryAreas}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />

      <Modal
        open={showAreaPicker}
        onClose={() => setShowAreaPicker(false)}
        title={t("pz.config.title")}
      >
        <p className="text-xs text-muted-foreground mb-4">{t("pz.config.hint")}</p>
        <PrimaryAreaPicker value={primaryAreas} onChange={setPrimaryAreas} />
        <div className="flex justify-end gap-2 pt-5">
          <button onClick={() => setShowAreaPicker(false)} className={btnGold}>
            {t("action.close")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "rgba(12, 11, 24, 0.95)",
  border: "1px solid rgba(168, 85, 247, 0.2)",
  borderRadius: 8,
  fontSize: 12,
};
