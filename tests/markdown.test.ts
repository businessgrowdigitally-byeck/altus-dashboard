import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseMarkdown, type Inline } from "../src/lib/ai/markdown.ts";

/** Texto visível, sem os marcadores — o que o usuário lê. */
const plain = (nodes: Inline[]): string =>
  nodes.map((n) => (n.type === "text" || n.type === "code" ? n.text : plain(n.children))).join("");

// Trecho real de uma resposta do Mentor.
const reply = `Uma **Meta Macro** é o resultado final concreto.

Para ser bem formulada, uma Meta Macro precisa ter:

*   **Área:** Qual setor da sua vida ela impacta?
*   **Prazo:** Quando você pretende alcançar?

**Exemplo:**

*   **Meta Macro bem formulada:**
    *   **Nome:** "Fazer 10k até janeiro"
    *   **Alvo:** R$ 10.000,00

---

**Qual das suas Metas Macro é o FOCO PRINCIPAL?**

1. Ficar no Shape
2. Aplicar para NYU`;

describe("Markdown das respostas do Mentor", () => {
  const blocks = parseMarkdown(reply);

  it("turns ** and * into bold/italic without leaving the symbols", () => {
    const first = blocks[0];
    assert.equal(first.type, "paragraph");
    if (first.type !== "paragraph") return;
    assert.equal(plain(first.lines[0]), "Uma Meta Macro é o resultado final concreto.");
    assert.deepEqual(first.lines[0][1], {
      type: "bold",
      children: [{ type: "text", text: "Meta Macro" }],
    });
    assert.deepEqual(parseInline("um *destaque* aqui")[1], {
      type: "italic",
      children: [{ type: "text", text: "destaque" }],
    });
  });

  it("reads bullet lists (also with extra spaces after *) and nested items", () => {
    const lists = blocks.filter((b) => b.type === "list");
    assert.equal(lists.length, 3);
    const [bullets, nested, ordered] = lists;
    if (bullets.type !== "list" || nested.type !== "list" || ordered.type !== "list") return;
    assert.equal(bullets.ordered, false);
    assert.deepEqual(
      bullets.items.map((i) => plain(i.children)),
      ["Área: Qual setor da sua vida ela impacta?", "Prazo: Quando você pretende alcançar?"],
    );
    assert.deepEqual(
      nested.items.map((i) => i.depth),
      [0, 2, 2],
    );
    assert.equal(ordered.ordered, true);
    assert.deepEqual(
      ordered.items.map((i) => plain(i.children)),
      ["Ficar no Shape", "Aplicar para NYU"],
    );
  });

  it("turns --- into a separator and leaves no raw markers in the visible text", () => {
    assert.ok(blocks.some((b) => b.type === "hr"));
    const visible = blocks
      .flatMap((b) =>
        b.type === "paragraph"
          ? b.lines.map(plain)
          : b.type === "list"
            ? b.items.map((i) => plain(i.children))
            : b.type === "heading"
              ? [plain(b.children)]
              : [],
      )
      .join("\n");
    assert.doesNotMatch(visible, /\*\*|^\s*\*\s|---/m);
  });

  it("keeps ordinary text intact: snake_case, lone asterisks, money and dates", () => {
    assert.equal(
      plain(parseInline("use planejamento_geral e 2 * 3 = 6")),
      "use planejamento_geral e 2 * 3 = 6",
    );
    assert.equal(parseInline("use planejamento_geral").length, 1);
    assert.equal(plain(parseInline("R$ 10.000,00 até 01/01/2027")), "R$ 10.000,00 até 01/01/2027");
    assert.equal(plain(parseInline("**sem fechamento")), "**sem fechamento");
  });

  it("reads headings and keeps line breaks inside a paragraph", () => {
    const b = parseMarkdown("## Próximos passos\nlinha 1\nlinha 2");
    assert.equal(b[0].type, "heading");
    assert.equal(b[1].type === "paragraph" && b[1].lines.length, 2);
  });
});
