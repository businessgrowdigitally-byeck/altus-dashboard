import assert from "node:assert/strict";
import { test, after } from "node:test";
import { createECDH, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:https";
import { createRequire } from "node:module";

// Run after NITRO_PRESET=vercel bun run build. Exercises /api/push/send and
// /api/push/test in the built artifact with the REAL web-push library: a fake
// phone (real P-256 keys + auth secret) subscribes to a local HTTPS server that
// stands in for the push service; the test decrypts what arrives exactly like
// the phone would. Supabase is stubbed via fetch — no real account or database.

const require = createRequire(import.meta.url);
const webpush = require("web-push");
const ece = require("http_ece");

// Certificado só deste teste para o "serviço de push" local.
const dir = mkdtempSync(join(tmpdir(), "altus-push-"));
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=127.0.0.1",
    "-keyout",
    join(dir, "key.pem"),
    "-out",
    join(dir, "cert.pem"),
  ],
  { stdio: "ignore" },
);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // só para o certificado local acima
after(() => rmSync(dir, { recursive: true, force: true }));

const received = [];
const server = createServer(
  { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) },
  (req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      res.statusCode = req.url.endsWith("/expired") ? 410 : 201;
      res.end();
    });
  },
);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
after(() => server.close());
const PUSH = `https://127.0.0.1:${server.address().port}`;

// Aparelho falso com chaves reais.
const phone = createECDH("prime256v1");
phone.generateKeys();
const authSecret = randomBytes(16);
const b64url = (b) => Buffer.from(b).toString("base64url");
const keys = { p256dh: b64url(phone.getPublicKey()), auth: b64url(authSecret) };
const decrypt = (body) =>
  JSON.parse(
    ece.decrypt(body, { version: "aes128gcm", privateKey: phone, authSecret }).toString("utf8"),
  );

const vapid = webpush.generateVAPIDKeys();
const CRON = "segredo-de-teste";
Object.assign(process.env, {
  VITE_VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:teste@example.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-de-teste",
  CRON_SECRET: CRON,
});

const ANA = "00000000-0000-4000-8000-00000000000a";
const BIA = "00000000-0000-4000-8000-00000000000b";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
  new Date(),
);
const yesterday = new Date(`${today}T12:00:00Z`);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const all = [0, 1, 2, 3, 4, 5, 6];
const rows = {
  [ANA]: {
    profile: { name: "Ana" },
    goalsDaily: [{ id: "ingles", name: "Inglês", area: "Estudos", daysOfWeek: all }],
    kaizen: [{ date: yesterday.toISOString().slice(0, 10), improveTomorrow: "Ler 10 páginas" }],
  },
  [BIA]: { profile: { name: "Bia" } }, // nada para lembrar
};
let subscriptions = [];
const calls = [];
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (!url.hostname.endsWith("supabase.co")) return realFetch(input, init);
  calls.push({ method: req.method, url: req.url, auth: req.headers.get("authorization") });
  if (url.pathname === "/auth/v1/user") {
    const who = { "Bearer token-ana": ANA, "Bearer token-bia": BIA }[
      req.headers.get("authorization")
    ];
    return who ? json({ id: who, aud: "authenticated", role: "authenticated" }) : json({}, 401);
  }
  if (url.pathname === "/rest/v1/push_subscriptions") {
    if (req.method === "DELETE") {
      const ids = (url.searchParams.get("id") || "").replace(/^in\.\(|\)$/g, "").split(",");
      subscriptions = subscriptions.filter((s) => !ids.includes(s.id));
      return json([], 200);
    }
    const only = url.searchParams.get("user_id")?.replace(/^eq\./, "");
    return json(subscriptions.filter((s) => !only || s.user_id === only));
  }
  if (url.pathname === "/rest/v1/user_data") {
    const one = url.searchParams.get("user_id")?.match(/^eq\.(.*)$/)?.[1];
    if (one) return json({ data: rows[one] ?? {} });
    const ids = (url.searchParams.get("user_id") || "").replace(/^in\.\(|\)$/g, "").split(",");
    return json(ids.filter((id) => rows[id]).map((id) => ({ user_id: id, data: rows[id] })));
  }
  return json({});
};

