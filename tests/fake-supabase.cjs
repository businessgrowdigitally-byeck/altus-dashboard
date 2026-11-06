/**
 * Supabase falso para os testes de navegador: sessão aceita e a linha
 * `user_data` em memória, com o mesmo controle de versão do banco real
 * (`updated_at` muda a cada gravação; o update condicional só grava se a
 * versão bater). `remoteWrite` imita outro aparelho gravando no meio do teste.
 */
function fakeSupabase(page, { user, get, set }) {
  let n = 0;
  const nextVersion = () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000000+00:00`;
  let version = nextVersion();
  let failNext = false;
  const json = (route, status, body) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  const ready = page.route("https://oskwtnluunvdlbjptday.supabase.co/**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === "/rest/v1/user_data") {
      if (req.method() === "GET") return json(route, 200, { data: get(), updated_at: version });
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

  return {
    ready,
    /** Outro aparelho grava na nuvem: altera os dados e muda a versão. */
    remoteWrite(change) {
      set(change(JSON.parse(JSON.stringify(get()))), { remote: true });
      version = nextVersion();
    },
    version: () => version,
    /** A próxima gravação falha (ex.: internet caiu). */
    failNextWrite() {
      failNext = true;
    },
  };
}

module.exports = { fakeSupabase };
