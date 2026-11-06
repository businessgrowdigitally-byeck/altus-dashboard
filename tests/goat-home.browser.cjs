const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Home com o GOAT: cartão de "bom dia" (1x por manhã, com o resumo do GOAT, o
// Kaizen de ontem e a primeira ação), resumo gerado 1x por dia e reaproveitado,
// insights com sujeito e números, sino de notificações e "Hoje" como Blocos de
// foco. Relógio do navegador fixado às 8h30; Supabase e /api/chat falsos.
const pad = (n) => String(n).padStart(2, "0");
const d = (n) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const today = d(0);
const all = [0, 1, 2, 3, 4, 5, 6];
const BRIEFING = "Comece pelo inglês: é a etapa ativa do seu P.E. Depois, um treino curto.";
const KAIZEN = "BGD Finance as the resource to make money";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "goat-home@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const morning = new Date();
    morning.setHours(8, 30, 0, 0);
    await page.clock.setFixedTime(morning);
    let snapshot = {
      profile: { name: "Ana" },
      primaryAreas: ["estudos", "agente"],
      goalsDaily: [
        {
          id: "ingles",
          name: "Inglês",
          area: "Estudos",
          suggestedTime: "20:00",
          durationMinutes: 45,
          daysOfWeek: all,
        },
        {
          id: "treino",
          name: "Treinar",
          area: "Corpo & Saúde",
          suggestedTime: "07:00",
          daysOfWeek: all,
        },
      ],
      completions: [],
      kaizen: [
        {
          id: "k1",
          date: d(-1),
          improvedToday: "Fechei o relatório",
          improveTomorrow: KAIZEN,
          notes: "",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      transactions: [
        {
          id: "t1",
          type: "saida",
          value: 46,
          description: "Mercado",
          category: "Mercado",
          date: d(-1),
        },
        {
          id: "t2",
          type: "saida",
          value: 100,
          description: "Mercado",
          category: "Mercado",
          date: d(-8),
        },
      ],
    };
    const cloud = fakeSupabase(page, {
      user,
      get: () => snapshot,
      set: (x) => (snapshot = x),
      morning: true,
      briefing: BRIEFING,
    });
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

    // 1) Bom dia: resumo do GOAT, Kaizen de ontem e a primeira ação do dia.
    await page.goto(base + "/", { waitUntil: "networkidle" });
    const card = page.locator("[data-morning-card]");
    await card.waitFor();
    await page.getByRole("heading", { name: "Bom dia, Ana!" }).waitFor();
    await card.locator("[data-morning-briefing]").getByText(BRIEFING).waitFor();
    await card.locator("[data-morning-kaizen]").getByText(KAIZEN).waitFor();
    await card
      .locator("[data-morning-today]")
      .getByText("2 ação(ões) no dia. Comece por: Treinar.")
      .waitFor();
    assert.equal(cloud.briefingCalls(), 1, "one GOAT summary request");
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/goat-morning.png` });
    await card.getByRole("button", { name: "Começar o dia" }).tap();
    await card.waitFor({ state: "detached" });
    await page.waitForTimeout(1800);
    assert.ok(snapshot.notificationsSeen.includes(`morning:${today}`), "dismissal synced");
    assert.deepEqual(snapshot.dailyBriefing, { date: today, text: BRIEFING, lang: "pt" });

    // 2) Recarregar: o cartão não volta e o resumo não é pedido de novo.
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-action=treino]").waitFor();
    await page.waitForTimeout(500);
    assert.equal(await page.locator("[data-morning-card]").count(), 0);
    assert.equal(cloud.briefingCalls(), 1, "summary reused (1 per day)");

    // 3) Insights: o resumo do GOAT primeiro; gastos dizem o que são, com os valores.
    const insight = page.locator("[data-insight]");
    assert.equal(await insight.innerText(), `GOAT: ${BRIEFING}`);
    const seen = [];
    const total = Number(
      (await page.locator("[data-insight-count]").innerText()).split(/\D+/).pop(),
    );
    for (let i = 0; i < total; i++) {
      seen.push((await insight.innerText()).replace(/\s/g, " "));
      if (i < total - 1) await page.getByRole("button", { name: "Próximo insight" }).tap();
    }
    assert.ok(
      seen.includes(`Kaizen de ontem — seu 1% de hoje: ${KAIZEN}`),
      `kaizen insight in ${JSON.stringify(seen)}`,
    );
    assert.ok(
      seen.some((s) =>
        /^Gastos: R\$ 46,00 nos últimos 7 dias, 54% a menos que nos 7 anteriores \(R\$ 100,00\)\.$/.test(
          s,
        ),
      ),
      `spending insight in ${JSON.stringify(seen)}`,
    );
    assert.ok(
      seen.some((s) => s.startsWith("Rotina: 0 de ")),
      "routine insight",
    );
    assert.ok(!seen.some((s) => /^\d+% (menos|mais)/.test(s)), "no bare percentage");

    // 4) Sino: 2 novidades (resumo e Kaizen); abrir marca como lido.
    const bell = page.locator("[data-notif-bell]:visible");
    await bell.locator("[data-notif-count]").getByText("2").waitFor();
    await bell.tap();
    const panel = page.getByRole("dialog");
    await panel.getByRole("heading", { name: "Notificações" }).waitFor();
    assert.deepEqual(
      await panel
        .locator("[data-notif-item]")
        .evaluateAll((els) => els.map((e) => e.dataset.notifItem)),
      ["briefing", "kaizen"],
    );
    await panel.getByText(`Kaizen de ontem — seu 1% de hoje: ${KAIZEN}`).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await bell.locator("[data-notif-count]").count(), 0, "read");
    await page.waitForTimeout(1800);
    assert.ok(snapshot.notificationsSeen.includes(`kaizen:${today}`));

    // 5) "Hoje" como Blocos de foco (agenda do dia) e de volta ao checklist.
    await page.locator("[data-today-view=focus]").tap();
    const focus = page.locator("[data-today-focus]");
    await focus.waitFor();
    assert.equal(
      await focus.locator('[data-focus-block="ingles"]').evaluate((el) => el.style.height),
      "90px",
    );
    await focus.locator('[data-focus-block="treino"]').getByRole("checkbox").tap();
    await page.getByText("1 de 2 feitas").waitFor();
    if (process.env.SCREENSHOT_DIR)
      await page
        .locator("#sistema-diario")
        .screenshot({ path: `${process.env.SCREENSHOT_DIR}/goat-today-focus.png` });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-today-focus]").waitFor(); // preferência lembrada
    await page.locator("[data-today-view=checklist]").tap();
    await page.locator("[data-action=ingles]").waitFor();

    // 6) O mentor agora se chama GOAT.
    await page.goto(base + "/agente", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "GOAT" }).waitFor();
    await page.getByPlaceholder("Pergunte ao GOAT...").waitFor();
    // O ícone do GOAT é a cabra (imagem carregada), no menu de baixo e na tela vazia.
    const goats = await page
      .locator("[data-goat-icon]:visible")
      .evaluateAll((els) => els.map((e) => e.complete && e.naturalWidth > 0));
    assert.ok(goats.length >= 2 && goats.every(Boolean), `goat icons loaded: ${goats}`);

    assert.deepEqual(errors, []);
    console.log(
      "PASS: morning card once per morning (GOAT summary, yesterday's Kaizen, first action) and dismissal synced; summary generated once and reused; insights start with GOAT and say what they are about (spending with amounts, Kaizen, routine); bell shows 2 unread, lists them and marks read; 'Hoje' switches to focus blocks (plan durations, completion) and remembers the view; Mentor renamed GOAT; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
