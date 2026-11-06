const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Lembrete da manhã em Configurações: ativar (permissão + inscrição gravada na
// tabela), enviar teste, recarregar, desativar, sair da conta apaga a inscrição
// deste aparelho, e o iPhone fora da Tela de Início vê a instrução. As APIs de
// push do navegador são simuladas (o Chromium de teste não fala com o FCM);
// Supabase e /api/push/test são falsos. Também confere manifesto, ícones e sw.js.
// Rode o servidor com VITE_VAPID_PUBLIC_KEY definida (qualquer chave pública VAPID).
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "push@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const ENDPOINT = "https://push.example/device-1";

async function setup(browser, contextOptions) {
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let snapshot = { profile: { name: "Push" }, primaryAreas: ["estudos"] };
  const cloud = fakeSupabase(page, { user, get: () => snapshot, set: (x) => (snapshot = x) });
  await cloud.ready;
  // Tabela push_subscriptions em memória (registrada depois: tem prioridade).
  const rows = [];
  await page.route("**/rest/v1/push_subscriptions**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const endpoint = (url.searchParams.get("endpoint") || "").replace(/^eq\./, "");
    const reply = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "GET") return reply(rows.filter((r) => r.endpoint === endpoint));
    if (req.method() === "DELETE") {
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i].endpoint === endpoint) rows.splice(i, 1);
      return reply([], 204);
    }
    if (req.method() === "POST") {
      rows.push({ id: `row-${rows.length + 1}`, ...req.postDataJSON() });
      return reply([], 201);
    }
    return reply({});
  });
  const tests = [];
  await page.route("**/api/push/test", (route) => {
    tests.push(route.request().headers().authorization);
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"sent":1}' });
  });
  await page.addInitScript(
    ({ user }) => {
      localStorage.setItem(
        "altus-auth",
        JSON.stringify({
          access_token: "t",
          refresh_token: "r",
          expires_at: 4102444800,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
      // APIs de push simuladas; o estado sobrevive ao recarregar (como no navegador real).
      const KEY = "__fake_push";
      const load = () =>
        JSON.parse(
          sessionStorage.getItem(KEY) ||
            '{"sub":null,"subscribe":0,"unsubscribe":0,"permission":"default"}',
        );
      const save = (s) => sessionStorage.setItem(KEY, JSON.stringify(s));
      const subObj = (endpoint) => ({
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: "BPfakeKey", auth: "fakeAuth" } }),
        unsubscribe: async () => {
          const s = load();
          s.sub = null;
          s.unsubscribe++;
          save(s);
          return true;
        },
      });
      const pushManager = {
        getSubscription: async () => {
          const s = load();
          return s.sub ? subObj(s.sub) : null;
        },
        subscribe: async (opts) => {
          const s = load();
          s.subscribe++;
          s.keyLength = opts.applicationServerKey.length;
          s.userVisibleOnly = opts.userVisibleOnly;
          s.sub = "https://push.example/device-1";
          save(s);
          return subObj(s.sub);
        },
      };
      const reg = { pushManager };
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          register: async () => reg,
          ready: Promise.resolve(reg),
          getRegistration: async () => reg,
        },
      });
      window.PushManager = window.PushManager || function PushManager() {};
      window.Notification = class {
        static get permission() {
          return load().permission;
        }
        static async requestPermission() {
          const s = load();
          s.permission = "granted";
          save(s);
          return "granted";
        }
      };
      window.__fakePush = load;
    },
    { user },
  );
  return { ctx, page, errors, rows, tests };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const base = (process.env.DEV_SERVER_URL || "http://127.0.0.1:3000/").replace(/\/$/, "");
  try {
    // 0) Manifesto, ícones e service worker publicados.
    {
      const page = await browser.newPage();
      const manifest = await (await page.request.get(base + "/manifest.webmanifest")).json();
      assert.equal(manifest.name, "ALTUS");
      assert.equal(manifest.display, "standalone");
      assert.equal(manifest.theme_color, "#190D30");
      assert.deepEqual(
        manifest.icons.map((i) => `${i.src} ${i.sizes} ${i.purpose}`),
        [
          "/icons/icon-192.png 192x192 any",
          "/icons/icon-512.png 512x512 any",
          "/icons/icon-512.png 512x512 maskable",
        ],
      );
      for (const p of [
        "/icons/apple-touch-icon.png",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
      ]) {
        const r = await page.request.get(base + p);
        assert.equal(r.status(), 200, p);
        assert.match(r.headers()["content-type"], /image\/png/);
      }
      assert.match(await (await page.request.get(base + "/sw.js")).text(), /notificationclick/);
      await page.goto(base + "/", { waitUntil: "domcontentloaded" });
      assert.equal(
        await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"),
        "/icons/apple-touch-icon.png",
      );
      assert.equal(
        await page.locator('link[rel="manifest"]').getAttribute("href"),
        "/manifest.webmanifest",
      );
      assert.equal(
        await page.locator('meta[name="theme-color"]').getAttribute("content"),
        "#190D30",
      );
      await page.close();
    }

    // 1) Android: ativar, enviar teste, recarregar, desativar.
    const a = await setup(browser, { ...devices["Pixel 7"] });
    await a.page.goto(base + "/configuracoes", { waitUntil: "networkidle" });
    const box = a.page.locator("[data-push-state]");
    await a.page.locator('[data-push-state="off"]').waitFor();
    await box.getByRole("button", { name: "Ativar lembrete da manhã" }).tap();
    await a.page.locator('[data-push-state="on"]').waitFor();
    await a.page.getByText("Lembrete da manhã ativado neste aparelho.").first().waitFor();
    assert.deepEqual(
      a.rows.map(({ endpoint, p256dh, auth, lang }) => ({ endpoint, p256dh, auth, lang })),
      [{ endpoint: ENDPOINT, p256dh: "BPfakeKey", auth: "fakeAuth", lang: "pt" }],
    );
    const fake = await a.page.evaluate(() => window.__fakePush());
    assert.equal(fake.subscribe, 1);
    assert.equal(fake.keyLength, 65, "VAPID public key passed as 65 bytes");
    assert.equal(fake.userVisibleOnly, true);
    if (process.env.SCREENSHOT_DIR)
      await box.screenshot({ path: `${process.env.SCREENSHOT_DIR}/push-settings-on.png` });

    await box.getByRole("button", { name: "Enviar teste" }).tap();
    await a.page
      .getByText("Teste enviado para 1 aparelho(s). Deve chegar em alguns segundos.")
      .waitFor();
    assert.deepEqual(a.tests, ["Bearer t"], "test uses the person's own session");

    await a.page.reload({ waitUntil: "networkidle" });
    await a.page.locator('[data-push-state="on"]').waitFor();

    await box.getByRole("button", { name: "Desativar" }).tap();
    await a.page.locator('[data-push-state="off"]').waitFor();
    assert.equal(a.rows.length, 0, "row deleted");
    assert.equal((await a.page.evaluate(() => window.__fakePush())).unsubscribe, 1);
    assert.deepEqual(a.errors, []);
    await a.ctx.close();

    // 2) Sair da conta apaga a inscrição deste aparelho.
    const d = await setup(browser, { viewport: { width: 1280, height: 900 } });
    await d.page.goto(base + "/configuracoes", { waitUntil: "networkidle" });
    await d.page.getByRole("button", { name: "Ativar lembrete da manhã" }).click();
    await d.page.locator('[data-push-state="on"]').waitFor();
    assert.equal(d.rows.length, 1);
    await d.page.getByTitle("Sair da conta").first().click();
    await d.page.waitForFunction(() => window.__fakePush().unsubscribe === 1);
    assert.equal(d.rows.length, 0, "logout removed this device");
    assert.deepEqual(d.errors, []);
    await d.ctx.close();

    // 3) iPhone fora da Tela de Início: instrução, sem botão.
    const i = await setup(browser, { ...devices["iPhone 13"] });
    await i.page.goto(base + "/configuracoes", { waitUntil: "networkidle" });
    const ios = i.page.locator('[data-push-state="ios-install"]');
    await ios.waitFor();
    await ios.getByText(/Compartilhar → Adicionar à Tela de Início/).waitFor();
    assert.equal(await ios.getByRole("button").count(), 0);
    if (process.env.SCREENSHOT_DIR)
      await ios.screenshot({ path: `${process.env.SCREENSHOT_DIR}/push-settings-ios.png` });
    assert.deepEqual(i.errors, []);
    await i.ctx.close();

    console.log(
      "PASS: manifest/icons/sw.js served and linked; Android: enable asks permission, subscribes with the 65-byte VAPID key and saves the row; test push uses the own session; state survives reload; disable deletes the row and unsubscribes; sign-out removes this device; iPhone outside the Home Screen gets the install instruction; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