const { default: app } = await import("../.vercel/output/functions/__server.func/index.mjs");
const post = (path, auth) =>
  app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
      body: "{}",
    }),
    {},
  );

const reset = () => {
  received.length = 0;
  calls.length = 0;
  subscriptions = [
    { id: "s1", user_id: ANA, endpoint: `${PUSH}/ana-phone`, ...keys, lang: "pt" },
    { id: "s2", user_id: ANA, endpoint: `${PUSH}/expired`, ...keys, lang: "pt" },
    { id: "s3", user_id: BIA, endpoint: `${PUSH}/bia-phone`, ...keys, lang: "pt" },
  ];
};

test("send: wrong or missing secret is refused and nothing is sent", async () => {
  reset();
  assert.equal((await post("/api/push/send")).status, 401);
  assert.equal((await post("/api/push/send", "Bearer errado")).status, 401);
  assert.equal(received.length, 0);
  assert.equal(calls.length, 0, "does not even read the database");
});

test("send: encrypted VAPID push with the person's text; nothing for who has nothing; expired removed", async () => {
  reset();
  const response = await post("/api/push/send", `Bearer ${CRON}`);
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.deepEqual(
    { ...report, date: undefined },
    { date: undefined, subscriptions: 3, sent: 1, skipped: 1, removed: 1, failed: 0 },
  );
  assert.equal(report.date, today);
  assert.ok(
    calls
      .filter((c) => c.url.includes("/rest/v1/"))
      .every((c) => c.auth === "Bearer service-role-de-teste"),
    "reads with the service role on the server",
  );

  const toAna = received.find((r) => r.url === "/ana-phone");
  assert.ok(toAna, "Ana's phone got it");
  assert.match(toAna.headers.authorization, /^vapid t=.+, k=/);
  assert.equal(toAna.headers["content-encoding"], "aes128gcm");
  assert.equal(toAna.headers.ttl, String(6 * 3600));
  assert.deepEqual(decrypt(toAna.body), {
    title: "Bom dia, Ana!",
    body: "Seu 1% de hoje: Ler 10 páginas · 1 ação hoje: Inglês",
    url: "/",
    tag: `altus-lembrete-${today}`,
  });
  assert.equal(
    received.some((r) => r.url === "/bia-phone"),
    false,
    "Bia has nothing to remind",
  );
  assert.deepEqual(
    subscriptions.map((s) => s.id),
    ["s1", "s3"],
    "the 410 subscription was deleted",
  );
});

test("send: 503 when the server is not configured", async () => {
  const saved = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  try {
    assert.equal((await post("/api/push/send", `Bearer ${CRON}`)).status, 503);
  } finally {
    process.env.VAPID_PRIVATE_KEY = saved;
  }
});

test("test: only the logged-in person's devices; a test message when there is nothing to remind", async () => {
  reset();
  assert.equal((await post("/api/push/test")).status, 401);
  assert.equal((await post("/api/push/test", "Bearer token-falso")).status, 401);

  const response = await post("/api/push/test", "Bearer token-bia");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 1, skipped: 0, removed: 0, failed: 0 });
  assert.deepEqual(
    received.map((r) => r.url),
    ["/bia-phone"],
    "nothing went to Ana's devices",
  );
  assert.deepEqual(decrypt(received[0].body), {
    title: "Teste do lembrete da manhã",
    body: "Está funcionando! Todo dia às 7h30 chega o seu lembrete aqui.",
    url: "/",
    tag: "altus-lembrete-teste",
  });
  assert.ok(
    calls.filter((c) => c.url.includes("/rest/v1/")).every((c) => c.auth === "Bearer token-bia"),
    "reads with the person's own token (RLS), not the service role",
  );
});

test("test: someone with no device gets a clear 404", async () => {
  reset();
  subscriptions = subscriptions.filter((s) => s.user_id !== BIA);
  const response = await post("/api/push/test", "Bearer token-bia");
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /Nenhum aparelho/);
});
