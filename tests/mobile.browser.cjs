const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Mobile (F4): em dois tamanhos de celular, nenhuma tela rola para o lado,
// todos os campos têm fonte ≥ 16px (o iPhone dá zoom automático abaixo disso),
// a tela do Mentor cabe na tela com o campo de digitar acima da barra de
// navegação, e os botões de editar/excluir ficam visíveis sem mouse.
// Sessão falsa e Supabase interceptado; nenhuma conta real nem gravação no banco.
const ROUTES = [
  "/",
  "/financas",
  "/corpo",
  "/biblioteca",
  "/estudos",
  "/kaizen",
  "/agente",
  "/planejamento",
  "/configuracoes",
];
const VIEWPORTS = [
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPhone SE", width: 375, height: 667 },
];

const pad = (n) => String(n).padStart(2, "0");
const d = (n) => {
  const x = new Date();
  x.setDate(x.getDate() - n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const snapshot = {
  profile: {
    name: "Mobile Test",
    height: 1.75,
    goalWeight: 75,
    incomeTarget: 10000,
    maxExpenses: 6000,
  },
  primaryAreas: ["financas", "corpo", "biblioteca", "estudos"],
  transactions: Array.from({ length: 12 }, (_, i) => ({
    id: "t" + i,
    type: i % 3 ? "saida" : "entrada",
    value: 100 * (i + 1),
    description: "Lançamento com uma descrição bem comprida número " + i,
    category: "Alimentação",
    date: d(i * 4),
  })),
  weights: [{ id: "w1", weight: 80, date: d(3), notes: "Observação" }],
  workouts: [{ id: "k1", date: d(1), type: "Musculação", duration: 60 }],
  books: [
    {
      id: "b1",
      title: "Um título de livro bem comprido para testar",
      author: "Autor",
      genre: "Negócios",
      finishedAt: d(5),
      rating: 5,
    },
  ],
  studies: [
    {
      id: "s1",
      date: d(2),
      topic: "Tópico de estudo comprido",
      area: "Tecnologia",
      type: "Leitura",
      duration: 45,
      status: "concluido",
    },
  ],
  kaizen: [
    {
      id: "z1",
      date: d(1),
      improvedToday: "Algo",
      improveTomorrow: "Outra coisa",
      notes: "",
      createdAt: d(1),
      updatedAt: d(1),
    },
  ],
  goalsMacro: [
    {
      id: "g1",
      name: "Economizar R$20.000 para a reserva de emergência",
      area: "Finanças",
      type: "numerica",
      currentValue: 8000,
      targetValue: 20000,
      unit: "R$",
      linkedModule: null,
      createdAt: d(30),
    },
  ],
  goalsDaily: [
    {
      id: "a1",
      name: "Treinar",
      area: "Corpo & Saúde",
      suggestedTime: "07:00",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    },
  ],
  altusGeneralPlan: {
    summary: "Uma visão geral comprida ".repeat(10),
    focusGoalIds: ["g1"],
    maintenanceGoalIds: [],
    capacity: "1h por dia",
    constraints: "Nenhuma",
    version: 1,
    history: [{ version: 1, date: d(5), summary: "P.G. inicial" }],
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  },
  altusPlans: [
    {
      id: "p1",
      macroGoalId: null,
      macroGoalName: "Um planejamento antigo com nome comprido sem vínculo",
      indicator: "Indicador",
      deadline: "2027-01-01",
      strategy: "Estratégia ".repeat(20),
      activeStageId: "s1",
      stages: [
        {
          id: "s1",
          title: "Etapa com um título bem comprido para testar",
          status: "ativa",
          actions: [],
        },
      ],
      microGoals: [
        {
          id: "m1",
          title: "Uma Meta Micro com descrição comprida",
          status: "pendente",
          estimateMinutes: 30,
        },
      ],
      decisions: [],
      results: [],
      reviews: [],
      nextReview: d(1),
      version: 1,
      history: [],
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
  ],
  altusFilter: [
    {
      id: "f1",
      date: d(1),
      idea: "Uma ideia com texto comprido para testar a quebra",
      verdict: "testar",
      rationale: "Motivo",
      nextAction: "Ação",
      macroGoalId: "g1",
      planId: null,
    },
  ],
  chat: [
    { role: "user", content: "Oi" },
    {
      role: "assistant",
      content:
        "Uma **Meta Macro** é o resultado final concreto.\n\n*   **Área:** Qual setor?\n*   **Prazo:** Quando?\n    *   **Alvo:** R$ 10.000,00\n\n---\n\n" +
        "Olá! ".repeat(60),
    },
  ],
};
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "mobile-test@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};

async function setup(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cloud = fakeSupabase(page, {
    user,
    get: () => snapshot,
    set: () => {},
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
  return { ctx, page, errors };
}

/** Rolagem lateral e campos com fonte < 16px na tela atual. */
const measure = (page) =>
  page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth,
    small: [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => el.offsetParent && el.type !== "checkbox" && el.type !== "radio")
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map(
        (el) => `${el.tagName.toLowerCase()}[${el.type || ""}] ${getComputedStyle(el).fontSize}`,
      ),
  }));

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const base = (process.env.DEV_SERVER_URL || "http://127.0.0.1:3000/").replace(/\/$/, "");
  try {
    for (const vp of VIEWPORTS) {
      const { ctx, page, errors } = await setup(browser, vp);

      for (const path of ROUTES) {
        await page.goto(base + path, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        const m = await measure(page);
        assert.ok(m.sw <= m.vw, `${vp.name} ${path}: horizontal scroll (${m.sw} > ${m.vw})`);
        assert.deepEqual(m.small, [], `${vp.name} ${path}: fields that trigger iOS zoom`);
      }

      // Mentor: cabe na tela, campo de digitar acima da barra de navegação, sem o botão +.
      await page.goto(base + "/agente", { waitUntil: "networkidle" });
      const chat = await page.evaluate(() => {
        const box = (el) => el && el.getBoundingClientRect();
        const input = box(document.querySelector('input[placeholder="Pergunte ao GOAT..."]'));
        const nav = box(document.querySelector("nav[aria-label]"));
        return {
          inputTop: input.top,
          inputBottom: input.bottom,
          navTop: nav.top,
          pageH: document.documentElement.scrollHeight,
          vh: innerHeight,
          fab: !!document.querySelector("button.fixed.bottom-20"),
        };
      });
      assert.ok(
        chat.inputBottom <= chat.navTop,
        `${vp.name}: chat input hidden behind the bottom nav`,
      );
      assert.ok(chat.inputTop >= 0, `${vp.name}: chat input above the screen`);
      assert.ok(
        chat.pageH <= chat.vh + 1,
        `${vp.name}: chat page scrolls (${chat.pageH} > ${chat.vh})`,
      );
      assert.equal(chat.fab, false, `${vp.name}: + button covers the chat`);
      await page.getByPlaceholder("Pergunte ao GOAT...").tap();
      // Markdown do Mentor formatado: sem ** nem marcadores de lista à mostra.
      const shown = await page.locator("[data-markdown]").first().innerText();
      assert.doesNotMatch(shown, /\*\*|^\s*\*\s|^---$/m, `${vp.name}: raw Markdown visible`);
      assert.equal(
        await page.locator("[data-markdown] strong", { hasText: "Meta Macro" }).count(),
        1,
      );

      // Editar/excluir visíveis sem mouse (antes só apareciam com hover).
      await page.goto(base + "/", { waitUntil: "networkidle" });
      // Dentro da seção de metas (o nome também aparece no "Foco da semana" da Home).
      const goalActions = await page
        .locator("#metas-e-acoes")
        .getByText("Economizar R$20.000 para a reserva de emergência")
        .first()
        .evaluate((el) => {
          const card = el.closest(".group");
          const actions = card && card.querySelector("button")?.parentElement;
          return actions ? getComputedStyle(actions).opacity : null;
        });
      assert.equal(goalActions, "1", `${vp.name}: goal edit/delete buttons invisible on touch`);
      for (const path of ["/corpo", "/estudos", "/kaizen", "/biblioteca"]) {
        await page.goto(base + path, { waitUntil: "networkidle" });
        const hidden = await page.evaluate(
          () =>
            [...document.querySelectorAll(".group button")].filter(
              (b) => b.offsetParent && getComputedStyle(b.parentElement).opacity === "0",
            ).length,
        );
        assert.equal(hidden, 0, `${vp.name} ${path}: action buttons invisible on touch`);
      }

      // Modal do botão +: cabe na largura e não dá zoom.
      await page.goto(base + "/", { waitUntil: "networkidle" });
      await page.locator("button.fixed.bottom-20").tap();
      await page.getByRole("dialog").first().getByRole("button").nth(1).tap();
      await page.waitForTimeout(300);
      const modal = await measure(page);
      assert.ok(modal.sw <= modal.vw, `${vp.name}: quick-add modal scrolls horizontally`);
      assert.deepEqual(modal.small, [], `${vp.name}: quick-add modal fields trigger zoom`);
      const box = await page.getByRole("dialog").last().locator("> div").last().boundingBox();
      assert.ok(
        box.y >= 0 && box.y + box.height <= vp.height + 1,
        `${vp.name}: modal taller than the screen`,
      );
      if (process.env.SCREENSHOT_DIR)
        await page.screenshot({
          path: `${process.env.SCREENSHOT_DIR}/mobile-${vp.width}-quickadd.png`,
        });

      if (process.env.SCREENSHOT_DIR) {
        await page.goto(base + "/agente", { waitUntil: "networkidle" });
        await page.screenshot({
          path: `${process.env.SCREENSHOT_DIR}/mobile-${vp.width}-agente.png`,
        });
      }
      assert.deepEqual(errors, [], `${vp.name}: page errors`);
      await ctx.close();
    }

    // Computador: os botões continuam aparecendo só ao passar o mouse.
    const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const { page } = { page: desk };
    const cloud = fakeSupabase(page, {
      user,
      get: () => snapshot,
      set: () => {},
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
    await page.goto(base + "/corpo", { waitUntil: "networkidle" });
    const deskHidden = await page.evaluate(
      () =>
        [...document.querySelectorAll(".group button")].filter(
          (b) => b.offsetParent && getComputedStyle(b.parentElement).opacity === "0",
        ).length,
    );
    assert.ok(deskHidden > 0, "desktop keeps hover-reveal for row actions");
    await page.close();

    console.log(
      "PASS: 2 phone sizes × 9 screens without horizontal scroll or zoom-triggering fields; Mentor fits the screen with the input above the nav and no + button; edit/delete visible on touch; quick-add modal fits; desktop hover-reveal kept; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
