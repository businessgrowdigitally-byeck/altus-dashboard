import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { actionStreak, weekProgress } from "../src/lib/daily-stats.ts";

// 2026-11-06 é uma sexta-feira (getDay() = 5).
const TODAY = "2026-11-06";
const c = (date: string, actionId = "a") => ({ date, actionId });
const every = { id: "a", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
const weekdays = { id: "a", daysOfWeek: [1, 2, 3, 4, 5] }; // seg–sex

describe("progresso semanal da ação", () => {
  it("counts scheduled days in the last 7 days and how many were done", () => {
    assert.deepEqual(weekProgress(every, [c("2026-11-06"), c("2026-11-04")], TODAY), {
      done: 2,
      scheduled: 7,
    });
    assert.deepEqual(weekProgress(weekdays, [c("2026-11-06")], TODAY), { done: 1, scheduled: 5 });
  });

  it("ignores other actions, days outside the window and unscheduled days", () => {
    const comps = [c("2026-11-06", "other"), c("2026-10-30"), c("2026-11-01")]; // 01/11 é domingo
    assert.deepEqual(weekProgress(weekdays, comps, TODAY), { done: 0, scheduled: 5 });
  });
});

describe("sequência da ação", () => {
  it("counts consecutive scheduled days done, including today when done", () => {
    const comps = ["2026-11-06", "2026-11-05", "2026-11-04"].map((d) => c(d));
    assert.equal(actionStreak(every, comps, TODAY), 3);
  });

  it("today not done yet does not break the streak (the day is not over)", () => {
    const comps = ["2026-11-05", "2026-11-04"].map((d) => c(d));
    assert.equal(actionStreak(every, comps, TODAY), 2);
  });

  it("skips unscheduled days (weekend) instead of breaking", () => {
    // seg 02/11 e sex 30/10 feitos; sáb/dom não agendados; ter–qui faltando → quebra
    const comps = [
      "2026-11-06",
      "2026-11-05",
      "2026-11-04",
      "2026-11-03",
      "2026-11-02",
      "2026-10-30",
    ].map((d) => c(d));
    assert.equal(actionStreak(weekdays, comps, TODAY), 6);
  });

  it("stops at the first scheduled day missed", () => {
    const comps = ["2026-11-06", "2026-11-04"].map((d) => c(d));
    assert.equal(actionStreak(every, comps, TODAY), 1);
    assert.equal(actionStreak(every, [], TODAY), 0);
    assert.equal(actionStreak({ id: "a", daysOfWeek: [] }, [c(TODAY)], TODAY), 0);
  });
});
