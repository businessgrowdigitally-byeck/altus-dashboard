const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Finanças (F3): saldo acumulado que não zera na virada do mês, saldo inicial,
// seletor de mês no idioma do app, orçamento por categoria, busca, lançamento
// recorrente sem duplicar e largura no celular. Sessão falsa e Supabase
// interceptado; nenhuma conta real nem gravação no banco.
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const cur = today.slice(0, 7);
const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 10);
const prev = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;
const text = (s) => s.replace(/\s+/g, " ").trim();

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
      email: "fin-test@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };
    let snapshot = {
      profile: { name: "Fin Test", height: 1.75, incomeTarget: 5000, maxExpenses: 400 },
      primaryAreas: ["financas"],
      transactions: [
        {
          id: "p1",
          type: "entrada",
          value: 5000,
          description: "Salário",
          category: "Investimento",
          date: `${prev}-05`,
        },
        {
          id: "p2",
          type: "saida",
          value: 2000,
          description: "Aluguel",
          category: "Moradia",
          date: `${prev}-10`,
        },
        {
          id: "c1",
          type: "saida",
          value: 500,
          description: "Mercado do mês",
          category: "Alimentação",
          date: `${cur}-01`,
        },
      ],
    };
    let writes = 0;
    const cloud = fakeSupabase(page, {
      user,
      get: () => snapshot,
      set: (data, opts) => {
        snapshot = data;
        if (!opts?.remote) writes++;
      },
    });
    await cloud.ready;
    await page.addInitScript(
      ({ user }) => {
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
        );
      },
      { user },
    );
    const base = (process.env.DEV_SERVER_URL || "http://127.0.0.1:3000/").replace(/\/$/, "");
    await page.goto(`${base}/financas`, { waitUntil: "networkidle" });

    const kpi = async (label) =>
      text(await page.locator(".glass", { hasText: label }).first().innerText());

    // 1) Novo mês: o resultado do mês reflete só o mês; o saldo acumulado não zera.
    assert.match(await kpi("Resultado do mês"), /-R\$ 500,00|R\$ -500,00|−R\$ 500,00/);
    assert.match(
      await kpi("Saldo acumulado"),
      /R\$ 2\.500,00/,
      "3.000 do mês anterior − 500 deste mês",
    );
    await page.getByText(/Defina seu saldo inicial em Configurações/).waitFor();
    // Meta de renda e teto de gastos de Configurações aparecem com progresso.
    assert.match(await kpi("Total Saídas"), /Teto de gastos: 125% de R\$ 400,00 · acima do teto/);
    assert.match(await kpi("Total Entradas"), /Meta de renda: 0% de R\$ 5\.000,00/);

    // 2) Seletor de mês no idioma do app, sem o nome em inglês do navegador.
    const picker = page.locator("[data-month-picker]");
    const label = text(await picker.innerText());
    assert.doesNotMatch(
      label,
      /January|February|March|April|May|June|July|August|September|October|November|December/,
    );
    await page.getByRole("button", { name: "Mês anterior" }).click();
    assert.equal(await picker.getAttribute("data-month-picker"), prev);
    assert.match(await kpi("Resultado do mês"), /R\$ 3\.000,00/);
    assert.match(await kpi("Saldo acumulado"), /R\$ 3\.000,00/);
    await page.getByRole("button", { name: "Mês atual" }).click();
    assert.equal(await picker.getAttribute("data-month-picker"), cur);

    // 3) Saldo inicial em Configurações entra no saldo acumulado.
    await page.goto(`${base}/configuracoes`, { waitUntil: "networkidle" });
    await page.locator("[data-opening-balance]").fill("1000");
    await page.waitForTimeout(1500);
    assert.equal(snapshot.profile.openingBalance, 1000);
    await page.goto(`${base}/financas`, { waitUntil: "networkidle" });
    assert.match(await kpi("Saldo acumulado"), /R\$ 3\.500,00/);
    await page.getByText(/Inclui saldo inicial de R\$\s1\.000,00/).waitFor();

    // 4) Orçamento por categoria.
    await page
      .getByRole("combobox", { name: "+ Definir orçamento para uma categoria" })
      .selectOption("Alimentação");
    await page.getByPlaceholder("Limite").fill("400");
    await page.getByPlaceholder("Limite").press("Enter");
    const budget = page.locator('[data-budget="Alimentação"]');
    assert.match(text(await budget.innerText()), /R\$ 500,00 de R\$ 400,00/);
    assert.match(text(await budget.innerText()), /Acima do limite/);

    // 5) Busca na lista de lançamentos.
    await page.locator("[data-tx-search]").fill("mercado");
    assert.equal(await page.locator("[data-tx]").count(), 1);
    await page.locator("[data-tx-search]").fill("nada-assim");
    await page.getByText("Nenhum lançamento encontrado com esse filtro.").waitFor();
    await page.locator("[data-tx-search]").fill("");

    // 6) Recorrente com o dia de hoje: lança agora, uma vez só.
    const form = page.locator("[data-recurring-form]");
    await form.getByRole("button", { name: "Entrada" }).click();
    await form.getByPlaceholder(/valor/i).fill("100");
    await form.getByPlaceholder(/descri/i).fill("Assinatura teste");
    await form.locator('input[type="number"][max="31"]').fill(String(now.getDate()));
    await form.getByRole("button", { name: "Adicionar recorrente" }).click();
    await page.locator("[data-recurring]").first().waitFor();
    await page.waitForTimeout(1500);
    const rec = snapshot.transactions.filter((t) => t.recurringId);
    assert.equal(rec.length, 1, "posted once");
    assert.equal(rec[0].date, today);
    assert.equal(snapshot.recurringTransactions[0].lastPostedMonth, cur);
    assert.deepEqual(snapshot.categoryBudgets, { Alimentação: 400 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    assert.equal(
      snapshot.transactions.filter((t) => t.recurringId).length,
      1,
      "no duplicate after reload",
    );
    assert.match(await kpi("Saldo acumulado"), /R\$ 3\.600,00/);
    assert.ok(writes > 0);

    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.SCREENSHOT_DIR}/financas-desktop.png`,
        fullPage: true,
      });

    // 7) Celular: a tela de Finanças não rola para o lado.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.SCREENSHOT_DIR}/financas-mobile.png`,
        fullPage: true,
      });
    const { sw, vw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      vw: document.documentElement.clientWidth,
    }));
    assert.ok(sw <= vw, `no horizontal scroll on mobile (scrollWidth ${sw} > ${vw})`);

    assert.deepEqual(errors, []);
    console.log(
      "PASS: accumulated balance survives month change, opening balance, localized month picker, income target and spending cap, category budget, search, recurring posted once, mobile width; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
