const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Home reorganizada: critérios de aceite em 390x844 (celular) e conferência no
// computador. Sessão falsa e Supabase em memória; nenhuma conta real.
const pad = (n) => String(n).padStart(2, "0");
const d = (n) => {
  const x = new Date();
  x.setDate(x.getDate() - n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const today = d(0);
const all = [0, 1, 2, 3, 4, 5, 6];
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "home-test@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const fullData = () => ({
  profile: { name: "Home Test", height: 1.75 },
  primaryAreas: ["financas", "corpo", "biblioteca", "estudos"],
  goalsMacro: [
    {
      id: "g1",
      name: "Chegar a 75kg",
      area: "Corpo & Saúde",
      type: "numerica",
      currentValue: 80,
      targetValue: 75,
      unit: "kg",
      linkedModule: null,
      createdAt: d(30),
    },
  ],
  goalsDaily: [
    { id: "a1", name: "Treinar", area: "Corpo & Saúde", suggestedTime: "07:00", daysOfWeek: all },
    {
      id: "a2",
      name: "Ler 30 minutos",
      area: "Biblioteca",
      suggestedTime: "22:00",
      daysOfWeek: all,
    },
    {
      id: "a3",
      name: "Registrar gastos",
      area: "Finanças",
      suggestedTime: "21:00",
      daysOfWeek: all,
    },
    { id: "a4", name: "Estudar 1h", area: "Estudos", daysOfWeek: all },
  ],
  completions: [1, 2, 3].map((n) => ({ date: d(n), actionId: "a1" })),
  weights: [
    { id: "w1", weight: 81.4, date: d(40) },
    { id: "w2", weight: 79.6, date: d(2) },
  ],
  transactions: [
    {
      id: "t1",
      type: "entrada",
      value: 5000,
      description: "Salário",
      category: "Investimento",
      date: d(10),
    },
  ],
  studies: [
    {
      id: "s1",
      date: d(1),
      topic: "TS",
      area: "Tecnologia",
      type: "Leitura",
      duration: 60,
      status: "concluido",
    },
  ],
  books: [
    { id: "b1", title: "Livro", author: "A", genre: "Negócios", finishedAt: d(20), rating: 5 },
  ],
});

