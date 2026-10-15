import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useStore, type GoalDaily } from "@/lib/store";
import { dailyInterval, layoutDailyActions, minutesToTime } from "@/lib/daily-schedule";
import { useT } from "@/lib/i18n";
import { GlassCard } from "./primitives";
import { ConfirmButton } from "./Modal";

import { DAILY_AREA_COLORS } from "@/lib/goal-colors";

type DailyProps = {
  actions: GoalDaily[];
  doneIds: Set<string>;
  isToday: boolean;
  onToggle: (id: string) => void;
  onEdit: (action: GoalDaily) => void;
  onRemove: (id: string) => void;
};

function Completion({
  action,
  done,
  isToday,
  onToggle,
}: {
  action: GoalDaily;
  done: boolean;
  isToday: boolean;
  onToggle: DailyProps["onToggle"];
}) {
  const t = useT();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      disabled={!isToday}
      aria-label={t("goals.completeAction", { name: action.name })}
      onClick={() => onToggle(action.id)}
      className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${done ? "bg-emerald-bgt border-emerald-bgt text-black" : "border-current"}`}
    >
      {done && <Check size={14} />}
    </button>
  );
}

export function DailyActionsList({
  actions,
  doneIds,
  isToday,
  onToggle,
  onEdit,
  onRemove,
}: DailyProps) {
  const t = useT();
  const macros = useStore((state) => state.goalsMacro);
  return (
    <GlassCard className="space-y-2">
      {!actions.length && (
        <p className="text-sm text-muted-foreground">
          {t(isToday ? "goals.noneToday" : "goals.noActionsDay")}
        </p>
      )}
      {actions.map((action) => {
        const done = isToday && doneIds.has(action.id);
        const interval = dailyInterval(action);
        const linked = macros.find((goal) => goal.id === action.linkedGoalId);
        return (
          <div key={action.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
            <Completion action={action} done={done} isToday={isToday} onToggle={onToggle} />
            <div className={`min-w-0 flex-1 ${done ? "opacity-60" : ""}`}>
              <div className={`break-words text-sm ${done ? "line-through" : ""}`}>
                {action.name}
              </div>
              {action.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`rounded px-1.5 py-0.5 ${DAILY_AREA_COLORS[action.area] ?? DAILY_AREA_COLORS.Geral}`}
                >
                  {t(`goals.area.${action.area}`)}
                </span>
                {interval && (
                  <span>
                    {minutesToTime(interval.start)}–{minutesToTime(interval.end)}
                  </span>
                )}
                {linked && <span className="italic">→ {linked.name}</span>}
                {done && <span>{t("goals.completed")}</span>}
                {interval?.needsReview && (
                  <span className="text-coral">{t("goals.reviewDuration")}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEdit(action)}
              aria-label={t("goals.editAction", { name: action.name })}
              className="rounded p-2 hover:bg-muted"
            >
              <Pencil size={16} />
            </button>
            <ConfirmButton
              onConfirm={() => onRemove(action.id)}
              className="rounded p-2 text-coral hover:bg-muted"
            >
              <span className="sr-only">{t("goals.deleteAction", { name: action.name })}</span>
              <Trash2 size={16} />
            </ConfirmButton>
          </div>
        );
      })}
    </GlassCard>
  );
}

const PIXELS_PER_MINUTE = 2;
export function DailyFocusCalendar(props: DailyProps & { now: Date }) {
  const { actions, doneIds, isToday, now } = props;
  const t = useT();
  const blocks = useMemo(() => layoutDailyActions(actions), [actions]);
  const unscheduled = actions.filter((action) => !dailyInterval(action));
  const viewport = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = actions.find((action) => action.id === selectedId);
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const initialScroll = useRef(currentMinute);
  const firstStart = blocks[0]?.start ?? 8 * 60;
  useEffect(() => {
    if (viewport.current)
      viewport.current.scrollTop = Math.max(
        0,
        (isToday ? initialScroll.current - 45 : firstStart - 30) * PIXELS_PER_MINUTE,
      );
  }, [isToday, firstStart]);

  return (
    <div className="space-y-3">
      {unscheduled.length > 0 && (
        <section aria-label={t("goals.unscheduled")} className="space-y-2">
          <h3 className="text-sm font-semibold">{t("goals.unscheduled")}</h3>
          <DailyActionsList {...props} actions={unscheduled} />
        </section>
      )}
      {selected && (
        <section aria-label={t("goals.blockDetails")} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("goals.blockDetails")}</h3>
            <button
              type="button"
              className="rounded px-2 py-1 text-sm hover:bg-muted"
              onClick={() => setSelectedId(null)}
            >
              {t("goals.closeDetails")}
            </button>
          </div>
          <DailyActionsList {...props} actions={[selected]} />
        </section>
      )}
      {!blocks.length && <p className="text-sm text-muted-foreground">{t("goals.noScheduled")}</p>}
      <div
        ref={viewport}
        role="region"
        aria-label={t("goals.focusView")}
        tabIndex={0}
        className="relative h-[560px] max-h-[65vh] overflow-auto rounded-xl border border-border bg-card/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <div className="relative" style={{ height: 1440 * PIXELS_PER_MINUTE + 24 }}>
          {Array.from({ length: 49 }, (_, slot) => (
            <div
              key={slot}
              className={`pointer-events-none absolute left-12 right-0 border-t ${slot % 2 === 0 ? "border-border" : "border-border/40 border-dashed"}`}
              style={{ top: slot * 30 * PIXELS_PER_MINUTE }}
            >
              {slot % 2 === 0 && (
                <span className="absolute -left-12 top-0 w-11 pr-1 text-right text-[10px] text-muted-foreground">
                  {minutesToTime(slot * 30)}
                </span>
              )}
            </div>
          ))}
          <div className="absolute left-14 right-2 top-0">
            {blocks.map((block) => {
              const done = isToday && doneIds.has(block.action.id);
              const label = `${block.action.name}, ${minutesToTime(block.start)}–${minutesToTime(block.end)}, ${t(`goals.area.${block.action.area}`)}${done ? `, ${t("goals.completed")}` : ""}${block.needsReview ? `, ${t("goals.reviewDuration")}` : ""}`;
              const compact = block.end - block.start < 25;
              return (
                <article
                  key={block.action.id}
                  data-focus-block={block.action.id}
                  aria-label={label}
                  className={`absolute flex overflow-hidden rounded-md border border-current shadow-sm ${DAILY_AREA_COLORS[block.action.area] ?? DAILY_AREA_COLORS.Geral} ${done ? "opacity-60" : ""}`}
                  style={{
                    top: block.start * PIXELS_PER_MINUTE,
                    height: (block.end - block.start) * PIXELS_PER_MINUTE,
                    left: `${(block.column / block.columns) * 100}%`,
                    width: `calc(${100 / block.columns}% - 3px)`,
                  }}
                >
                  {!compact && (
                    <div className="p-1">
                      <Completion
                        action={block.action}
                        done={done}
                        isToday={isToday}
                        onToggle={props.onToggle}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={label}
                    title={label}
                    onClick={() => setSelectedId(block.action.id)}
                    className="min-w-0 flex-1 overflow-hidden px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
                  >
                    <span
                      className={`block truncate text-xs font-semibold ${done ? "line-through" : ""}`}
                    >
                      {done && "✓ "}
                      {block.action.name}
                    </span>
                    {!compact && (
                      <>
                        <span className="block truncate text-[10px]">
                          {minutesToTime(block.start)}–{minutesToTime(block.end)}
                        </span>
                        <span className="block truncate text-[10px]">
                          {t(`goals.area.${block.action.area}`)}
                        </span>
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
          {isToday && (
            <div
              aria-label={t("goals.currentTime")}
              className="pointer-events-none absolute left-12 right-0 z-10 border-t-2 border-coral"
              style={{ top: currentMinute * PIXELS_PER_MINUTE }}
            >
              <span className="absolute -top-1.5 -left-1 size-2.5 rounded-full bg-coral" />
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("goals.blockHint")}</p>
    </div>
  );
}
