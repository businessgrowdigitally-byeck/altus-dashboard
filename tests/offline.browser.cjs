const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Modo offline no BUILD DE PRODUÇÃO (rode depois de `NITRO_PRESET=vercel bun run build`).
// Um servidor local serve .vercel/output como a Vercel: arquivos estáticos e,
// para o resto, a função do servidor. "Sem internet" é de verdade: o servidor é
// desligado, o Supabase falso recusa as chamadas e o navegador fica offline.
//  1) Abre online uma vez (o service worker guarda o app).
//  2) Sem internet: o app abre, mostra o aviso, registra uma ação; outra rota
//     nunca visitada também abre.
//  3) Enquanto isso outro aparelho grava na nuvem; a conexão volta: as duas
//     mudanças ficam (nada é apagado).
//  4) Mudança offline + app fechado antes de a internet voltar: ao reabrir
//     online, a mudança é combinada com a nuvem (antes a nuvem sobrescrevia).
const ROOT = path.join(__dirname, "..", ".vercel", "output");
const STATIC = path.join(ROOT, "static");
const PORT = Number(process.env.OFFLINE_TEST_PORT || 3100);
const TYPES = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

async function startServer() {
  const { default: app } = await import(path.join(ROOT, "functions", "__server.func", "index.mjs"));
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const file = path.join(STATIC, decodeURIComponent(url.pathname));
      if (file.startsWith(STATIC) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, {
          "content-type": TYPES[path.extname(file)] || "application/octet-stream",
          "cache-control": url.pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=0, must-revalidate",
        });
        return fs.createReadStream(file).pipe(res);
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const response = await app.fetch(
        new Request(url, {
          method: req.method,
          headers: req.headers,
          body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
        }),
        {},
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  const sockets = new Set();
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  return {
    stop: () =>
      new Promise((r) => {
        for (const s of sockets) s.destroy();
        server.close(() => r());
      }),
  };
}

const pad = (n) => String(n).padStart(2, "0");
const day = (n) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const today = day(0);
const all = [0, 1, 2, 3, 4, 5, 6];
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "offline@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};

(async () => {
  let server = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const ctx = await browser.newContext({ ...devices["Pixel 7"] });
    let snapshot = {
      profile: { name: "Offline" },
      primaryAreas: ["financas", "kaizen"],
      goalsDaily: [
        {
          id: "treino",
          name: "Treinar",
          area: "Corpo & Saúde",
          suggestedTime: "07:00",
          daysOfWeek: all,
        },
        { id: "ingles", name: "Inglês", area: "Estudos", suggestedTime: "20:00", daysOfWeek: all },
      ],
      completions: [],
      kaizen: [],
    };
    const errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      const cloud = fakeSupabase(page, { user, get: () => snapshot, set: (x) => (snapshot = x) });
      await cloud.ready;
      await page.addInitScript(
        ({ user }) =>
          localStorage.getItem("altus-auth") ||
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
          ),
        { user },
      );
      return { page, cloud };
    };
    const base = `http://127.0.0.1:${PORT}`;
    const offline = async (cloud, on) => {
      cloud.setOffline(on);
      await ctx.setOffline(on);
      if (on) await server.stop();
      else server = await startServer();
    };

    // 1) Online uma vez: o app abre e o service worker guarda páginas e arquivos.
    let { page, cloud } = await open();
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.locator("[data-action=treino]").waitFor();
    await page.waitForFunction(
      async () => {
        const pages = await (await caches.open("altus-pages-v1")).keys();
        const assets = await (await caches.open("altus-assets-v1")).keys();
        return pages.length >= 9 && assets.length >= 10 && !!navigator.serviceWorker.controller;
      },
      null,
      { timeout: 30000, polling: 500 },
    );

    // 2) Sem internet: abre, avisa, registra; outra rota também abre.
    await offline(cloud, true);
    await page.reload({ waitUntil: "load" });
    await page.locator("[data-offline-banner]").waitFor({ timeout: 5000 }); // abre na hora, sem esperar a rede
    await page.locator("[data-action=treino]").getByRole("checkbox").tap();
    await page.getByText("1 de 2 feitas").waitFor();
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/offline-home.png` });
    await page.getByRole("link", { name: "Kaizen Diário" }).first().tap();
    await page.waitForURL(/\/kaizen$/);
    await page
      .locator("main")
      .getByText(/Kaizen/)
      .first()
      .waitFor();
    assert.equal(snapshot.completions.length, 0, "nothing reached the cloud while offline");

    // 3) Outro aparelho grava; a conexão volta: as duas mudanças ficam.
    cloud.remoteWrite((d) => ({
      ...d,
      kaizen: [
        {
          id: "k-outro",
          date: today,
          improvedToday: "do outro aparelho",
          improveTomorrow: "",
          notes: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
    await offline(cloud, false);
    await page.locator("[data-offline-banner]").waitFor({ state: "detached", timeout: 15000 });
    for (let i = 0; i < 60 && !snapshot.completions.some((c) => c.actionId === "treino"); i++)
      await page.waitForTimeout(250);
    assert.deepEqual(
      snapshot.completions.map((c) => [c.date, c.actionId]),
      [[today, "treino"]],
      "offline completion was sent",
    );
    assert.deepEqual(
      snapshot.kaizen.map((k) => k.id),
      ["k-outro"],
      "the other device's Kaizen was kept",
    );

    // 4) Mudança offline e app fechado antes de a conexão voltar: reabrir online combina.
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.locator("[data-action=ingles]").waitFor();
    await offline(cloud, true);
    await page.reload({ waitUntil: "load" });
    await page.locator("[data-offline-banner]").waitFor({ timeout: 5000 }); // abre na hora, sem esperar a rede
    await page.locator("[data-action=ingles]").getByRole("checkbox").tap();
    await page.getByText("2 de 2 feitas").waitFor();
    await page.waitForTimeout(1500);
    await page.close();
    cloud.remoteWrite((d) => ({ ...d, profile: { ...d.profile, name: "Renomeado no outro" } }));
    ({ page, cloud } = await open());
    await offline(cloud, false);
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.getByText("2 de 2 feitas").waitFor();
    for (let i = 0; i < 60 && snapshot.completions.length < 2; i++) await page.waitForTimeout(250);
    assert.deepEqual(
      snapshot.completions.map((c) => c.actionId).sort(),
      ["ingles", "treino"],
      "change made offline before closing the app was merged on reopen",
    );
    assert.equal(snapshot.profile.name, "Renomeado no outro", "cloud change kept");
    assert.equal(snapshot.kaizen.length, 1);

    // 5) Sair da conta sem internet com mudança não enviada: avisa antes (sair apagaria).
    await offline(cloud, true);
    await page.reload({ waitUntil: "load" });
    await page.locator("[data-offline-banner]").waitFor({ timeout: 5000 });
    await page.locator("[data-action=ingles]").getByRole("checkbox").tap();
    await page.getByText("1 de 2 feitas").waitFor();
    await page.getByRole("button", { name: "Mais" }).tap();
    await page.getByRole("button", { name: "Sair da conta" }).tap();
    await page.getByText("Alterações não salvas").waitFor();
    await page.keyboard.press("Escape");
    await page.getByText("1 de 2 feitas").waitFor(); // continua logado, nada apagado
    assert.ok(
      await page.evaluate(() => localStorage.getItem("altus-sync-owner") !== null),
      "offline copy kept",
    );

    assert.deepEqual(errors, []);
    console.log(
      "PASS: production build served locally; after one online visit the app opens with no internet (service worker copy, offline notice), records an action and opens a route never visited; back online, the offline change is sent and another device's change is kept; an offline change made before closing the app is merged (not overwritten) when reopening online; signing out offline with unsent changes warns first; no page errors.",
    );
  } finally {
    await browser.close();
    await server.stop().catch(() => {});
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
