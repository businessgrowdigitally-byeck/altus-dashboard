import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMorningPush, pushText, saoPauloDate } from "../src/lib/push-message.ts";
import {
  deliver,
  morningMessages,
  pushEnv,
  sameSecret,
  type StoredSubscription,
} from "../src/lib/push-server.ts";
import { postponeAction } from "../src/lib/day-plan.ts";

// 2026-11-06 é uma sexta-feira.
const TODAY = "2026-11-06";
const YESTERDAY = "2026-11-05";
const all = [0, 1, 2, 3, 4, 5, 6];
const KAIZEN = "BGD Finance as the resource to make money";
const data = (extra: object = {}) => ({
  profile: { name: "Ana" },
  goalsDaily: [
    { id: "ingles", name: "Inglês", area: "Estudos", suggestedTime: "20:00", daysOfWeek: all },
    { id: "treino", name: "Treinar", area: "Geral", suggestedTime: "07:00", daysOfWeek: all },
    { id: "seg", name: "Só segunda", area: "Geral", daysOfWeek: [1] },
  ],
  kaizen: [{ date: YESTERDAY, improveTomorrow: KAIZEN }],
  ...extra,
});

describe("texto do lembrete da manhã", () => {
  it("name, yesterday's Kaizen, count and first action (routine order)", () => {
    assert.deepEqual(buildMorningPush(data(), TODAY, "pt"), {
      title: "Bom dia, Ana!",
      body: `Seu 1% de hoje: ${KAIZEN} · 2 ações hoje, comece por Treinar`,
      url: "/",
      tag: "altus-lembrete-2026-11-06",
    });
  });

  it("follows the day plan (order and postponed) and skips what is already done", () => {
    const dayPlans = {
      ...postponeAction({}, TODAY, "treino", "2026-11-07"),
    };
    const r = buildMorningPush(data({ dayPlans }), TODAY, "pt")!;
    assert.match(r.body, /1 ação hoje: Inglês$/);
    const done = buildMorningPush(
      data({ completions: [{ date: TODAY, actionId: "treino" }] }),
      TODAY,
      "pt",
    )!;
    assert.match(done.body, /2 ações hoje, comece por Inglês$/);
  });

  it("no actions and no Kaizen → nothing to send", () => {
    assert.equal(buildMorningPush({ profile: { name: "Ana" } }, TODAY, "pt"), null);
    assert.equal(
      buildMorningPush(
        { kaizen: [{ date: "2026-11-01", improveTomorrow: "antigo" }] },
        TODAY,
        "pt",
      ),
      null,
      "an old Kaizen does not count",
    );
  });

  it("only Kaizen, no name, other languages; long Kaizen is shortened", () => {
    const long = "x".repeat(300);
    const r = buildMorningPush(
      { kaizen: [{ date: YESTERDAY, improveTomorrow: long }] },
      TODAY,
      "en",
    )!;
    assert.equal(r.title, "Good morning!");
    assert.ok(r.body.startsWith("Your 1% for today: xxx"));
    assert.ok(r.body.length < 170 && r.body.endsWith("…"));
    const es = buildMorningPush(data(), TODAY, "es")!;
    assert.equal(es.title, "¡Buenos días, Ana!");
    assert.match(es.body, /2 acciones hoy, empieza por Treinar$/);
  });

  it("ignores malformed saved data instead of failing", () => {
    const r = buildMorningPush(
      { goalsDaily: [null, { id: "a" }, { id: "b", name: "Beber água", daysOfWeek: "x" }, 3] },
      TODAY,
      "pt",
    );
    assert.equal(r, null, "no valid action scheduled today");
  });

  it("São Paulo date (UTC-3, no daylight saving)", () => {
    assert.equal(saoPauloDate(new Date("2026-11-06T02:59:00Z")), "2026-11-05");
    assert.equal(saoPauloDate(new Date("2026-11-06T10:30:00Z")), "2026-11-06");
    assert.equal(pushText("push.actions", "pt", { n: 3, name: "X" }), "3 ações hoje, comece por X");
  });
});

describe("envio", () => {
  const sub = (id: string, user: string, lang = "pt"): StoredSubscription => ({
    id,
    user_id: user,
    endpoint: `https://push.example/${id}`,
    p256dh: "k",
    auth: "a",
    lang,
  });

  it("sends each device its person's message, skips people with nothing, removes expired ones", async () => {
    const sent: [string, unknown][] = [];
    const removed: string[][] = [];
    const subs = [
      sub("a1", "ana"),
      sub("a2", "ana", "en"),
      sub("b1", "bia"),
      sub("x1", "sem-dados"),
      sub("g1", "ana"),
    ];
    const report = await deliver(
      subs,
      morningMessages(
        new Map<string, unknown>([
          ["ana", data()],
          ["bia", { profile: { name: "Bia" } }], // nada para lembrar
        ]),
        TODAY,
      ),
      {
        send: async (s, payload) => {
          if (s.id === "g1") return { ok: false, gone: true, status: 410 };
          sent.push([s.id, JSON.parse(payload)]);
          return { ok: true };
        },
        remove: async (ids) => {
          removed.push(ids);
        },
      },
    );
    assert.deepEqual(report, { sent: 2, skipped: 2, removed: 1, failed: 0 });
    assert.deepEqual(removed, [["g1"]]);
    assert.deepEqual(
      sent.map(([id, p]) => [id, (p as { title: string }).title]),
      [
        ["a1", "Bom dia, Ana!"],
        ["a2", "Good morning, Ana!"],
      ],
    );
  });

  it("other failures are counted, not removed; a throwing sender does not stop the rest", async () => {
    const report = await deliver(
      [sub("a", "u"), sub("b", "u"), sub("c", "u")],
      () => ({ title: "t", body: "b", url: "/", tag: "x" }),
      {
        send: async (s) => {
          if (s.id === "a") throw new Error("rede");
          if (s.id === "b") return { ok: false, gone: false, status: 500 };
          return { ok: true };
        },
        remove: async () => assert.fail("nothing to remove"),
      },
    );
    assert.deepEqual(report, { sent: 1, skipped: 0, removed: 0, failed: 2 });
  });

  it("env: lists what is missing; secret comparison", () => {
    assert.deepEqual(pushEnv({}).missing, [
      "VITE_VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CRON_SECRET",
    ]);
    assert.equal(sameSecret("abc", "abc"), true);
    assert.equal(sameSecret("abd", "abc"), false);
    assert.equal(sameSecret("abcd", "abc"), false);
    assert.equal(sameSecret("", ""), false, "an empty secret never authorizes");
  });
});
