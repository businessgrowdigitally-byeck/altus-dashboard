import {
  Wallet,
  HeartPulse,
  BookOpen,
  GraduationCap,
  Sparkles,
  Bot,
  ClipboardList,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AI_AGENT_ENABLED } from "@/lib/features";

/** Módulos reais existentes no app. "dashboard" e "configuracoes" ficam fixos. */
export type AreaKey =
  | "financas"
  | "corpo"
  | "biblioteca"
  | "estudos"
  | "kaizen"
  | "agente"
  | "planejamento";

export type AreaDef = {
  key: AreaKey;
  to: "/financas" | "/corpo" | "/biblioteca" | "/estudos" | "/kaizen" | "/agente" | "/planejamento";
  i18nKey: string;
  icon: LucideIcon;
  emoji: string;
};

export const AREA_DEFS: AreaDef[] = [
  { key: "financas", to: "/financas", i18nKey: "nav.financas", icon: Wallet, emoji: "💰" },
  { key: "corpo", to: "/corpo", i18nKey: "nav.corpo", icon: HeartPulse, emoji: "⚖️" },
  { key: "biblioteca", to: "/biblioteca", i18nKey: "nav.biblioteca", icon: BookOpen, emoji: "📚" },
  { key: "estudos", to: "/estudos", i18nKey: "nav.estudos", icon: GraduationCap, emoji: "🎓" },
  { key: "kaizen", to: "/kaizen", i18nKey: "nav.kaizen", icon: Sparkles, emoji: "🌱" },
  ...(AI_AGENT_ENABLED
    ? ([
        { key: "agente", to: "/agente", i18nKey: "nav.agente", icon: Bot, emoji: "🤖" },
        {
          key: "planejamento",
          to: "/planejamento",
          i18nKey: "nav.planejamento",
          icon: ClipboardList,
          emoji: "🧭",
        },
      ] as AreaDef[])
    : []),
];

/**
 * Áreas que podem ser marcadas como prioritárias: exatamente as que o seletor
 * mostra (o Mentor e o Planejamento entram quando o agente está habilitado).
 * Antes era uma lista fixa sem o Mentor, e a escolha dele era descartada ao salvar.
 */
export const ALL_AREA_KEYS: AreaKey[] = AREA_DEFS.map((d) => d.key);
