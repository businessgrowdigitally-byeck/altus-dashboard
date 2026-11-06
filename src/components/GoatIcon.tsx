import type { CSSProperties } from "react";
import type { AreaDef } from "@/lib/areas";

export const GOAT_AVATAR = "/icons/goat-avatar.png";

/**
 * Ícone do GOAT (a cabra), no lugar de um ícone lucide: aceita as mesmas props
 * (`className`, `size`; `strokeWidth` é ignorado) e fica redondo.
 */
export function GoatIcon({
  className = "",
  size,
}: {
  className?: string;
  size?: number | string;
  strokeWidth?: number;
}) {
  const style: CSSProperties | undefined = size ? { width: size, height: size } : undefined;
  return (
    <img
      src={GOAT_AVATAR}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-goat-icon
      className={`inline-block shrink-0 rounded-full object-cover ring-1 ring-purple-500/40 ${className}`}
      style={style}
    />
  );
}

/** O "emoji" de uma área nos menus: a imagem quando a área tem uma (o GOAT), senão o emoji. */
export function AreaEmoji({
  def,
  className = "",
}: {
  def: Pick<AreaDef, "emoji" | "image">;
  className?: string;
}) {
  if (def.image) return <GoatIcon className={`size-[1.15em] align-[-0.2em] ${className}`} />;
  return <span className={className}>{def.emoji}</span>;
}
