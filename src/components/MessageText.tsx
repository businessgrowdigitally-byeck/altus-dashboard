import { Fragment, useMemo, type ReactNode } from "react";
import { parseMarkdown, type Inline } from "@/lib/ai/markdown";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    if (n.type === "text") return <Fragment key={i}>{n.text}</Fragment>;
    if (n.type === "code")
      return (
        <code key={i} className="rounded bg-muted/60 px-1 py-0.5 text-[0.9em]">
          {n.text}
        </code>
      );
    if (n.type === "bold")
      return (
        <strong key={i} className="font-semibold">
          {renderInline(n.children)}
        </strong>
      );
    return <em key={i}>{renderInline(n.children)}</em>;
  });
}

/** Resposta do Mentor com a formatação Markdown aplicada (sem HTML cru). */
export function MessageText({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className="space-y-2 break-words" data-markdown>
      {blocks.map((b, i) => {
        if (b.type === "hr") return <hr key={i} className="border-border" />;
        if (b.type === "heading")
          return (
            <p key={i} className="font-semibold">
              {renderInline(b.children)}
            </p>
          );
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={`space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"}`}>
              {b.items.map((it, j) => (
                <li key={j} style={it.depth ? { marginLeft: `${it.depth * 1}rem` } : undefined}>
                  {renderInline(it.children)}
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