async function open(browser, data, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let snapshot = data;
  const cloud = fakeSupabase(page, { user, get: () => snapshot, set: (x) => (snapshot = x) });
  await cloud.ready;
  await page.addInitScript(
    ({ user }) =>
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
  const base = (process.env.DEV_SERVER_URL || "http://127.0.0.1:3000/").replace(/\/$/, "");
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator("#sistema-diario").waitFor();
  return { ctx, page, errors, snap: () => snapshot };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    // ---- Celular, com ações ----
    const { ctx, page, errors, snap } = await open(
      browser,
      fullData(),
      { width: 390, height: 844 },
      true,
    );

    // "Hoje" e pelo menos 3 ações na primeira tela (sem rolar, acima da barra de baixo).
    const fold = await page.evaluate(() => {
      const nav = document.querySelector("nav[aria-label]").getBoundingClientRect().top;
      const title = [...document.querySelectorAll("#sistema-diario h3")][0].getBoundingClientRect();
      const rows = [...document.querySelectorAll("[data-action]")].map((r) =>
        r.getBoundingClientRect(),
      );
      return {
        scrollY: window.scrollY,
        titleVisible: title.top >= 0 && title.bottom <= nav,
        rowsVisible: rows.filter((r) => r.top >= 0 && r.bottom <= nav).length,
      };
    });
    assert.equal(fold.scrollY, 0);
    assert.ok(fold.titleVisible, "'Hoje' visible without scrolling");
    assert.ok(
      fold.rowsVisible >= 3,
      `at least 3 actions visible without scrolling (got ${fold.rowsVisible})`,
    );
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/home-390.png` });

    // Removidos da Home.
    for (const gone of [
      "Organize. Foque. Conquiste.",
      "ELEVE O SEU NÍVEL",
      "Relatório Executivo",
      "Áreas Prioritárias",
    ])
      assert.equal(await page.getByText(gone, { exact: true }).count(), 0, `"${gone}" removed`);

    // Progresso real: 0 de 4 → 0%, nunca 78%.
    assert.equal(await page.getByText("78%").count(), 0);
    await page.getByText("0%", { exact: true }).first().waitFor();

    // Semana e sequência: Treinar foi feita nos 3 dias anteriores, hoje ainda não.
    const row = page.locator("[data-action=a1]");
    assert.equal(await row.locator("[data-week]").getAttribute("data-week"), "3/7");
    assert.equal(await row.locator("[data-streak]").getAttribute("data-streak"), "3");
    await row.getByText("3/7 na semana").waitFor();

    // Tocar no nome NÃO marca.
    await row.getByText("Treinar", { exact: true }).tap();
    await page.waitForTimeout(400);
    const box = row.getByRole("checkbox");
    assert.equal(await box.getAttribute("aria-checked"), "false", "tapping the name does not mark");
    const size = await box.boundingBox();
    assert.ok(
      size.width >= 44 && size.height >= 44,
      `checkbox touch area ≥ 44px (${size.width}x${size.height})`,
    );

    // Tocar no checkbox marca e mostra "Desfazer"; desfazer desmarca.
    await box.tap();
    assert.equal(await box.getAttribute("aria-checked"), "true");
    await page.getByText("1 de 4 feitas").waitFor();
    await row.locator("[data-streak='4']").waitFor();
    const undo = page.getByRole("button", { name: "Desfazer" });
    await undo.waitFor();
    await undo.click();
    assert.equal(await box.getAttribute("aria-checked"), "false", "undo unmarks");
    // Marca de novo e confirma que vai para a nuvem.
    await box.tap();
    await page.waitForTimeout(1800);
    assert.ok(
      snap().completions.some((c) => c.actionId === "a1" && c.date === today),
      "saved to the cloud",
    );

    // Contadores: Metas / Ações de hoje / Feitas.
    assert.match(await page.locator("[data-counter=goals]").innerText(), /Metas\s+1/);
    assert.match(await page.locator("[data-counter=actions]").innerText(), /Ações de hoje\s+4/);
    assert.match(await page.locator("[data-counter=done]").innerText(), /Feitas\s+1\/4/);

    // Gráfico com abas: só as 4 áreas prioritárias; trocar para Peso mostra a variação.
    assert.equal(await page.locator("[data-chart-tab]").count(), 4);
    await page.locator("[data-chart-tab=corpo]").tap();
    await page.locator("[data-chart-active=corpo]").waitFor();
    assert.match(
      await page.locator("[data-chart-summary]").innerText(),
      /79\.6 kg · −1\.8 kg no período/,
    );

    // Insights: um cartão com contador e navegação.
    const count = page.locator("[data-insight-count]");
    const total = Number((await count.innerText()).split(" de ")[1]);
    assert.ok(total >= 2, "several real insights");
    assert.equal(await count.innerText(), `1 de ${total}`);
    const first = await page.locator("[data-insight]").innerText();
    await page.getByRole("button", { name: "Próximo insight" }).tap();
    assert.equal(await count.innerText(), `2 de ${total}`);
    assert.notEqual(await page.locator("[data-insight]").innerText(), first);

    // Atalhos.
    assert.equal(await page.locator("[data-shortcut=kaizen]").getAttribute("href"), "/kaizen");
    await page.locator("[data-shortcut=recent]").tap();
    await page.getByRole("dialog").getByText("Atividade Recente").waitFor();
    await page
      .getByRole("dialog")
      .getByText(/Salário/)
      .waitFor();
    await page.keyboard.press("Escape");

    // Botão "Áreas" abre o seletor existente.
    await page.getByRole("button", { name: "Áreas" }).tap();
    await page.getByRole("dialog").getByText("Áreas Prioritárias").waitFor();
    await page.keyboard.press("Escape");

    // Sem rolagem lateral no celular.
    const sw = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    assert.ok(sw, "no horizontal scroll");
    assert.deepEqual(errors, []);
    await ctx.close();

    // ---- Celular, sem ações: estado vazio, nunca porcentagem inventada ----
    const empty = fullData();
    empty.goalsDaily = [];
    empty.completions = [];
    const e = await open(browser, empty, { width: 390, height: 844 }, true);
    await e.page.locator("[data-empty-today]").waitFor();
    assert.equal(await e.page.getByText("78%").count(), 0);
    await e.page.getByText("0%", { exact: true }).first().waitFor();
    await e.page.getByRole("button", { name: "Criar uma ação" }).tap();
    // Abre a aba de ações diárias da seção de metas e rola até ela.
    const daily = e.page.getByRole("button", { name: "Rotina Diária", exact: true });
    await e.page.waitForFunction(() => {
      const el = document.getElementById("metas-e-acoes");
      return el && el.getBoundingClientRect().top < window.innerHeight;
    });
    assert.match(await daily.getAttribute("class"), /bg-gold/, "daily-actions tab opened");
    assert.deepEqual(e.errors, []);
    await e.ctx.close();

    // ---- Computador: mesma Home, layout md/lg ----
    const desk = await open(browser, fullData(), { width: 1280, height: 900 }, false);
    await desk.page.locator("[data-chart-tab]").first().waitFor();
    const deskSw = await desk.page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    assert.ok(deskSw);
    if (process.env.SCREENSHOT_DIR)
      await desk.page.screenshot({
        path: `${process.env.SCREENSHOT_DIR}/home-1280.png`,
        fullPage: true,
      });
    assert.deepEqual(desk.errors, []);
    await desk.ctx.close();

    console.log(
      "PASS: 'Hoje' + 3 actions above the fold at 390x844, removed blocks gone, real 0% (no 78%), week bar and streak, name tap does not mark, 44px checkbox marks with undo toast and saves, Metas/Ações counters, chart tabs with period change, insights carousel, shortcuts, Áreas modal, empty state opens daily-actions tab, desktop OK; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
