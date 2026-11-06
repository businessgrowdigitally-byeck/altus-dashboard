/* ALTUS — service worker.
 *
 * 1) Lembrete da manhã: recebe o push (mesmo com o app fechado) e, ao tocar,
 *    foca a aba do app já aberta ou abre a Home.
 * 2) Modo offline: guarda uma cópia do app neste aparelho para ele abrir sem
 *    internet. Páginas: sempre a rede primeiro (nunca prende numa versão
 *    antiga); a cópia só é usada quando a rede falha. Arquivos de /assets/ têm
 *    nome com hash (não mudam): ficam guardados. Nada de /api/ nem do Supabase
 *    passa pela cópia — dados e IA continuam indo direto para a rede.
 */
const PAGES = "altus-pages-v1";
const ASSETS = "altus-assets-v1";
const KEEP = [PAGES, ASSETS];
const MAX_ASSETS = 200;
/** Rotas do app guardadas ao "aquecer" (para abrir offline mesmo sem ter visitado). */
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
const STATIC = [
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/goat-avatar.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("altus-") && !KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);

const isAsset = (url) => url.origin === self.location.origin && url.pathname.startsWith("/assets/");
const isStatic = (url) =>
  url.origin === self.location.origin &&
  (STATIC.includes(url.pathname) || url.pathname.startsWith("/icons/"));
const isFont = (url) => FONT_HOSTS.includes(url.hostname);

async function prune(cache) {
  const keys = await cache.keys();
  for (const req of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(req);
}

/** Página: rede primeiro; guarda a resposta boa; sem rede, a cópia (ou a Home). */
async function page(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok && (response.headers.get("content-type") || "").includes("text/html"))
      await cache.put(new URL(request.url).pathname, response.clone());
    return response;
  } catch (err) {
    const path = new URL(request.url).pathname;
    const cached = (await cache.match(path)) || (await cache.match("/"));
    if (cached) return cached;
    throw err;
  }
}

/** Arquivo com hash: a cópia vale para sempre; senão busca e guarda. */
async function asset(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await prune(cache);
  }
  return response;
}

/** Ícones, manifesto e fontes: entrega a cópia na hora e atualiza em segundo plano. */
async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return update;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(page(request));
  } else if (isAsset(url)) {
    event.respondWith(asset(request));
  } else if (isStatic(url) || isFont(url)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

/**
 * "Aquecer" (o app pede depois de abrir, só no build de produção): guarda as
 * páginas das rotas e os arquivos que elas usam, para abrirem offline mesmo sem
 * terem sido visitadas. No máximo a cada 6 h.
 */
let lastWarm = 0;
async function warm(extraUrls) {
  if (Date.now() - lastWarm < 6 * 3600 * 1000) return;
  lastWarm = Date.now();
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);
  const found = new Set(extraUrls.filter((u) => u.startsWith("/assets/")));
  for (const path of ROUTES) {
    try {
      const response = await fetch(path, { credentials: "same-origin" });
      if (!response.ok) continue;
      const html = await response.clone().text();
      await pages.put(path, response);
      for (const m of html.matchAll(/\/assets\/[A-Za-z0-9._\-/]+\.(?:js|css|woff2?|png|svg|webp)/g))
        found.add(m[0]);
    } catch {
      return; // sem rede: tenta de novo na próxima abertura
    }
  }
  for (const path of [...found, ...STATIC]) {
    if (await assets.match(path)) continue;
    try {
      const response = await fetch(path);
      if (response.ok) await assets.put(path, response);
    } catch {
      return;
    }
  }
  await prune(assets);
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "warm")
    event.waitUntil(warm(Array.isArray(data.urls) ? data.urls.map(String) : []));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "ALTUS";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      tag: typeof data.tag === "string" ? data.tag : "altus-lembrete-manha",
      data: { url: typeof data.url === "string" ? data.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Só abre páginas do próprio app.
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
