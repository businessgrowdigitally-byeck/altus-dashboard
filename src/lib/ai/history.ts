/**
 * Histórico enviado ao /api/chat. O chat salvo pode crescer sem limite, mas o
 * endpoint aceita no máximo MAX_CHAT_MESSAGES mensagens de até
 * MAX_CHAT_MESSAGE_CHARS caracteres — então enviamos só a janela recente válida.
 */

export const MAX_CHAT_MESSAGES = 24;
export const MAX_CHAT_MESSAGE_CHARS = 12_000;

export type HistoryMsg = { role: "user" | "assistant"; content: string; error?: boolean };

/** Mensagens de erro antigas (antes da flag `error`) eram salvas com este prefixo. */
const LEGACY_ERROR_PREFIX = "Erro: ";

function isSendable(m: HistoryMsg): boolean {
  if (m.role !== "user" && m.role !== "assistant") return false;
  if (typeof m.content !== "string" || !m.content.trim()) return false;
  if (m.error) return false;
  if (m.role === "assistant" && m.content.startsWith(LEGACY_ERROR_PREFIX)) return false;
  return true;
}

export function buildChatHistory(
  messages: HistoryMsg[],
  max = MAX_CHAT_MESSAGES,
): { role: "user" | "assistant"; content: string }[] {
  const out = messages
    .filter(isSendable)
    .slice(-max)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHAT_MESSAGE_CHARS) }));
  // A janela começa numa pergunta do usuário, nunca numa resposta solta.
  while (out.length > 0 && out[0].role !== "user") out.shift();
  return out;
}
