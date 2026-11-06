/* ALTUS — service worker do lembrete da manhã.
 *
 * Só cuida de notificações: recebe o push (mesmo com o app fechado) e, ao
 * tocar, foca a aba do app já aberta ou abre a Home. Não intercepta requisições
 * (sem "fetch"), então não muda nada no carregamento do app.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
