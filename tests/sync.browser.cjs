const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Sincronização entre aparelhos (F7): outro aparelho grava enquanto este está
// aberto; nada se perde, e o que o outro salvou aparece ao voltar para o app.
// Também: erro ao salvar não troca a tela nem perde o que foi digitado.
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const tx = (id, description, value) => ({
  id,
  type: "saida",
  value,
  description,
  category: "Outros",
  date: today,
});

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "sync-test@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };
    let snapshot = {
      profile: { name: "Sync Test" },
      primaryAreas: ["financas"],
      transactions: [tx("t1", "Lançamento antigo", 10)],
    };
    const cloud = fakeSupabase(page, {
      user,
      get: () => snapshot,
      set: (data) => {
        snapshot = data;
      },
    });
    await cloud.ready;
    await page.addInitScript(
      ({ user }) =>
        localStorage.setItem(
          "altus-auth",
          JSON.stringify({
            access_token: "test-only-access-token",
            refresh_token: "test-only-refresh-token",
            expires_at: 4102444800,
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        ),
      { user },
    );
    const base = (process.env.DEV_SERVER_URL || "http://127.0.0.1:3000/").replace(/\/$/, "");
    await page.goto(base + "/financas", { waitUntil: "networkidle" });
    await page.getByText("Lançamento antigo").waitFor();
    const ids = () => snapshot.transactions.map((t) => t.id).sort();

    // 1) O notebook grava; este aparelho (sem saber) registra outro lançamento.
    cloud.remoteWrite((d) => ({
      ...d,
      transactions: [tx("laptop", "Feito no notebook", 20), ...d.transactions],
    }));
    const form = page.locator("form").first();
    await form.getByPlaceholder(/valor/i).fill("30");
    await form.getByPlaceholder(/descri/i).fill("Feito no celular");
    await form.getByRole("button", { name: "Registrar" }).click();
    await page.waitForTimeout(2500);
    assert.equal(ids().length, 3, `nothing lost in the cloud: ${ids()}`);
    assert.ok(snapshot.transactions.some((t) => t.description === "Feito no celular"));
    assert.ok(snapshot.transactions.some((t) => t.id === "laptop"));
    // E o lançamento do notebook aparece aqui, sem recarregar.
    await page.getByText("Feito no notebook").waitFor();

    // 2) Ao voltar para o app, o que o outro aparelho salvou aparece.
    cloud.remoteWrite((d) => ({
      ...d,
      transactions: [tx("tablet", "Feito no tablet", 40), ...d.transactions],
    }));
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByText("Feito no tablet").waitFor();
    await page.waitForTimeout(1500);
    assert.equal(ids().length, 4, "refresh does not rewrite or drop anything");

    // 3) Erro ao salvar: o app continua na tela e salva na alteração seguinte.
    cloud.failNextWrite();
    await form.getByPlaceholder(/valor/i).fill("50");
    await form.getByPlaceholder(/descri/i).fill("Durante a falha");
    await form.getByRole("button", { name: "Registrar" }).click();
    await page.waitForTimeout(2000);
    assert.equal(
      await page.getByRole("heading", { name: "Central Financeira" }).count(),
      1,
      "app still on screen",
    );
    assert.equal(await page.getByText("Durante a falha").count(), 1, "typed entry kept locally");
    await form.getByPlaceholder(/valor/i).fill("60");
    await form.getByPlaceholder(/descri/i).fill("Depois da falha");
    await form.getByRole("button", { name: "Registrar" }).click();
    await page.waitForTimeout(2500);
    const descs = snapshot.transactions.map((t) => t.description);
    assert.ok(
      descs.includes("Durante a falha") && descs.includes("Depois da falha"),
      `saved after the error: ${descs}`,
    );
    assert.equal(snapshot.transactions.length, 6);

    // 4) Recarregar mostra tudo.
    await page.reload({ waitUntil: "networkidle" });
    for (const d of [
      "Feito no notebook",
      "Feito no celular",
      "Feito no tablet",
      "Durante a falha",
      "Depois da falha",
    ])
      await page.getByText(d).waitFor();

    assert.deepEqual(errors, []);
    console.log(
      "PASS: concurrent write from another device merged (nothing lost, shown here), refresh on return brings remote changes, save error keeps the app and the entry and saves next time, reload shows everything; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
