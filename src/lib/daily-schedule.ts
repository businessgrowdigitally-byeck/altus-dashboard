import type { GoalDaily } from "./store";

export const DEFAULT_DURATION = 30;
export function timeToMinutes(time: unknown): number | null {
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function validDuration(duration: unknown): duration is number {
  return (
    typeof duration === "number" &&
    Number.isInteger(duration) &&
    duration >= 5 &&
    duration <= 1440 &&
    duration % 5 === 0
  );
}
export function validateSchedule(time: string | undefined, duration: unknown): boolean {
  const start = timeToMinutes(time);
  return validDuration(duration) && (!time || (start !== null && start + duration <= 1440));
}
export function dailyInterval(action: Pick<GoalDaily, "suggestedTime" | "durationMinutes">) {
  const start = timeToMinutes(action.suggestedTime);
  if (start === null) return null;
  const requested = validDuration(action.durationMinutes)
    ? action.durationMinutes
    : DEFAULT_DURATION;
  const end = Math.min(1440, start + requested);
  return {
    start,
    end,
    needsReview:
      start + requested > 1440 ||
      (action.durationMinutes !== undefined && !validDuration(action.durationMinutes)),
  };
}
export type FocusBlock = {
  action: GoalDaily;
  start: number;
  end: number;
  needsReview: boolean;
  column: number;
  columns: number;
};

/** Interval groups include chained conflicts; touching endpoints never overlap. */
export function layoutDailyActions(actions: GoalDaily[]): FocusBlock[] {
  const blocks: FocusBlock[] = actions
    .flatMap((action) => {
      const interval = dailyInterval(action);
      return interval ? [{ action, ...interval, column: 0, columns: 1 }] : [];
    })
    .sort((a, b) => a.start - b.start || a.action.id.localeCompare(b.action.id));
  let group: FocusBlock[] = [];
  let groupEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    for (const block of group) {
      let column = ends.findIndex((end) => end <= block.start);
      if (column < 0) column = ends.length;
      ends[column] = block.end;
      block.column = column;
    }
    for (const block of group) block.columns = ends.length;
    group = [];
  };
  for (const block of blocks) {
    if (block.start >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    group.push(block);
    groupEnd = Math.max(groupEnd, block.end);
  }
  flush();
  return blocks;
}
