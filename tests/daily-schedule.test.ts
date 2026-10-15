import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dailyInterval,
  layoutDailyActions,
  minutesToTime,
  timeToMinutes,
  validateSchedule,
} from "../src/lib/daily-schedule.ts";
const action = (id: string, time?: string, duration?: number) => ({
  id,
  name: id,
  area: "Geral" as const,
  daysOfWeek: [1],
  suggestedTime: time,
  durationMinutes: duration,
});

describe("daily focus schedule", () => {
  it("accepts only local HH:MM and formats midnight boundaries", () => {
    assert.equal(timeToMinutes("09:45"), 585);
    for (const value of ["24:00", "9:00", "12:60", "", null, 900])
      assert.equal(timeToMinutes(value), null);
    assert.equal(minutesToTime(1440), "24:00");
    assert.equal(minutesToTime(0), "00:00");
  });
  it("validates duration and rejects crossing midnight", () => {
    assert.equal(validateSchedule("09:00", 45), true);
    assert.equal(validateSchedule("23:55", 5), true);
    assert.equal(validateSchedule("23:55", 10), false);
    assert.equal(validateSchedule("", 30), true);
    assert.equal(validateSchedule("00:00", 1440), true);
    for (const duration of [NaN, Infinity, 0, -5, 7, 10.5, 1445, "30"])
      assert.equal(validateSchedule("09:00", duration), false);
    assert.equal(validateSchedule("invalid", 30), false);
  });
  it("keeps old and malformed snapshots safe without mutating them", () => {
    const legacy = action("legacy", "09:00");
    assert.deepEqual(dailyInterval(legacy), { start: 540, end: 570, needsReview: false });
    assert.equal(legacy.durationMinutes, undefined);
    assert.deepEqual(dailyInterval(action("late", "23:59")), {
      start: 1439,
      end: 1440,
      needsReview: true,
    });
    assert.equal(dailyInterval(action("missing")), null);
    assert.equal(dailyInterval(action("invalid", "oops")), null);
    assert.deepEqual(dailyInterval(action("bad duration", "09:00", NaN)), {
      start: 540,
      end: 570,
      needsReview: true,
    });
  });
  it("places simultaneous and chained conflicts in deterministic columns", () => {
    const blocks = layoutDailyActions([
      action("c", "10:00", 60),
      action("b", "09:30", 60),
      action("a", "09:00", 60),
      action("d", "11:00", 30),
    ]);
    assert.deepEqual(
      blocks.map((b) => [b.action.id, b.column, b.columns]),
      [
        ["a", 0, 2],
        ["b", 1, 2],
        ["c", 0, 2],
        ["d", 0, 1],
      ],
    );
    assert.deepEqual(
      layoutDailyActions([action("c", "09:00"), action("a", "09:00"), action("b", "09:00")]).map(
        (b) => [b.action.id, b.column, b.columns],
      ),
      [
        ["a", 0, 3],
        ["b", 1, 3],
        ["c", 2, 3],
      ],
    );
  });
  it("excludes unscheduled actions and treats adjacent blocks separately", () => {
    assert.deepEqual(layoutDailyActions([]), []);
    const blocks = layoutDailyActions([
      action("a", "09:00", 45),
      action("b", "09:45", 30),
      action("unscheduled"),
    ]);
    assert.deepEqual(
      blocks.map((b) => [b.start, b.end, b.columns]),
      [
        [540, 585, 1],
        [585, 615, 1],
      ],
    );
  });
});
