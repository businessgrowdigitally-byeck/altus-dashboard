import { Link } from "@tanstack/react-router";
import { Ellipsis, Home } from "lucide-react";
import { AREA_DEFS, type AreaDef, type AreaKey } from "@/lib/areas";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label={t("nav.mobileNavigation")}>
      <div className="mx-auto grid max-w-lg grid-cols-[repeat(auto-fit,minmax(0,1fr))] px-1">
        <BottomLink active={pathname === "/"} to="/" icon={Home} title={t("nav.dashboard")} />
        {primaries.map((def) => (
          <BottomLink
            key={def.key}
            active={pathname === def.to}
            to={def.to}
            icon={def.icon}
            title={t(def.i18nKey)}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenMore}
          className={cn(
            "h-auto min-w-0 rounded-none px-1 py-2.5 text-[10px] font-medium",
            "flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-transparent hover:text-foreground",
          )}
        >
          <Ellipsis className="size-5" strokeWidth={1.8} />
          <span className="max-w-full truncate">{t("pz.nav.more")}</span>
        </Button>
      </div>
    </nav>
  );
}

type BottomNavTarget = AreaDef["to"] | "/";

function BottomLink({
  to,
  icon: Icon,
  title,
  active,
}: {
  to: BottomNavTarget;
  icon: AreaDef["icon"];
  title: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && <span className="absolute inset-x-1/4 top-0 h-0.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />}
      <Icon className="size-5 shrink-0" strokeWidth={active ? 2.3 : 1.8} />
      <span className="max-w-full truncate">{title}</span>
    </Link>
  );
}