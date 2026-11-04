import assert from "node:assert/strict";
import { test } from "node:test";

// Run after NITRO_PRESET=vercel bun run build. Exercises the authenticated
// /api/chat path in the built artifact with Supabase and Gemini stubbed via
// fetch — no real account, no real model call, no database writes.
// The stub must be installed before the artifact is imported, because the
// Supabase clients capture `fetch` when they are created.

const USER_ID = "00000000-0000-4000-8000-000000000001";
const calls = [];
/** "ok" streams a reply; "down" makes the Gemini call throw, as a network failure would. */
let geminiMode = "ok";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  calls.push({
    url: req.url,
    method: req.method,
    auth: req.headers.get("authorization"),
    body: init?.body,
  });

  if (url.pathname === "/auth/v1/user") {
    if (req.headers.get("authorization") !== "Bearer good-token")
      return json({ message: "invalid JWT" }, 401);
    return json({
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "t@example.com",
    });
  }
  if (url.pathname === "/rest/v1/user_data") {
    return json({
      data: {
        profile: { name: "Teste", goalWeight: 75 },
        transactions: [
          {
            id: "t1",
            type: "saida",
            value: 50,
            description: "Mercado",
            category: "Alimentação",
            date: "2026-10-20",
          },
        ],
        goalsMacro: [
          {
            id: "g1",
            name: "Chegar a 75kg",
            area: "Corpo & Saúde",
            currentValue: 80,
            targetValue: 75,
            unit: "kg",
          },
        ],
      },
    });
  }
  if (url.hostname === "generativelanguage.googleapis.com") {
    if (geminiMode === "down") throw new TypeError("fetch failed");
    const sse = 'data: {"choices":[{"delta":{"content":"Olá"}}]}\n\n' + "data: [DONE]\n\n";
    return new Response(sse, { headers: { "content-type": "text/event-stream" } });
  }
  return realFetch(input, init);
};

process.env.GEMINI_API_KEY = "test-key";
const { default: app } = await import("../.vercel/output/functions/__server.func/index.mjs");

const post = (body, token = "good-token") =>
  app.fetch(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    {},
  );

test("rejects an invalid session", async () => {
  const response = await post({ messages: [{ role: "user", content: "oi" }] }, "bad-token");
  assert.equal(response.status, 401);
});

test("rejects more messages than the limit", async () => {
  const messages = Array.from({ length: 25 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: `m${i}`,
  }));
  const response = await post({ messages });
  assert.equal(response.status, 400);
});

test("authenticated chat reads context on the server and streams the reply", async () => {
  calls.length = 0;
  const response = await post({
    messages: [{ role: "user", content: "Como estão minhas metas?" }],
    lang: "pt",
    today: "2026-10-26",
    // Ignored by the server: the context is always read under RLS.
    context: { injected: "IGNORE-ME" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  assert.match(await response.text(), /Olá/);

  const rest = calls.find((c) => c.url.includes("/rest/v1/user_data"));
  assert.ok(rest, "reads user_data on the server");
  assert.equal(rest.auth, "Bearer good-token", "reads with the user's own token (RLS)");
  assert.match(rest.url, new RegExp(`user_id=eq.${USER_ID}`));

  const gemini = calls.find((c) => c.url.includes("generativelanguage.googleapis.com"));
  assert.ok(gemini, "calls the model");
  assert.equal(gemini.auth, "Bearer test-key");
  const payload = JSON.parse(gemini.body);
  const system = payload.messages[0];
  assert.equal(system.role, "system");
  assert.match(system.content, /Mentor ALTUS/);
  assert.match(system.content, /Chegar a 75kg/);
  assert.match(system.content, /2026-10-26/);
  assert.doesNotMatch(system.content, /IGNORE-ME/);
  assert.deepEqual(payload.messages.slice(1), [
    { role: "user", content: "Como estão minhas metas?" },
  ]);
});

test("a network failure calling Gemini returns a JSON error, not the HTML error page", async () => {
  geminiMode = "down";
  try {
    const response = await post({ messages: [{ role: "user", content: "oi" }] });
    assert.equal(response.status, 502);
    assert.match(response.headers.get("content-type"), /application\/json/);
    const body = await response.json();
    assert.match(body.error, /conectar ao serviço de IA/);
  } finally {
    geminiMode = "ok";
  }
});
