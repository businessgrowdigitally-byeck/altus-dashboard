const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      timezoneId: "UTC",
      viewport: { width: 1280, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "focus-test@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };
    let snapshot = {
      profile: { name: "Focus Test", height: 1.75 },
      primaryAreas: ["estudos"],
      goalsDaily: [
        {
          id: "study",
          name: "Estudar foco",
          area: "Estudos",
          suggestedTime: "09:00",
          durationMinutes: 45,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
        {
          id: "overlap",
          name: "Revisar foco",
          area: "Geral",
          suggestedTime: "09:30",
          durationMinutes: 60,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
        {
          id: "legacy",
          name: "Legado foco",
          area: "Geral",
          suggestedTime: "11:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
        {
          id: "unscheduled",
          name: "Sem hora foco",
          area: "Geral",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
        {
          id: "short",
          name: "Curto foco",
          area: "Geral",
          suggestedTime: "10:30",
          durationMinutes: 5,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
      ],
      completions: [],
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
    await page.goto(process.env.DEV_SERVER_URL || "http://127.0.0.1:3000/", {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "Rotina Diária", exact: true }).click();
    await page.getByRole("button", { name: "Blocos de foco", exact: true }).click();
    const block = page.locator('[data-focus-block="study"]');
    await block.waitFor();
    assert.equal(await block.evaluate((el) => el.style.height), "90px");
    const box1 = await block.boundingBox(),
      box2 = await page.locator('[data-focus-block="overlap"]').boundingBox();
    assert(box2.x > box1.x && box2.y > box1.y, "conflicts are side by side at the correct time");
    assert.equal(
      await page.locator('[data-focus-block="legacy"]').evaluate((el) => el.style.height),
      "60px",
    );
    await page
      .getByRole("region", { name: "Sem horário", exact: true })
      .getByText("Sem hora foco", { exact: true })
      .waitFor();
    await block.getByRole("checkbox").click();
    assert.equal(await block.getByRole("checkbox").getAttribute("aria-checked"), "true");
    assert.equal(await block.evaluate((el) => el.style.top), "1080px");
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Concluir ação: Estudar foco", exact: true })
        .getAttribute("aria-checked"),
      "true",
    );
    await page.getByRole("button", { name: "Editar ação: Estudar foco", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("spinbutton", { name: "Duração (minutos)", exact: true }).fill("60");
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.getByRole("button", { name: "Editar ação: Sem hora foco", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Horário sugerido", { exact: true }).fill("14:00");
    await page
      .getByRole("dialog")
      .getByRole("spinbutton", { name: "Duração (minutos)", exact: true })
      .fill("25");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar", exact: true }).click();
    await page.getByRole("button", { name: "Blocos de foco", exact: true }).click();
    assert.equal(
      await page.locator('[data-focus-block="study"]').evaluate((el) => el.style.height),
      "120px",
    );
    assert.equal(
      await page.locator('[data-focus-block="unscheduled"]').evaluate((el) => el.style.top),
      "1680px",
    );
    await page.locator('[data-focus-block="short"]').getByRole("button").click();
    const details = page.getByRole("region", { name: "Detalhes do bloco", exact: true });
    await details.getByRole("checkbox").click();
    assert.equal(await details.getByRole("checkbox").getAttribute("aria-checked"), "true");
    await page.getByRole("button", { name: "Fechar detalhes", exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("altus-v2")).state.goalsDaily.find((a) => a.id === "study")
          .durationMinutes === 60,
    );
    await page.waitForTimeout(1600);
    assert(writes > 0);
    assert.equal(snapshot.goalsDaily.find((a) => a.id === "study").durationMinutes, 60);
    assert(snapshot.completions.some((c) => c.actionId === "study"));
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Rotina Diária", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Blocos de foco", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.locator('[data-focus-block="study"]').waitFor();
    assert.equal(
      await page.locator('[data-focus-block="study"]').evaluate((el) => el.style.height),
      "120px",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      "no mobile horizontal overflow",
    );
    const today = new Date().getDay();
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    await page.getByRole("button", { name: days[(today + 1) % 7], exact: true }).click();
    assert(await page.locator('[data-focus-block="study"]').getByRole("checkbox").isDisabled());
    assert.equal(await page.getByLabel("Horário atual", { exact: true }).count(), 0);
    // Reopen today just before midnight and verify completion moves to the new date.
    await page.clock.install({
      time: new Date(new Date().toISOString().slice(0, 10) + "T23:59:40Z"),
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Rotina Diária", exact: true }).click();
    await page.locator('[data-focus-block="study"]').waitFor();
    assert.equal(
      await page
        .locator('[data-focus-block="study"]')
        .getByRole("checkbox")
        .getAttribute("aria-checked"),
      "true",
    );
    await page.clock.fastForward(31000);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-focus-block="study"] [role="checkbox"]')
          .getAttribute("aria-checked") === "false",
    );
    assert.equal(await page.getByLabel("Horário atual", { exact: true }).count(), 1);
    assert.equal(
      await page.locator('[data-focus-block="study"]').getByRole("checkbox").isDisabled(),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: hydrated agenda, overlap geometry, legacy fallback, unscheduled actions, completion/list consistency, duration editing, short blocks, mocked sync roundtrip, reload preference, mobile, weekday preview and midnight rollover; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
