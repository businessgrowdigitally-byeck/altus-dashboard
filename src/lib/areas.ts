import {
  Wallet,
  HeartPulse,
  BookOpen,
  GraduationCap,
  Sparkles,
  Bot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AI_AGENT_ENABLED } from "@/lib/features";

/** Módulos reais existentes no app. "dashboard" e "configuracoes" ficam fixos. */
export type AreaKey = "financas" | "corpo" | "biblioteca" | "estudos" | "kaizen" | "agente";

export type AreaDef = {
  key: AreaKey;
  to: "/financas" | "/corpo" | "/biblioteca" | "/estudos" | "/kaizen" | "/agente";
  i18nKey: string;
  icon: LucideIcon;
  emoji: string;
};

/** Áreas que podem ser marcadas como prioritárias hoje. O Agente entra só quando habilitado. */
export const ALL_AREA_KEYS: AreaKey[] = ["financas", "corpo", "biblioteca", "estudos", "kaizen"];

export const AREA_DEFS: AreaDef[] = [
  { key: "financas", to: "/financas", i18nKey: "nav.financas", icon: Wallet, emoji: "💰" },
  { key: "corpo", to: "/corpo", i18nKey: "nav.corpo", icon: HeartPulse, emoji: "⚖️" },
  { key: "biblioteca", to: "/biblioteca", i18nKey: "nav.biblioteca", icon: BookOpen, emoji: "📚" },
  { key: "estudos", to: "/estudos", i18nKey: "nav.estudos", icon: GraduationCap, emoji: "🎓" },
  { key: "kaizen", to: "/kaizen", i18nKey: "nav.kaizen", icon: Sparkles, emoji: "🌱" },
  ...(AI_AGENT_ENABLED
    ? ([{ key: "agente", to: "/agente", i18nKey: "nav.agente", icon: Bot, emoji: "🤖" }] as AreaDef[])
    : []),
];