const { chromium } = require("playwright");
const assert = require("node:assert/strict");

// Tela de Planejamento (F5): P.G., planejamentos com etapa ativa, Metas Micro
// marcáveis, vínculo manual de um plano antigo, aviso de revisão vencida com
// atalho para o Mentor, e decisões do Filtro ALTUS com filtro e exclusão.
// Sessão falsa e Supabase interceptado; nenhuma conta real nem gravação no banco.
const pad = (n) => String(n).padStart(2, "0");
const iso = (offset) => {
  const x = new Date();
  x.setDate(x.getDate() + offset);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const plan = (over) => ({
  indicator: "",
  deadline: "",
  strategy: "",
  activeStageId: null,
  stages: [],
  microGoals: [],
  decisions: [],
  results: [],
  reviews: [],
  version: 1,
  history: [{ version: 1, date: iso(-10), summary: "Plano inicial" }],
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  ...over,
});
const goal = (id, name) => ({
  id,
  name,
  area: "Geral",
  type: "numerica",
  currentValue: 0,
  targetValue: 10,
  unit: "x",
  linkedModule: null,
  createdAt: iso(-30),
});

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("dialog", (d) => d.accept());
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "plan-view@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };
    let snapshot = {
      profile: { name: "Plan View" },
      primaryAreas: ["financas"],
      goalsMacro: [goal("g1", "Chegar a 75kg"), goal("g2", "Ler 12 livros")],
      altusGeneralPlan: {
        summary: "Saúde em foco; finanças em manutenção.",
        focusGoalIds: ["g1"],
        maintenanceGoalIds: ["g2"],
        capacity: "1h por dia útil",
        constraints: "Viagem em dezembro",
        version: 2,
        history: [
          { version: 1, date: iso(-20), summary: "P.G. inicial" },
          { version: 2, date: iso(-5), summary: "Ajuste de capacidade" },
        ],
        createdAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-20T10:00:00.000Z",
      },
      altusPlans: [
        plan({
          id: "p1",
          macroGoalId: "g1",
          macroGoalName: "Chegar a 75kg",
          indicator: "Peso semanal",
          activeStageId: "s1",
          stages: [
            {
              id: "s1",
              title: "Base de treino",
              status: "ativa",
              doneCriteria: "4 semanas",
              actions: [],
            },
            { id: "s2", title: "Ajuste fino", status: "pendente", actions: [] },
          ],
          microGoals: [
            { id: "m1", title: "Agendar 4 treinos", status: "concluida" },
            { id: "m2", title: "Comprar balança", status: "pendente", estimateMinutes: 20 },
          ],
          results: [{ date: iso(-3), text: "-1 kg" }],
          nextReview: iso(-1),
        }),
        plan({
          id: "p2",
          macroGoalId: null,
          macroGoalName: "Plano antigo de leitura",
          nextReview: iso(5),
        }),
      ],
      altusFilter: [
        {
          id: "f1",
          date: iso(-2),
          idea: "Curso de day trade",
          verdict: "descartar",
          rationale: "Desalinhado",
          nextAction: "",
          macroGoalId: null,
          planId: null,
        },
        {
          id: "f2",
          date: iso(-2),
          idea: "Comprar bicicleta",
          verdict: "estacionar",
          rationale: "",
          nextAction: "",
          macroGoalId: "g1",
          planId: "p1",
        },
        {
          id: "f3",
          date: iso(-1),
          idea: "Treino de 20 min em casa",
          verdict: "testar",
          rationale: "Hipótese",
          nextAction: "Testar 1 semana",
          macroGoalId: "g1",
          planId: "p1",
        },
      ],
    };
    let writes = 0;
    await page.route("https://oskwtnluunvdlbjptday.supabase.co/**", async (route) => {
      const req = route.request();
      if (req.url().includes("/rest/v1/user_data")) {
        if (req.method() === "GET")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: snapshot }),
          });
        if (req.method() === "POST") {
          snapshot = req.postDataJSON().data;
          writes++;
          return route.fulfill({ status: 201, body: "" });
        }
      }
      if (req.url().includes("/auth/v1/user"))
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(user),
        });
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
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
    await page.goto(base + "/", { waitUntil: "networkidle" });

    // Menu leva à tela.
    await page.getByRole("link", { name: "Planejamento ALTUS" }).first().click();
    await page.getByRole("heading", { name: "Planejamento ALTUS", level: 1 }).waitFor();

    // P.G. único com metas pelo nome.
    const general = page.locator("[data-general]").locator("..");
    await general.getByText("Versão 2").waitFor();
    await general.getByText("Saúde em foco; finanças em manutenção.").waitFor();
    await general.getByText("Chegar a 75kg").first().waitFor();
    await general.getByText("Viagem em dezembro").waitFor();

    // Plano com etapa ativa, resultados separados de ações e progresso das Metas Micro.
    const p1 = page.locator("[data-plan=p1]").locator("..");
    await p1.getByText("etapa ativa: Base de treino", { exact: false }).waitFor();
    await p1.getByText("1 de 2 concluídas", { exact: false }).waitFor();
    await p1.getByText("-1 kg", { exact: false }).waitFor();
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.SCREENSHOT_DIR}/planejamento-desktop.png`,
        fullPage: true,
      });

    // Marcar uma Meta Micro.
    await page.locator("[data-micro=m2]").click();
    assert.equal(await page.locator("[data-micro=m2]").getAttribute("aria-checked"), "true");
    await p1.getByText("2 de 2 concluídas", { exact: false }).waitFor();
    await page.waitForTimeout(1500);
    assert.equal(snapshot.altusPlans.find((p) => p.id === "p1").microGoals[1].status, "concluida");

    // Plano antigo sem vínculo: só oferece metas sem outro plano (g1 já tem o p1).
    const unlinked = page.locator("[data-plan=p2]").locator("..").locator("[data-unlinked]");
    const select = unlinked.getByRole("combobox");
    const offered = await select.locator("option").allTextContents();
    assert.deepEqual(offered.slice(1), ["Ler 12 livros"]);
    await select.selectOption("g2");
    await page
      .locator("[data-plan=p2]")
      .locator("..")
      .locator("[data-unlinked]")
      .waitFor({ state: "detached" });
    await page.waitForTimeout(1500);
    const p2 = snapshot.altusPlans.find((p) => p.id === "p2");
    assert.equal(p2.macroGoalId, "g2");
    assert.equal(p2.macroGoalName, "Ler 12 livros");
    assert.equal(p2.version, 1, "linking is not a new plan version");

    // Filtro ALTUS: filtrar por veredito e excluir uma decisão.
    await page.getByRole("button", { name: "ESTACIONAR (1)" }).click();
    assert.equal(await page.locator("[data-decision]").count(), 1);
    await page.getByRole("button", { name: "Todas (3)" }).click();
    assert.equal(await page.locator("[data-decision]").count(), 3);
    await page.locator("[data-decision=f1]").getByRole("button").click();
    await page.locator("[data-decision=f1]").waitFor({ state: "detached" });
    await page.waitForTimeout(1500);
    assert.deepEqual(
      snapshot.altusFilter.map((d) => d.id),
      ["f2", "f3"],
    );

    // Revisão vencida → abre o Mentor com a pergunta preenchida, sem enviar.
    const overdue = page.locator("[data-overdue]");
    await overdue.getByText("Chegar a 75kg", { exact: false }).waitFor();
    let chatCalls = 0;
    await page.route("**/api/chat", (route) => {
      chatCalls++;
      return route.abort();
    });
    await overdue.getByRole("link", { name: "Fazer a revisão com o Mentor" }).click();
    await page.waitForURL(/\/agente\?q=/);
    const input = page.getByPlaceholder("Pergunte ao Mentor...");
    await input.waitFor();
    assert.match(await input.inputValue(), /revisão semanal do planejamento: Chegar a 75kg/);
    assert.equal(chatCalls, 0, "prefill does not send");

    // Recarregar mantém tudo vindo da nuvem.
    await page.goto(base + "/planejamento", { waitUntil: "networkidle" });
    assert.equal(await page.locator("[data-micro=m2]").getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("[data-unlinked]").count(), 0);
    assert.ok(writes > 0);

    assert.deepEqual(errors, []);
    console.log(
      "PASS: menu, single P.G., plan with active stage, results and Micro Goal progress, toggle Micro Goal, manual Macro Goal link (one plan per goal), Filter by verdict and delete, overdue review prefills the Mentor without sending, reload keeps changes; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
