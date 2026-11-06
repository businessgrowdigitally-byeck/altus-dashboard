import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildNotifications,
  isMorning,
  markSeen,
  morningId,
  normalizeBriefing,
  normalizeSeen,
  unreadCount,
} from "../src/lib/notifications.ts";
import { postponeAction } from "../src/lib/day-plan.ts";

const TODAY = "2026-11-06";
const YESTERDAY = "2026-11-05";
const all = [0, 1, 2, 3, 4, 5, 6];

describe("notificações e bom dia", () => {
  it("morning is 4h to noon", () => {
    assert.deepEqual(
      [3, 4, 11, 12].map((h) => isMorning(h)),
      [false, true, true, false],
    );
    assert.equal(morningId(TODAY), "morning:2026-11-06");
  });

  it("nothing to notify without data", () => {
    assert.deepEqual(buildNotifications({}, TODAY, null), []);
  });

  it("GOAT summary of today, yesterday's Kaizen and actions arriving today", () => {
    const goalsDaily = [
      { id: "leitura", name: "Ler", area: "Biblioteca" as const, daysOfWeek: [1] }, // só segunda
    ];
    const dayPlans = postponeAction({}, YESTERDAY, "leitura", TODAY);
    const list = buildNotifications(
      {
        kaizen: [{ date: YESTERDAY, improveTomorrow: "BGD Finance as the resource to make money" }],
        goalsDaily,
        dayPlans,
      },
      TODAY,
      { date: TODAY, text: "Comece pelo inglês.", lang: "pt" },
    );
    assert.deepEqual(
      list.map((n) => [n.id, n.vars]),
      [
        ["briefing:2026-11-06", { text: "Comece pelo inglês." }],
        ["kaizen:2026-11-06", { text: "BGD Finance as the resource to make money" }],
        ["arriving:2026-11-06:leitura", { name: "Ler", from: YESTERDAY }],
      ],
    );
  });

  it("an old summary does not show; a Kaizen user who skipped yesterday gets a reminder", () => {
    const list = buildNotifications(
      { kaizen: [{ date: "2026-11-01", improveTomorrow: "x" }] },
      TODAY,
      { date: YESTERDAY, text: "velho", lang: "pt" },
    );
    assert.deepEqual(
      list.map((n) => n.kind),
      ["kaizenMissing"],
    );
  });

  it("overdue P.E. review and budget over the limit (one per category per month)", () => {
    const list = buildNotifications(
      {
        altusPlans: [{ id: "p1", macroGoalName: "Juntar 10 mil", nextReview: YESTERDAY }],
        transactions: [{ type: "saida", value: 700, date: "2026-11-03", category: "Lazer" }],
        categoryBudgets: { Lazer: 500 },
        goalsDaily: [{ id: "a", name: "A", area: "Geral", daysOfWeek: all }],
      },
      TODAY,
      null,
    );
    assert.deepEqual(
      list.map((n) => [n.id, n.to]),
      [
        ["review:2026-11-06:p1", "/planejamento"],
        ["budget:2026-11:Lazer", "/financas"],
      ],
    );
  });

  it("read ids: no repeats, newest first, unread count", () => {
    const seen = markSeen(["a", "b"], ["c", "a"]);
    assert.deepEqual(seen, ["c", "a", "b"]);
    assert.deepEqual(normalizeSeen(["x", 3, "", "x", "y".repeat(201)]), ["x"]);
    assert.equal(normalizeSeen(Array.from({ length: 400 }, (_, i) => `n${i}`)).length, 300);
    const list = buildNotifications(
      { kaizen: [{ date: YESTERDAY, improveTomorrow: "x" }] },
      TODAY,
      { date: TODAY, text: "t", lang: "pt" },
    );
    assert.equal(unreadCount(list, []), 2);
    assert.equal(unreadCount(list, ["kaizen:2026-11-06"]), 1);
  });

  it("validates the stored GOAT summary", () => {
    assert.equal(normalizeBriefing({ date: "ontem", text: "x" }), null);
    assert.equal(normalizeBriefing({ date: TODAY, text: "   " }), null);
    assert.deepEqual(normalizeBriefing({ date: TODAY, text: " oi ", lang: "fr" }), {
      date: TODAY,
      text: "oi",
      lang: "pt",
    });
    assert.equal(normalizeBriefing({ date: TODAY, text: "x".repeat(900) })!.text.length, 600);
  });
});
