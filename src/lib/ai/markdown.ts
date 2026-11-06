/**
 * Leitor de Markdown simples para as respostas do Mentor (o Gemini responde em
 * Markdown). Gera uma estrutura de dados que o componente transforma em
 * elementos React — nunca HTML cru, então nada do texto do modelo é executado.
 *
 * Suporta: parágrafos, títulos (#), listas com - * + ou 1., separador (---),
 * **negrito**, __negrito__, *itálico*, _itálico_ e `código`.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] }
  | { type: "code"; text: string };

export type Block =
  | { type: "paragraph"; lines: Inline[][] }
  | { type: "heading"; level: number; children: Inline[] }
  | { type: "list"; ordered: boolean; items: { depth: number; children: Inline[] }[] }
  | { type: "hr" };

const HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ type: "text", text: buf });
    buf = "";
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (rest[0] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    const strong = rest.startsWith("**") ? "**" : rest.startsWith("__") ? "__" : null;
    if (strong) {
      const end = text.indexOf(strong, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: "bold", children: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    const em = rest[0] === "*" || rest[0] === "_" ? rest[0] : null;
    // `_` dentro de palavras (snake_case) não é itálico.
    const prev = text[i - 1] ?? " ";
    if (em && rest[1] && rest[1] !== " " && rest[1] !== em && !(em === "_" && /\w/.test(prev))) {
      const end = text.indexOf(em, i + 1);
      const after = text[end + 1] ?? " ";
      if (end > i + 1 && text[end - 1] !== " " && !(em === "_" && /\w/.test(after))) {
        flush();
        out.push({ type: "italic", children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: Inline[][] = [];
  const endPara = () => {
    if (para.length) blocks.push({ type: "paragraph", lines: para });
    para = [];
  };

  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      endPara();
      continue;
    }
    if (HR.test(line)) {
      endPara();
      blocks.push({ type: "hr" });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      endPara();
      blocks.push({ type: "heading", level: h[1].length, children: parseInline(h[2]) });
      continue;
    }
    const b = BULLET.exec(line);
    const o = b ? null : ORDERED.exec(line);
    if (b || o) {
      endPara();
      const m = (b ?? o)!;
      const ordered = !b;
      const depth = Math.min(3, Math.floor(m[1].replace(/\t/g, "    ").length / 2));
      const last = blocks[blocks.length - 1];
      const item = { depth, children: parseInline(m[3]) };
      // Itens aninhados (depth > 0) continuam a lista de cima, de qualquer tipo.
      if (last?.type === "list" && (last.ordered === ordered || depth > 0)) last.items.push(item);
      else blocks.push({ type: "list", ordered, items: [item] });
      continue;
    }
    para.push(parseInline(line.trim()));
  }
  endPara();
  return blocks;
}
