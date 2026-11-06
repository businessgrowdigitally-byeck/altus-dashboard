/**
 * Lê a resposta em streaming do /api/chat (SSE no formato OpenAI) e devolve o
 * texto acumulado. `onText` recebe o texto parcial a cada pedaço recebido.
 */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onText?: (acc: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let acc = "";
  let done = false;

  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          acc += delta;
          onText?.(acc);
        }
      } catch {
        // Linha JSON incompleta: espera o próximo pedaço.
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
  return acc;
}
