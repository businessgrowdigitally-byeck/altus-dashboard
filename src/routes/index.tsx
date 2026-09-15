import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { brl, daysAgoISO, fmtDate, fmtDateLong, greeting, kg, todayISO } from "@/lib/format";
import { GlassCard, KpiCard, PageHeader, Section } from "@/components/primitives";
import { GoalsSection } from "@/components/GoalsSection";
import { KaizenTodayCard } from "@/components/KaizenTodayCard";
import {
  Check,
  ArrowRight,
  Brain,
  Sparkles,
  Target,
  CheckSquare,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSyncStatus } from "@/lib/sync";
import { useT } from "@/lib/i18n";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AREA_DEFS, type AreaKey } from "@/lib/areas";
import { cn } from "@/lib/utils";
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

  const monthTx = transactions.filter((t) => t.date.startsWith(monthKey));
  const income = monthTx.filter((t) => t.type === "entrada").reduce((a, b) => a + b.value, 0);
  const expense = monthTx.filter((t) => t.type === "saida").reduce((a, b) => a + b.value, 0);
  const balance = income - expense;

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
  const weeklyProgress =
    todayActions.length > 0 ? Math.round((todayDone / todayActions.length) * 100) : 78;

  // 30-day financial trend
  const finTrend = useMemo(() => {
    const arr: { date: string; saldo: number }[] = [];
    let running = 0;
    for (let i = 29; i >= 0; i--) {
      const d = daysAgoISO(i);
      const dayTx = transactions.filter((t) => t.date === d);
      running += dayTx.reduce((a, t) => a + (t.type === "entrada" ? t.value : -t.value), 0);
      arr.push({ date: d.slice(5), saldo: running });
    }
    return arr;
  }, [transactions]);

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
    while (out.length < 3) out.push(t("insight.fallback"));
    return out.slice(0, 3);
  }, [transactions, sortedWeights, booksThisYear, streak, yearKey, t]);

  const { user } = useAuth();
  const { status: syncStatus } = useSyncStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);

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
    <div className="space-y-8">
      {/* Hero Brand Section (Fiel à foto anexada) */}
      <div className="relative overflow-hidden rounded-3xl border bg-card/80 backdrop-blur-xl p-6 md:p-10 shadow-2xl">
        {/* Background Mountain Silhouette & Glow */}
        <div className="absolute right-0 bottom-0 pointer-events-none opacity-40 md:opacity-70 w-full max-w-lg h-full overflow-hidden flex items-end justify-end">
          <svg viewBox="0 0 500 300" className="w-full h-auto" fill="none">
            <path d="M180 300L350 80L480 300H180Z" fill="url(#hero-mtn-1)" />
            <path d="M50 300L220 140L380 300H50Z" fill="url(#hero-mtn-2)" opacity="0.7" />
            <circle cx="350" cy="80" r="14" fill="#C084FC" filter="blur(10px)" opacity="0.8" />
            <defs>
              <linearGradient
                id="hero-mtn-1"
                x1="350"
                y1="80"
                x2="350"
                y2="300"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#6E38F7" stopOpacity="0.8" />
                <stop offset="0.6" stopColor="#1E1346" stopOpacity="0.6" />
                <stop offset="1" stopColor="#07070F" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient
                id="hero-mtn-2"
                x1="220"
                y1="140"
                x2="220"
                y2="300"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4C1D95" stopOpacity="0.6" />
                <stop offset="1" stopColor="#07070F" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative z-10 max-w-2xl">
          {/* Logo & Chevron */}
          <div className="flex items-center gap-3 mb-4">
            <svg
              viewBox="0 0 36 36"
              className="w-9 h-9 drop-shadow-[0_0_12px_rgba(168,85,247,0.8)]"
              fill="none"
            >
              <path d="M18 3L31 29H24.5L18 16L11.5 29H5L18 3Z" fill="url(#hero-brand-grad)" />
              <defs>
                <linearGradient
                  id="hero-brand-grad"
                  x1="5"
                  y1="3"
                  x2="31"
                  y2="29"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#C084FC" />
                  <stop offset="0.5" stopColor="#A855F7" />
                  <stop offset="1" stopColor="#6366F1" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-display font-extrabold text-2xl tracking-[0.18em] bg-gradient-to-r from-slate-900 via-purple-900 to-purple-600 dark:from-white dark:via-purple-100 dark:to-purple-300 bg-clip-text text-transparent">
              ALTUS
            </span>
          </div>

          <h1 className="font-display text-2xl md:text-4xl font-extrabold text-foreground tracking-tight">
            {t("heroTitle")}
          </h1>
          <p className="mt-2 text-sm md:text-base text-purple-700/80 dark:text-purple-200/80 leading-relaxed max-w-xl">
            {t("heroSubtitle")}
          </p>

          {/* 4 Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
            <div className="glass rounded-xl p-3 border border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <Target size={16} />
                <span className="text-xs font-bold text-foreground">{t("pillarMetas")}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("pillarMetasSub")}</p>
            </div>
            <div className="glass rounded-xl p-3 border border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <CheckSquare size={16} />
                <span className="text-xs font-bold text-foreground">{t("pillarTarefas")}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("pillarTarefasSub")}</p>
            </div>
            <div className="glass rounded-xl p-3 border border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <Calendar size={16} />
                <span className="text-xs font-bold text-foreground">{t("pillarHabitos")}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("pillarHabitosSub")}</p>
            </div>
            <div className="glass rounded-xl p-3 border border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <TrendingUp size={16} />
                <span className="text-xs font-bold text-foreground">{t("pillarProgresso")}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("pillarProgressoSub")}</p>
            </div>
          </div>

          <a
            href="#sistema-diario"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#6E38F7] to-[#9055FF] text-white font-display font-bold text-sm tracking-wider shadow-lg shadow-purple-600/40 hover:shadow-purple-600/60 hover:scale-105 active:scale-95 transition-all"
          >
            <span>{t("ctaElevate")}</span>
            <ArrowRight size={16} />
          </a>
        </div>
      </div>

      {/* Priority Areas Quick Access */}
      <div>
        <PageHeader
          title={t("pz.dashboard.sectionTitle")}
          subtitle={
            primaryAreas.length === AREA_DEFS.length
              ? t("pz.dashboard.allAreas")
              : t("pz.dashboard.sectionSubtitle")
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {AREA_DEFS.map((area) => (
            <Link
              key={area.key}
              to={area.to}
              className={cn(
                "group glass rounded-xl p-4 border transition-all duration-200",
                primaryAreas.includes(area.key)
                  ? "border-purple-500/30 hover:border-purple-500/60 hover:bg-muted/60"
                  : "border-border opacity-60 hover:opacity-100 hover:border-purple-500/40 hover:bg-muted/60",
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="text-2xl">{area.emoji}</span>
                <span className="text-sm font-semibold text-foreground group-hover:text-purple-300 transition-colors">
                  {t(area.i18nKey)}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {t("pz.dashboard.viewArea")} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Greeting & Weekly Progress Card Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Progress Mountain Card */}
        <div className="lg:col-span-2 glass-strong rounded-2xl p-5 border border-purple-500/20 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                {greeting()}, {userName} ☀️
              </h3>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                {mounted ? fmtDateLong(now) : t("loadingDate")}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">{t("weeklyProgress")}</span>
              <div className="font-display text-2xl font-black text-purple-700 dark:text-purple-300">
                {weeklyProgress}%
              </div>
            </div>
          </div>

          {/* Progress Bar & Mountain Visual */}
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden border border-border p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 via-purple-400 to-indigo-400 shadow-[0_0_12px_rgba(168,85,247,0.8)] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, weeklyProgress))}%` }}
              />
            </div>
          </div>

          {/* Quick Counter Badges */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Target size={14} className="text-purple-500" />
                <span>{t("pillarMetas")}</span>
              </div>
              <span className="font-bold text-foreground">{goalsMacro.length} →</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckSquare size={14} className="text-purple-500" />
                  <span>{t("pillarTarefas")}</span>
                </div>
                <span className="font-bold text-foreground">{todayActions.length} →</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles size={14} className="text-purple-500" />
                  <span>{t("pillarHabitos")}</span>
                </div>
                <span className="font-bold text-foreground">
                {todayDone}/{todayActions.length} →
              </span>
            </div>
          </div>
        </div>

        {/* Foco da Semana Banner */}
        <div className="glass-strong rounded-2xl p-5 border border-purple-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Brain size={20} />
              <h4 className="font-display font-bold text-sm tracking-wide uppercase text-foreground">
                {t("focoDaSemana")}
              </h4>
            </div>
            <p className="text-sm font-semibold text-purple-700 dark:text-purple-200 mt-2">{t("consistencia")}</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{t("quote")}</p>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-purple-700 dark:text-purple-300">
            <span>{t("objetivoCiclo")}</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* Seção Hoje (Checklist Interativo Diário) */}
      <div
        id="sistema-diario"
        className="glass-strong rounded-2xl p-6 border border-purple-500/20 space-y-4"
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
            <p className="text-sm text-muted-foreground py-4 text-center">{t("emptyToday")}</p>
          )}
          {todayActions.map((a) => {
            const done = doneIds.has(a.id);
            return (
              <div
                key={a.id}
                onClick={() => toggleCompletion(a.id, today)}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer select-none ${
                  done
                    ? "bg-purple-950/20 border-purple-500/30 opacity-70"
                    : "bg-muted/50 border-border hover:border-purple-500/40 hover:bg-muted/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${
                      done
                        ? "bg-purple-600 border-purple-500 text-white"
                        : "border-muted-foreground/30 group-hover:border-purple-400"
                    }`}
                  >
                    {done && <Check size={14} className="stroke-[3]" />}
                  </div>
                  <div>
                    <span
                      className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {a.name}
                    </span>
                    <span className="text-xs text-purple-400/80 ml-2">({a.area})</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground font-mono">
                  {a.suggestedTime || "Qualquer hora"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <KaizenTodayCard embedded />

      {/* Relatório Executivo - KPIs Gerais */}
      <div>
        <PageHeader title={t("reportTitle")} subtitle={t("reportSubtitle")} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { area: "financas" as AreaKey, node: (
              <KpiCard
                label={t("kpiSaldo")}
                value={brl(balance)}
                icon="💰"
                tone={balance >= 0 ? "positive" : "negative"}
                delta={`${brl(income)} − ${brl(expense)}`}
              />
            )},
            { area: "corpo" as AreaKey, node: (
              <KpiCard
                label={t("kpiPeso")}
                value={lastW ? kg(lastW.weight) : "—"}
                icon="⚖️"
                delta={
                  lastW && prevW
                    ? `${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)} kg ${t("deltaVsWeek")}`
                    : t("deltaNoData")
                }
              />
            )},
            { area: "biblioteca" as AreaKey, node: (
              <KpiCard
                label={t("kpiLivros", { year: yearKey })}
                value={booksThisYear}
                icon="📚"
                tone="gold"
              />
            )},
            { area: "estudos" as AreaKey, node: (
              <KpiCard label={t("kpiStreak")} value={`${streak} d`} icon="🎯" tone="gold" />
            )},
          ]
            .sort((a, b) => kpiOrder(a.area) - kpiOrder(b.area))
            .map((k) => <Fragment key={k.area}>{k.node}</Fragment>))}
        </div>
      </div>

      {/* Mini-Gráficos */}
      <div className="grid md:grid-cols-2 gap-4">
        {([
          { area: "financas" as AreaKey, node: (
            <MiniChart title={t("chartSaldo")}>
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
            </MiniChart>
          )},
          { area: "corpo" as AreaKey, node: (
            <MiniChart title={t("chartPeso")}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weightTrend}>
                  <CartesianGrid strokeOpacity={0.1} />
                  <XAxis dataKey="date" fontSize={10} stroke="#888" />
                  <YAxis domain={["auto", "auto"]} fontSize={10} stroke="#888" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="peso" stroke="#2ECC71" strokeWidth={2.5} dot />
                </LineChart>
              </ResponsiveContainer>
            </MiniChart>
          )},
          { area: "biblioteca" as AreaKey, node: (
            <MiniChart title={t("chartLivros", { year: yearKey })}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={booksPerMonth}>
                  <CartesianGrid strokeOpacity={0.1} />
                  <XAxis dataKey="mes" fontSize={10} stroke="#888" />
                  <YAxis fontSize={10} stroke="#888" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="livros" fill="#F5C842" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </MiniChart>
          )},
          { area: "estudos" as AreaKey, node: (
            <MiniChart title={t("chartEstudo")}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={studyWeekly}>
                  <CartesianGrid strokeOpacity={0.1} />
                  <XAxis dataKey="sem" fontSize={10} stroke="#888" />
                  <YAxis fontSize={10} stroke="#888" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="horas" fill="#A855F7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </MiniChart>
          )},
        ]
          .sort((a, b) => kpiOrder(a.area) - kpiOrder(b.area))
          .map((k) => <Fragment key={k.area}>{k.node}</Fragment>))}
      </div>

      {/* Atividade Recente */}
      <Section title={t("recentActivity")}>
        <GlassCard>
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
        </GlassCard>
      </Section>

      {/* Insights da Semana */}
      <Section title={t("insightsWeek")}>
        <div className="grid md:grid-cols-3 gap-4">
          {insights.map((t, i) => (
            <GlassCard key={i} className="border-l-4 border-l-purple-500">
              <p className="text-sm leading-relaxed text-foreground/90">{t}</p>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* Seção Completa de Metas & Rotina */}
      <GoalsSection />

      <OnboardingModal
        open={showOnboarding}
        initialName={userName}
        initialAreas={primaryAreas}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "rgba(12, 11, 24, 0.95)",
  border: "1px solid rgba(168, 85, 247, 0.2)",
  borderRadius: 8,
  fontSize: 12,
};

function MiniChart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard>
      <div className="text-sm font-semibold mb-2 text-muted-foreground">{title}</div>
      {children}
    </GlassCard>
  );
}
