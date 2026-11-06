const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fakeSupabase } = require("./fake-supabase.cjs");

// Mentor ALTUS smoke test: proposal → confirmation card → save → sync → reload.
// Covers the Macro Goal link (create), the single General Plan, ALTUS Filter
// decisions and the migration of plans saved in the previous format. Fake
// session, Supabase and /api/chat are intercepted in the browser; no real
// account, model call or database write.
const planProposal = {
  macroGoalName: "Chegar a 75kg",
  macroGoal: {
    area: "Corpo & Saúde",
    type: "numerica",
    currentValue: 80,
    targetValue: 75,
    unit: "kg",
  },
  indicator: "Peso semanal",
  deadline: "2027-03-01",
  strategy: "Treino 4x por semana",
  activeStageId: "s1",
  stages: [
    { id: "s1", title: "Base de treino", status: "ativa", actions: [] },
    { id: "s2", title: "Ajuste fino", status: "pendente", actions: [] },
  ],
  microGoals: [{ title: "Agendar 4 treinos", stageId: "s1", estimateMinutes: 15 }],
  changeSummary: "Plano inicial",
};
const generalAndFilter = {
  generalPlan: { focusGoalIds: ["g-fin"], capacity: "1h por dia útil" },
  filterDecisions: [
    {
      idea: "Curso de day trade",
      verdict: "descartar",
      rationale: "Desalinhado",
      nextAction: "Nenhuma",
    },
  ],
  changeSummary: "Foco em finanças",
};
const wrap = (text, obj) => `${text}\n\n\`\`\`altus-plan\n${JSON.stringify(obj)}\n\`\`\``;
const replies = [
  wrap("Proponho salvar este planejamento.", planProposal),
  wrap("Proponho atualizar o P.G. e registrar o Filtro.", generalAndFilter),
  wrap("Outra versão.", planProposal),
];
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "plan-test@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };
    let snapshot = {
      profile: { name: "Plan Test", height: 1.75 },
      primaryAreas: ["corpo"],
      chat: [],
      goalsMacro: [
        {
          id: "g-fin",
          name: "Economizar R$20.000",
          area: "Finanças",
          type: "numerica",
          currentValue: 8000,
          targetValue: 20000,
          unit: "R$",
          linkedModule: null,
          createdAt: "2026-09-01",
        },
      ],
      // Saved by the previous version: P.G. and parked ideas inside the plan.
      altusPlans: [
        {
          id: "legacy",
          macroGoalId: "g-fin",
          macroGoalName: "Economizar R$20.000",
          generalPlanning: "Finanças em foco até dezembro.",
          indicator: "Saldo mensal",
          deadline: "2026-12-31",
          strategy: "Cortar gastos",
          activeStageId: null,
          stages: [],
          microGoals: [],
          decisions: [],
          results: [],
          reviews: [],
          parkedIdeas: [{ date: "2026-10-02", text: "Abrir loja online" }],
          nextReview: "2026-11-10",
          version: 1,
          history: [{ version: 1, date: "2026-10-01", summary: "Inicial" }],
          createdAt: "2026-10-01T10:00:00.000Z",
          updatedAt: "2026-10-01T10:00:00.000Z",
        },
      ],
    };
    let writes = 0;
    let chatCalls = 0;
    const cloud = fakeSupabase(page, {
      user,
      get: () => snapshot,
      set: (data, opts) => {
        snapshot = data;
        if (!opts?.remote) writes++;
      },
    });
    await cloud.ready;
    await page.route("**/api/chat", async (route) => {
      // O resumo da manhã do GOAT segue para o Supabase falso.
      if (route.request().postDataJSON()?.mode === "briefing") return route.fallback();
      chatCalls++;
      const body = route.request().postDataJSON();
      assert.equal(body.messages.at(-1).role, "user");
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sse(replies[chatCalls - 1]),
      });
    });
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
    await page.goto(`${base}/agente`, { waitUntil: "networkidle" });

    // Quick prompts show translated text, not dictionary keys.
    assert.equal(await page.getByText("agente.quick1").count(), 0);

    // Page texts: Mentor ALTUS, Gemini disclosure, no "Lovable AI".
    await page.getByRole("heading", { name: "GOAT" }).waitFor();
    await page.getByText(/respostas geradas pelo Google Gemini/).waitFor();
    await page.getByText(/Nada é salvo sem a sua confirmação/).waitFor();
    assert.equal(await page.getByText("Lovable AI").count(), 0);

    const ask = async (text) => {
      await page.getByPlaceholder("Pergunte ao GOAT...").fill(text);
      await page.keyboard.press("Enter");
      const card = page.locator('[data-plan-status="pending"]');
      await card.waitFor();
      return card;
    };

    // 1) A plan whose Macro Goal does not exist yet: the link is mandatory.
    const card = await ask("Monte meu plano para chegar a 75kg");
    assert.equal(await page.getByText("```altus-plan").count(), 0, "raw block is hidden");
    assert.equal(await page.getByText('"macroGoalName"').count(), 0, "raw JSON is hidden");
    await card.getByText("Base de treino").waitFor();
    await card.getByText("Agendar 4 treinos · 15 min").waitFor();
    await card.getByText("Novo planejamento").waitFor();
    const select = card.locator("[data-macro-link]");
    assert.equal(
      await select.inputValue(),
      "__create__",
      "no goal with that name: create by default",
    );
    assert.equal(snapshot.altusPlans.length, 1, "nothing is saved before confirmation");
    assert.equal(snapshot.goalsMacro.length, 1);
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/agente-plan-card.png` });

    await card.getByRole("button", { name: "Confirmar e salvar" }).click();
    await page.getByText("Planejamento salvo (versão 1).").first().waitFor();
    await page.waitForFunction(() => true);
    assert.ok(writes > 0, "sync pushed to the cloud");
    assert.equal(snapshot.goalsMacro.length, 2, "Macro Goal created in the app");
    const created = snapshot.goalsMacro.find((g) => g.name === "Chegar a 75kg");
    assert.equal(created.targetValue, 75);
    assert.equal(created.area, "Corpo & Saúde");
    const plan = snapshot.altusPlans.find((p) => p.macroGoalName === "Chegar a 75kg");
    assert.equal(plan.macroGoalId, created.id, "plan linked to the new goal");
    assert.equal(plan.version, 1);
    // Previous-format data was migrated, not duplicated.
    const legacy = snapshot.altusPlans.find((p) => p.id === "legacy");
    assert.equal("generalPlanning" in legacy, false);
    assert.equal("parkedIdeas" in legacy, false);
    assert.equal(
      snapshot.altusGeneralPlan.summary,
      "Economizar R$20.000: Finanças em foco até dezembro.",
    );
    assert.deepEqual(
      snapshot.altusFilter.map((f) => [f.idea, f.verdict]),
      [["Abrir loja online", "estacionar"]],
    );

    // 2) General Plan revision + an ALTUS Filter decision.
    const second = await ask("Atualize meu P.G.");
    await second.getByText("Revisão: versão 1 → 2").waitFor();
    await second.getByText("Economizar R$20.000").first().waitFor();
    await second
      .locator('[data-filter-verdict="descartar"]')
      .getByText("DESCARTAR POR ENQUANTO")
      .waitFor();
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.SCREENSHOT_DIR}/agente-general-filter-card.png`,
      });
    await second.getByRole("button", { name: "Confirmar e salvar" }).click();
    await page.getByText("P.G. salvo (versão 2).", { exact: false }).first().waitFor();
    await page.waitForFunction(() => true);
    assert.equal(snapshot.altusGeneralPlan.version, 2);
    assert.deepEqual(snapshot.altusGeneralPlan.focusGoalIds, ["g-fin"]);
    assert.equal(snapshot.altusGeneralPlan.capacity, "1h por dia útil");
    assert.match(snapshot.altusGeneralPlan.summary, /Finanças em foco/, "summary kept");
    assert.equal(snapshot.altusFilter[0].idea, "Curso de day trade");
    assert.equal(snapshot.altusFilter[0].verdict, "descartar");
    assert.equal(snapshot.altusPlans.length, 2);
    assert.equal(
      snapshot.chat.some((m) => m.error),
      false,
    );

    // After reload the decisions are restored from the cloud: no save buttons.
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-plan-status="saved"]').count(), 2);
    assert.equal(await page.getByRole("button", { name: "Confirmar e salvar" }).count(), 0);

    // 3) A proposal can be discarded without saving.
    const third = await ask("E outra versão?");
    // Same name as the goal just created: the link defaults to it (no duplicate goal),
    // and since that goal has a plan the proposal revises it (no second plan).
    assert.equal(await third.locator("[data-macro-link]").inputValue(), created.id);
    await third.getByText("Revisão: versão 1 → 2").waitFor();
    await third.getByRole("button", { name: "Descartar" }).click();
    await page.locator('[data-plan-status="discarded"]').waitFor();
    await page.waitForTimeout(1500);
    assert.equal(snapshot.altusPlans.length, 2);
    assert.equal(snapshot.goalsMacro.length, 2);

    assert.deepEqual(errors, []);
    console.log(
      "PASS: page texts, hidden altus-plan block, mandatory Macro Goal link (created), legacy data migrated, General Plan revision, ALTUS Filter decision, save + sync, reload keeps decisions, discard saves nothing; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
