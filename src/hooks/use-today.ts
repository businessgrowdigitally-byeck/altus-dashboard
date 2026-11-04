import { useEffect, useState } from "react";
import { todayISO } from "@/lib/format";

/**
 * Data de hoje (YYYY-MM-DD, fuso local) que se atualiza sozinha: com o app
 * aberto na virada do dia ou do mês, as telas passam a usar a data nova.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const tick = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()));
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}
