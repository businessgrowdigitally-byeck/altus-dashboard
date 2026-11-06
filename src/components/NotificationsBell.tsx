import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { fmtDate, todayISO } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { buildNotifications, unreadCount } from "@/lib/notifications";

/**
 * Sino de notificações do app: lembretes calculados dos dados (Kaizen de ontem,
 * resumo do GOAT, ações adiadas que chegam hoje, revisão do P.E., orçamento).
 * Abrir o painel marca tudo como lido.
 */
export function NotificationsBell({ className = "" }: { className?: string }) {
  const t = useT();
  const kaizen = useStore((s) => s.kaizen);
  const transactions = useStore((s) => s.transactions);
  const goalsDaily = useStore((s) => s.goalsDaily);
  const dayPlans = useStore((s) => s.dayPlans);
  const altusPlans = useStore((s) => s.altusPlans);
  const categoryBudgets = useStore((s) => s.categoryBudgets);
  const briefing = useStore((s) => s.dailyBriefing);
  const seen = useStore((s) => s.notificationsSeen);
  const markSeen = useStore((s) => s.markNotificationsSeen);
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const list = useMemo(
    () =>
      buildNotifications(
        { kaizen, transactions, goalsDaily, dayPlans, altusPlans, categoryBudgets },
        today,
        briefing,
      ),
    [kaizen, transactions, goalsDaily, dayPlans, altusPlans, categoryBudgets, today, briefing],
  );
  const unread = unreadCount(list, seen ?? []);
  const show = () => {
    setOpen(true);
    if (unread) markSeen(list.map((n) => n.id));
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        data-notif-bell
        aria-label={unread ? t("notifOpenUnread", { n: unread }) : t("notifOpen")}
        className={`relative -my-1.5 inline-flex size-9 items-center justify-center rounded-full hover:bg-muted/70 ${className}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            data-notif-count
            className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-purple-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("notifTitle")}>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("notifEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {list.map((n) => (
              <li key={n.id} data-notif-item={n.kind}>
                <Link
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl border border-border bg-muted/30 p-3 text-sm hover:bg-muted/60"
                >
                  {t(n.key, {
                    ...n.vars,
                    ...(typeof n.vars.from === "string" ? { from: fmtDate(n.vars.from) } : {}),
                  })}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
