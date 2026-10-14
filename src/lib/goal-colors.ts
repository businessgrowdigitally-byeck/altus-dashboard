import type { GoalArea } from "./store";

export const DAILY_AREA_COLORS: Record<GoalArea, string> = {
  Finanças: "bg-gold/20 text-gold",
  "Corpo & Saúde": "bg-emerald-bgt/20 text-emerald-bgt",
  Biblioteca: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  Estudos: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  Geral: "bg-secondary/60 text-muted-foreground",
};
