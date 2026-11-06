/** Lembrete da manhã (notificação push) e a seção em Configurações. */
export const push = {
  // Notificação (montada no servidor, sem IA)
  "push.title": {
    pt: "Bom dia, {name}!",
    en: "Good morning, {name}!",
    es: "¡Buenos días, {name}!",
  },
  "push.titleNoName": { pt: "Bom dia!", en: "Good morning!", es: "¡Buenos días!" },
  "push.kaizen": {
    pt: "Seu 1% de hoje: {text}",
    en: "Your 1% for today: {text}",
    es: "Tu 1% de hoy: {text}",
  },
  "push.actions": {
    pt: "{n} ações hoje, comece por {name}",
    en: "{n} actions today, start with {name}",
    es: "{n} acciones hoy, empieza por {name}",
  },
  "push.actionsOne": {
    pt: "1 ação hoje: {name}",
    en: "1 action today: {name}",
    es: "1 acción hoy: {name}",
  },
  "push.actionsDone": {
    pt: "{n} ações hoje, todas feitas",
    en: "{n} actions today, all done",
    es: "{n} acciones hoy, todas hechas",
  },
  "push.testTitle": {
    pt: "Teste do lembrete da manhã",
    en: "Morning reminder test",
    es: "Prueba del recordatorio de la mañana",
  },
  "push.testBody": {
    pt: "Está funcionando! Todo dia às 7h30 chega o seu lembrete aqui.",
    en: "It works! Your reminder arrives here every day at 7:30 am.",
    es: "¡Funciona! Tu recordatorio llega aquí todos los días a las 7:30.",
  },

  // Configurações
  "push.section": {
    pt: "Lembrete da manhã",
    en: "Morning reminder",
    es: "Recordatorio de la mañana",
  },
  "push.desc": {
    pt: "Uma notificação no celular todo dia às 7h30 (horário de Brasília), mesmo com o app fechado: seu Kaizen de ontem e a primeira ação do dia. Se não houver nada para lembrar, ela não é enviada.",
    en: "A phone notification every day at 7:30 am (Brasília time), even with the app closed: yesterday's Kaizen and the day's first action. If there is nothing to remind you of, it is not sent.",
    es: "Una notificación en el celular todos los días a las 7:30 (hora de Brasilia), incluso con la app cerrada: tu Kaizen de ayer y la primera acción del día. Si no hay nada que recordar, no se envía.",
  },
  "push.enable": {
    pt: "Ativar lembrete da manhã",
    en: "Turn on morning reminder",
    es: "Activar recordatorio de la mañana",
  },
  "push.disable": { pt: "Desativar", en: "Turn off", es: "Desactivar" },
  "push.test": { pt: "Enviar teste", en: "Send test", es: "Enviar prueba" },
  "push.on": {
    pt: "Ativado neste aparelho.",
    en: "On for this device.",
    es: "Activado en este dispositivo.",
  },
  "push.off": {
    pt: "Desativado neste aparelho.",
    en: "Off for this device.",
    es: "Desactivado en este dispositivo.",
  },
  "push.unsupported": {
    pt: "Este navegador não recebe notificações. No Android, use o Chrome; no computador, Chrome, Edge, Firefox ou Safari.",
    en: "This browser can't receive notifications. On Android use Chrome; on a computer, Chrome, Edge, Firefox or Safari.",
    es: "Este navegador no recibe notificaciones. En Android usa Chrome; en la computadora, Chrome, Edge, Firefox o Safari.",
  },
  "push.iosInstall": {
    pt: "No iPhone, o lembrete só funciona com o ALTUS na Tela de Início (iOS 16.4 ou mais novo): toque em Compartilhar → Adicionar à Tela de Início, abra o ALTUS por lá e volte aqui.",
    en: "On iPhone, the reminder only works with ALTUS on the Home Screen (iOS 16.4 or newer): tap Share → Add to Home Screen, open ALTUS from there and come back here.",
    es: "En iPhone, el recordatorio solo funciona con ALTUS en la pantalla de inicio (iOS 16.4 o más reciente): toca Compartir → Agregar a inicio, abre ALTUS desde allí y vuelve aquí.",
  },
  "push.denied": {
    pt: "As notificações estão bloqueadas para este site. Libere nas configurações do navegador (ícone de cadeado ao lado do endereço) e tente de novo.",
    en: "Notifications are blocked for this site. Allow them in the browser settings (lock icon next to the address) and try again.",
    es: "Las notificaciones están bloqueadas para este sitio. Permítelas en la configuración del navegador (ícono de candado junto a la dirección) e inténtalo de nuevo.",
  },
  "push.notConfigured": {
    pt: "O lembrete ainda não foi configurado no servidor (falta a chave VAPID).",
    en: "The reminder is not configured on the server yet (missing VAPID key).",
    es: "El recordatorio aún no está configurado en el servidor (falta la clave VAPID).",
  },
  "push.enabledToast": {
    pt: "Lembrete da manhã ativado neste aparelho.",
    en: "Morning reminder turned on for this device.",
    es: "Recordatorio de la mañana activado en este dispositivo.",
  },
  "push.disabledToast": {
    pt: "Lembrete da manhã desativado neste aparelho.",
    en: "Morning reminder turned off for this device.",
    es: "Recordatorio de la mañana desactivado en este dispositivo.",
  },
  "push.testSent": {
    pt: "Teste enviado para {n} aparelho(s). Deve chegar em alguns segundos.",
    en: "Test sent to {n} device(s). It should arrive in a few seconds.",
    es: "Prueba enviada a {n} dispositivo(s). Debería llegar en unos segundos.",
  },
  "push.error": {
    pt: "Não foi possível concluir: {error}",
    en: "Could not complete: {error}",
    es: "No se pudo completar: {error}",
  },
} as const;
