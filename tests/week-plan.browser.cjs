const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Plano do dia, etapa 2: plano da semana e mudança na rotina fixa propostos pelo
// Mentor (prévia exata, nada salvo antes de confirmar), "Manter na rotina" na
// Home (com desfazer) e Rotina Diária / Blocos de foco seguindo o plano de cada
// data. Sessão falsa, Supabase em memória e /api/chat interceptado.
const pad = (n) => String(n).padStart(2, "0");
const d = (n) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const dow = (n) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][x.getDay()];
};
const today = d(0);
const all = [0, 1, 2, 3, 4, 5, 6];
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "week-plan@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const proposal = {
  weekPlan: {
    reason: "Prova de inglês daqui a 3 dias",
    days: [
      {
        date: d(1),
        adjust: [{ actionId: "ingles", durationMinutes: 60 }],
        postpone: [{ actionId: "leitura", to: d(2), reason: "mais estudo" }],
      },
      {
        date: today,
        adjust: [
          { actionId: "ingles", durationMinutes: 30 },
          { actionId: "treino", durationMinutes: 20, note: "versão mínima" },
        ],
      },
      {
        date: d(2),
        reason: "véspera: revisão",
        adjust: [{ actionId: "ingles", durationMinutes: 90 }],
      },
      { date: d(9), adjust: [{ actionId: "ingles", durationMinutes: 120 }] },
    ],
  },
  routineChanges: [
    { actionId: "treino", durationMinutes: 20, reason: "você fez 20 min em 4 dos últimos 7 dias" },
  ],
};
const reply =
  "Até a prova: inglês 30 → 60 → 90 min. A leitura de amanhã vai para depois de amanhã.\n\n```altus-plan\n" +
  JSON.stringify(proposal) +
  "\n```";
