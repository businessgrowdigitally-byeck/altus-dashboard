import { useEffect, useState } from "react";
import { Sparkles, Sun } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { todayISO } from "@/lib/format";
import { isSyncReady, useSyncStatus } from "@/lib/sync";
import { useAuth } from "@/lib/auth";
import { Modal, btnGold } from "@/components/Modal";
import { dayItems } from "@/lib/day-plan";
import { kaizenForToday } from "@/lib/insights";
import { isMorning, morningId } from "@/lib/notifications";
import { useDailyBriefing } from "@/lib/ai/use-briefing";
import { AI_AGENT_ENABLED } from "@/lib/features";

/**
 * "Bom dia": aparece uma vez por manhã (4h–12h) ao abrir o app, com o resumo
 * do GOAT, o Kaizen de ontem ("o que melhorar 1% amanhã") e a primeira ação
 * do dia. Dispensado, não volta no mesmo dia (em nenhum aparelho).
 */
export function MorningCard({ onStart }: { onStart: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const name = useStore((s) => s.profile.name);
  const kaizen = useStore((s) => s.kaizen);
  const goalsDaily = useStore((s) => s.goalsDaily);
  const dayPlans = useStore((s) => s.dayPlans);
  const completions = useStore((s) => s.completions);
  const seen = useStore((s) => s.notificationsSeen);
  const markSeen = useStore((s) => s.markNotificationsSeen);
  const syncStatus = useSyncStatus((s) => s.status);
  const briefing = useDailyBriefing();
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);

  const today = todayISO();
  // Espera a nuvem: o cartão pode já ter sido dispensado em outro aparelho.
  const loaded = !user || (isSyncReady() && syncStatus !== "loading");
  const open =
    hour !== null && isMorning(hour) && loaded && !(seen ?? []).includes(morningId(today));
  if (!open) return null;

  const k = kaizenForToday(kaizen, today);
  const done = new Set(completions.filter((c) => c.date === today).map((c) => c.actionId));
  const items = dayItems(goalsDaily, dayPlans ?? {}, today);
  const actions = items.flatMap((i) => (i.kind === "action" ? [i.action] : []));
  const first = actions.find((a) => !done.has(a.id));
  const close = () => markSeen([morningId(today)]);

  return (
    <Modal open onClose={close} title={t("morningTitle", { name: name || t("morningFriend") })}>
      <div className="space-y-4 text-sm" data-morning-card>
        {AI_AGENT_ENABLED && briefing.state !== "unavailable" && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
              <Sparkles size={13} /> {t("morningGoat")}
            </div>
            <p data-morning-briefing className="leading-relaxed text-foreground/90">
              {briefing.text ?? t("morningGoatLoading")}
            </p>
          </div>
        )}
        {k && (
          <div data-morning-kaizen>
            <div className="text-xs font-semibold text-muted-foreground">{t("morningKaizen")}</div>
            <p className="mt-0.5 font-medium">{k.text}</p>
          </div>
        )}
        <div data-morning-today>
          <div className="text-xs font-semibold text-muted-foreground">{t("morningToday")}</div>
          <p className="mt-0.5">
            {actions.length === 0
              ? t("morningNoActions")
              : first
                ? t("morningFirst", { n: actions.length, name: first.name })
                : t("morningAllDone", { n: actions.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            close();
            onStart();
          }}
          className={btnGold + " w-full inline-flex items-center justify-center gap-2"}
        >
          <Sun size={16} /> {t("morningStart")}
        </button>
      </div>
    </Modal>
  );
}
