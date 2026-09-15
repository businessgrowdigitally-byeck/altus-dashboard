import { Link } from "@tanstack/react-router";
import { AREA_DEFS, type AreaDef, type AreaKey } from "@/lib/areas";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MAX_NAV_AREAS = 4;

/**
 * Barra de navegação inferior (mobile).
 * Mostra a Home + até MAX_NAV_AREAS áreas prioritárias; o restante fica em "Mais",
 * que abre o drawer completo.
 */
export function BottomNav({
  primaryAreas,
  pathname,
  onOpenMore,
}: {
  primaryAreas: AreaKey[];
  pathname: string;
  onOpenMore: () => void;
}) {
  const t = useT();
  const primaries = primaryAreas
    .map((key) => AREA_DEFS.find((d) => d.key === key))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .slice(0, MAX_NAV_AREAS);

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-purple-500/20 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
        <BottomLink active={pathname === "/"} to="/" label="🏠" title={t("nav.dashboard")} />
        {primaries.map((def) => (
          <BottomLink
            key={def.key}
            active={pathname === def.to}
            to={def.to}
            label={def.emoji}
            title={t(def.i18nKey)}
          />
        ))}
        <button
          onClick={onOpenMore}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 py-2.5 pt-3 text-[10px] font-medium transition-colors",
            "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="text-lg leading-none">⋯</span>
          <span>{t("pz.nav.more")}</span>
        </button>
      </div>
    </div>
  );
}

type BottomNavTarget = AreaDef["to"] | "/";

function BottomLink({
  to,
  label,
  title,
  active,
}: {
  to: BottomNavTarget;
  label: string;
  title: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2.5 pt-3 text-[10px] font-medium transition-colors",
        active ? "text-purple-300" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="text-lg leading-none">{label}</span>
      <span>{title}</span>
    </Link>
  );
}