const sse = (text) =>
  text
    .match(/[\s\S]{1,40}/g)
    .map((chunk) => `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
    .join("") + "data: [DONE]\n\n";
const clean = (texts) => texts.map((t) => t.replace(/\s+/g, " ").trim());

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
      profile: { name: "Week Plan" },
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
      route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(reply) }),
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
    const routineOf = () => snapshot.goalsDaily.map((a) => [a.id, a.durationMinutes]);

    // 1) Mentor propõe a semana + mudança na rotina; nada muda antes de confirmar.
    await page.goto(base + "/agente", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Pergunte ao Mentor...").fill("Tenho prova de inglês em 3 dias");
    await page.keyboard.press("Enter");
    const card = page.locator('[data-plan-status="pending"]');
    await card.waitFor();
    const days = card.locator("[data-week-day]");
    assert.deepEqual(
      await days.evaluateAll((els) => els.map((e) => e.dataset.weekDay)),
      [today, d(1), d(2)],
      "sorted, only today … today+6",
    );
    assert.deepEqual(clean(await days.nth(0).locator("li").allInnerTexts()), [
      "Treinar · 20 min — versão mínima",
      "Inglês · 30 min",
      "Ler 30 minutos · 30 min",
    ]);
    assert.deepEqual(
      clean(await days.nth(1).locator("li").allInnerTexts()),
      ["Treinar · 30 min", "Inglês · 60 min"],
      "reading postponed out of tomorrow",
    );
    await days
      .nth(1)
      .getByText(/Ler 30 minutos → .*\(mais estudo\)/)
      .waitFor();
    await days.nth(2).getByText("véspera: revisão").waitFor();
    await days.nth(2).getByText("Total previsto: 150 min").waitFor();
    await days.nth(0).getByText("Prova de inglês daqui a 3 dias").waitFor();
    const routine = card.locator("[data-routine-preview]");
    assert.match(
      clean([await routine.innerText()])[0],
      /Treinar Duração: 30 min → 20 min você fez 20 min/,
    );
    assert.equal(snapshot.dayPlans, undefined, "nothing saved before confirming");
    assert.deepEqual(routineOf(), [
      ["treino", undefined],
      ["ingles", 45],
      ["leitura", undefined],
    ]);
    if (process.env.SCREENSHOT_DIR)
      await card.screenshot({ path: `${process.env.SCREENSHOT_DIR}/week-plan-card.png` });
    await card.getByRole("button", { name: "Confirmar e salvar" }).tap();
    await page
      .locator('[data-plan-status="saved"]')
      .getByText("Plano da semana salvo (3 dia(s)). Rotina atualizada (1 ação/ões).")
      .waitFor();
    await page.waitForTimeout(1500);
    assert.deepEqual(Object.keys(snapshot.dayPlans).sort(), [today, d(1), d(2)]);
    assert.equal(snapshot.dayPlans[d(1)].postponed[0].to, d(2));
    assert.deepEqual(routineOf(), [
      ["treino", 20],
      ["ingles", 45],
      ["leitura", undefined],
    ]);

    // 2) Home: hoje segue o plano; próximos dias avisados; "Manter na rotina".
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page
      .locator("[data-day-plan=mentor]")
      .getByText("Prova de inglês daqui a 3 dias")
      .waitFor();
    await page
      .locator("[data-upcoming-plans]")
      .getByText(/^Próximos dias ajustados: .+, .+$/)
      .waitFor();
    await page.locator("[data-action=ingles]").getByText("30 min").waitFor();
    const keep = page.locator("[data-keep-routine]");
    await keep.tap();
    await page.getByText("Rotina atualizada (1 ação/ões).").waitFor();
    await keep.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Desfazer" }).click();
    await keep.waitFor();
    await keep.tap();
    await page.waitForTimeout(1800);
    assert.deepEqual(routineOf(), [
      ["treino", 20],
      ["ingles", 30],
      ["leitura", undefined],
    ]);
    assert.deepEqual(snapshot.dayPlans[today].durations, {}, "durations left today's plan");
    assert.equal(snapshot.dayPlans[today].notes.treino, "versão mínima", "notes stay");
    // Já é a duração da rotina: a Home volta a mostrar o horário.
    await page.locator("[data-action=ingles]").getByText("20:00").waitFor();

    // 3) Rotina Diária e Blocos de foco seguem o plano de cada data.
    const goals = page.locator("#metas-e-acoes");
    await goals.getByRole("button", { name: "Rotina Diária", exact: true }).tap();
    await goals.getByRole("button", { name: dow(1), exact: true }).tap();
    await goals
      .locator("[data-routine-day-plan]")
      .getByText(/segue o plano do Mentor/)
      .waitFor();
    await goals.getByText("20:00–21:00").waitFor(); // inglês 60 min amanhã
    assert.equal(await goals.getByText("Ler 30 minutos").count(), 0, "postponed out of tomorrow");
    // Editar abre a rotina fixa (30 min), não a duração do dia (60).
    await goals.getByRole("button", { name: "Editar ação: Inglês", exact: true }).tap();
    assert.equal(
      await page
        .getByRole("dialog")
        .getByRole("spinbutton", { name: "Duração (minutos)" })
        .inputValue(),
      "30",
    );
    await page.keyboard.press("Escape");
    await goals.getByRole("button", { name: "Blocos de foco", exact: true }).tap();
    assert.equal(
      await goals.locator('[data-focus-block="ingles"]').evaluate((el) => el.style.height),
      "120px",
    );
    await goals.getByRole("button", { name: dow(2), exact: true }).tap();
    assert.equal(
      await goals.locator('[data-focus-block="ingles"]').evaluate((el) => el.style.height),
      "180px",
      "90 min on the eve",
    );
    await goals.locator('[data-focus-block="leitura"]').waitFor(); // trazida + rotina: uma vez só
    assert.equal(await goals.locator('[data-focus-block="leitura"]').count(), 1);
    if (process.env.SCREENSHOT_DIR)
      await goals.screenshot({ path: `${process.env.SCREENSHOT_DIR}/week-plan-focus.png` });
    // Um dia sem plano segue a rotina e não mostra o aviso.
    await goals.getByRole("button", { name: dow(4), exact: true }).tap();
    assert.equal(await goals.locator("[data-routine-day-plan]").count(), 0);
    assert.equal(
      await goals.locator('[data-focus-block="ingles"]').evaluate((el) => el.style.height),
      "60px",
    );

    assert.deepEqual(errors, []);
    console.log(
      "PASS: Mentor weekPlan + routineChanges card previews each day (order, minutes, postponed between days, totals, before → after) and saves only on confirm; Home follows today's plan, lists upcoming adjusted days, 'Manter na rotina' with undo saves durations to the routine; Rotina Diária list and focus blocks follow each date's plan, edit opens the fixed routine, plain days follow the routine; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
