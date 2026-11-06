/**
 * Supabase falso para os testes de navegador: sessão aceita e a linha
 * `user_data` em memória, com o mesmo controle de versão do banco real
 * (`updated_at` muda a cada gravação; o update condicional só grava se a
 * versão bater). `remoteWrite` imita outro aparelho gravando no meio do teste.
 */
const pad = (n) => String(n).padStart(2, "0");
const dates = () =>
  [-1, 0, 1].flatMap((k) => {
    const d = new Date(Date.now() + k * 86400000);
    return [
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      d.toISOString().slice(0, 10),
    ];
  });

/**
 * Por padrão o cartão de "bom dia" já aparece como visto (os testes rodam a
 * qualquer hora e ele cobriria a Home de manhã) e o resumo do GOAT responde
 * "indisponível" sem chamar o servidor. `morning: true` e `briefing: "texto"`
 * ligam cada um.
 */
function fakeSupabase(page, { user, get, set, morning = false, briefing = null }) {
  let n = 0;
  const nextVersion = () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000000+00:00`;
  let version = nextVersion();
  let failNext = false;
  let offline = false;
  const json = (route, status, body) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  const ready = page.route("https://oskwtnluunvdlbjptday.supabase.co/**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (offline) return route.abort("internetdisconnected");
    if (url.pathname === "/rest/v1/user_data") {
      if (req.method() === "GET") {
        const data = get();
        const seen = Array.isArray(data.notificationsSeen) ? data.notificationsSeen : [];
        return json(route, 200, {
          data: morning
            ? data
            : { ...data, notificationsSeen: [...dates().map((d) => `morning:${d}`), ...seen] },
          updated_at: version,
        });
      }
      if (req.method() === "PATCH" && failNext) {
        failNext = false;
        return json(route, 500, { code: "XX000", message: "falha simulada" });
      }
      if (req.method() === "PATCH") {
        const expected = (url.searchParams.get("updated_at") || "").replace(/^eq\./, "");
        if (expected !== version) return json(route, 200, []); // outro aparelho gravou antes
        set(req.postDataJSON().data);
        version = nextVersion();
        return json(route, 200, [{ updated_at: version }]);
      }
      if (req.method() === "POST") {
        set(req.postDataJSON().data);
        version = nextVersion();
        return json(route, 201, [{ updated_at: version }]);
      }
    }
    if (url.pathname === "/auth/v1/user") return json(route, 200, user);
    return json(route, 200, {});
  });

  let briefingCalls = 0;
  // Resumo da manhã do GOAT (mode "briefing" no /api/chat). Os testes que
  // interceptam o chat devem deixar esse pedido passar (route.fallback()).
  const briefingRoute = page.route("**/api/chat", (route) => {
    let body = {};
    try {
      body = route.request().postDataJSON() || {};
    } catch {
      /* sem corpo JSON */
    }
    if (body.mode !== "briefing") return route.fallback();
    briefingCalls++;
    if (!briefing) return json(route, 503, { error: "indisponível no teste" });
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: briefing } }] })}\n\ndata: [DONE]\n\n`,
    });
  });

  return {
    ready: Promise.all([ready, briefingRoute]),
    /** Quantas vezes o app pediu o resumo do GOAT. */
    briefingCalls: () => briefingCalls,
    /** Outro aparelho grava na nuvem: altera os dados e muda a versão. */
    remoteWrite(change) {
      set(change(JSON.parse(JSON.stringify(get()))), { remote: true });
      version = nextVersion();
    },
    version: () => version,
    /** Simula estar sem internet: toda chamada ao Supabase falha como falha de rede. */
    setOffline(value) {
      offline = value;
    },
    /** A próxima gravação falha (ex.: internet caiu). */
    failNextWrite() {
      failNext = true;
    },
  };
}

module.exports = { fakeSupabase };
