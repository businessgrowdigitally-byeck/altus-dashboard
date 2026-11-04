const { chromium } = require("playwright");
const assert = require("node:assert/strict");

// F1 smoke test: Mentor proposal → confirmation card → save → sync → reload.
// Fake session, Supabase and /api/chat are intercepted in the browser; no real
// account, model call or database write.
const proposal = {
  macroGoalName: "Chegar a 75kg",
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
const replyText =
  "Proponho salvar este planejamento.\n\n```altus-plan\n" + JSON.stringify(proposal) + "\n```";
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
      altusPlans: [],
    };
    let writes = 0;
    let chatCalls = 0;
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
    await page.route("**/api/chat", async (route) => {
      chatCalls++;
      const body = route.request().postDataJSON();
      assert.equal(body.messages.at(-1).role, "user");
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(replyText) });
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

    await page
      .getByPlaceholder("Pergunte ao seu agente...")
      .fill("Monte meu plano para chegar a 75kg");
    await page.keyboard.press("Enter");
    const card = page.locator('[data-plan-status="pending"]');
    await card.waitFor();
    assert.equal(chatCalls, 1);
    assert.equal(await page.getByText("```altus-plan").count(), 0, "raw block is hidden");
    assert.equal(await page.getByText('"macroGoalName"').count(), 0, "raw JSON is hidden");
    await card.getByText("Base de treino").waitFor();
    await card.getByText("Agendar 4 treinos · 15 min").waitFor();
    await card.getByText("Novo planejamento").waitFor();
    assert.equal(snapshot.altusPlans.length, 0, "nothing is saved before confirmation");
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/agente-plan-card.png` });

    await card.getByRole("button", { name: "Confirmar e salvar" }).click();
    await page.locator('[data-plan-status="saved"]').waitFor();
    await page.getByText("Planejamento salvo (versão 1).").first().waitFor();
    await page.waitForFunction(() => true);
    assert.ok(writes > 0, "sync pushed to the cloud");
    assert.equal(snapshot.altusPlans.length, 1);
    assert.equal(snapshot.altusPlans[0].version, 1);
    assert.equal(snapshot.altusPlans[0].macroGoalName, "Chegar a 75kg");
    assert.equal(snapshot.altusPlans[0].activeStageId, "s1");
    const savedMsg = snapshot.chat.find((m) => m.plan);
    assert.equal(savedMsg.plan.status, "saved");
    assert.equal(savedMsg.plan.version, 1);
    assert.equal(
      snapshot.chat.some((m) => m.error),
      false,
    );

    // After reload the decision is restored from the cloud: no second save button.
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-plan-status="saved"]').waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirmar e salvar" }).count(), 0);

    // A new proposal for the same goal can be discarded without saving.
    await page.getByPlaceholder("Pergunte ao seu agente...").fill("E outra versão?");
    await page.keyboard.press("Enter");
    const second = page.locator('[data-plan-status="pending"]');
    await second.waitFor();
    await second.getByRole("button", { name: "Descartar" }).click();
    await page.locator('[data-plan-status="discarded"]').waitFor();
    await page.waitForTimeout(1500);
    assert.equal(snapshot.altusPlans.length, 1);
    assert.equal(snapshot.altusPlans[0].version, 1);

    assert.deepEqual(errors, []);
    console.log(
      "PASS: translated quick prompts, hidden altus-plan block, confirmation card, nothing saved before confirm, save + sync, reload keeps decision, discard saves nothing; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
