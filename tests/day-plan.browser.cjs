const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Plano do dia: reordenar/adiar à mão na Home e proposta do Mentor para hoje
// (confirmar no chat → Home segue o plano). Sessão falsa, Supabase em memória
// e /api/chat interceptado; nenhuma conta real, chamada ao modelo ou gravação.
const pad = (n) => String(n).padStart(2, "0");
const d = (n) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const today = d(0);
const tomorrow = d(1);
const all = [0, 1, 2, 3, 4, 5, 6];
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "day-plan@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const proposal = {
  dayPlan: {
    reason: "Prova de inglês na próxima semana",
    order: ["ingles", "extra:0", "treino"],
    adjust: [{ actionId: "treino", durationMinutes: 20, note: "versão mínima" }],
    postpone: [{ actionId: "leitura", to: tomorrow, reason: "foco na prova" }],
    extras: [{ title: "Simulado de listening", minutes: 40 }],
  },
};
const reply =
  "Hoje o foco é a prova: inglês primeiro, um simulado e treino curto. A leitura vai para amanhã.\n\n```altus-plan\n" +
  JSON.stringify(proposal) +
  "\n```";
const sse = (text) =>
  text
    .match(/[\s\S]{1,40}/g)
    .map((chunk) => `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
    .join("") + "data: [DONE]\n\n";

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
    let snapshot = {
      profile: { name: "Day Plan" },
      primaryAreas: ["estudos"],
      goalsDaily: [
        {
          id: "treino",
          name: "Treinar",
          area: "Corpo & Saúde",
          suggestedTime: "07:00",
          daysOfWeek: all,
        },
        {
          id: "ingles",
          name: "Inglês",
          area: "Estudos",
          suggestedTime: "20:00",
          durationMinutes: 45,
          daysOfWeek: all,
        },
        {
          id: "leitura",
          name: "Ler 30 minutos",
          area: "Biblioteca",
          suggestedTime: "22:00",
          daysOfWeek: all,
        },
      ],
      completions: [],
    };
    const cloud = fakeSupabase(page, { user, get: () => snapshot, set: (x) => (snapshot = x) });
    await cloud.ready;
    await page.route("**/api/chat", (route) =>
      // O resumo da manhã do GOAT segue para o Supabase falso.
      route.request().postDataJSON()?.mode === "briefing"
        ? route.fallback()
        : route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(reply) }),
    );
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
    const order = () =>
      page
        .locator("#sistema-diario [data-action], #sistema-diario [data-extra]")
        .evaluateAll((els) => els.map((e) => e.dataset.action || e.dataset.extra));
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.locator("[data-action=treino]").waitFor();
    assert.deepEqual(await order(), ["treino", "ingles", "leitura"], "routine order by time");

    // 1) À mão: descer o treino e adiar a leitura para amanhã.
    await page.locator("[data-edit-order]").tap();
    await page.getByRole("button", { name: "Descer Treinar" }).tap();
    assert.deepEqual(await order(), ["ingles", "treino", "leitura"]);
    await page.getByRole("button", { name: "Adiar Ler 30 minutos para amanhã" }).tap();
    assert.deepEqual(await order(), ["ingles", "treino"]);
    await page.getByRole("button", { name: "Desfazer" }).click();
    assert.deepEqual(await order(), ["ingles", "treino", "leitura"], "undo brings it back");
    await page.getByRole("button", { name: "Adiar Ler 30 minutos para amanhã" }).tap();
    await page.locator("[data-edit-order]").tap();
    await page.locator("[data-day-plan=manual]").getByText("Ajustado por você").waitFor();
    await page
      .locator("[data-postponed]")
      .getByText(/Adiada: Ler 30 minutos →/)
      .waitFor();
    await page.getByText("0 de 2 feitas").waitFor();
    await page.waitForTimeout(1800);
    assert.deepEqual(
      snapshot.dayPlans[today].order,
      ["ingles", "treino"],
      "postponed leaves the order",
    );
    assert.deepEqual(
      snapshot.dayPlans[today].postponed.map((p) => [p.actionId, p.to]),
      [["leitura", tomorrow]],
    );
    // Voltar à rotina.
    await page.getByRole("button", { name: "Voltar à rotina" }).tap();
    assert.deepEqual(await order(), ["treino", "ingles", "leitura"]);
    await page.waitForTimeout(1800);
    assert.equal(snapshot.dayPlans[today], undefined);

    // 2) Mentor: propõe o plano de hoje; nada muda antes de confirmar.
    await page.goto(base + "/agente", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Pergunte ao GOAT...").fill("Hoje vou focar na prova de inglês");
    await page.keyboard.press("Enter");
    const card = page.locator('[data-plan-status="pending"]');
    await card.waitFor();
    const preview = await card.locator("[data-day-preview] li").allInnerTexts();
    assert.deepEqual(
      preview.map((t) => t.replace(/\s+/g, " ").trim()),
      [
        "Inglês · 45 min",
        "Simulado de listening · 40 min (extra)",
        "Treinar · 20 min — versão mínima",
      ],
    );
    await card.getByText("Total previsto: 105 min").waitFor();
    await card.getByText(/Ler 30 minutos → .*\(foco na prova\)/).waitFor();
    assert.equal(snapshot.dayPlans?.[today], undefined, "nothing saved before confirming");
    if (process.env.SCREENSHOT_DIR)
      await card.screenshot({ path: `${process.env.SCREENSHOT_DIR}/day-plan-card.png` });
    await card.getByRole("button", { name: "Confirmar e salvar" }).tap();
    await page.getByText("Plano de hoje salvo.").first().waitFor();
    await page.waitForTimeout(1500);
    assert.equal(snapshot.dayPlans[today].source, "mentor");

    // 3) A Home segue o plano do GOAT.
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page
      .locator("[data-day-plan=mentor]")
      .getByText("Prova de inglês na próxima semana")
      .waitFor();
    const keys = await order();
    assert.equal(keys[0], "ingles");
    assert.match(keys[1], /^extra-/);
    assert.equal(keys[2], "treino");
    assert.equal(keys.length, 3, "reading postponed");
    await page.locator("[data-action=treino]").getByText("20 min").waitFor();
    await page.locator("[data-action=treino]").getByText("versão mínima").waitFor();
    // O extra pode ser marcado e conta no progresso.
    await page.locator("[data-extra]").getByRole("checkbox").tap();
    await page.getByText("1 de 3 feitas").waitFor();
    if (process.env.SCREENSHOT_DIR)
      await page
        .locator("#sistema-diario")
        .screenshot({ path: `${process.env.SCREENSHOT_DIR}/day-plan-home.png` });

    assert.deepEqual(errors, []);
    console.log(
      "PASS: routine order, manual move/postpone with undo and reset (saved), Mentor dayPlan card previews exactly and saves only on confirm, Home follows the Mentor plan (order, minutes, note, extra, postponed), extra counts in progress; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
