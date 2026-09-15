import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Settings,
  LogOut,
  Cloud,
  CloudOff,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { AREA_DEFS } from "@/lib/areas";
import { dailyQuote } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QuickAddFab } from "@/components/QuickAddFab";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/auth";
import { useSyncStatus } from "@/lib/sync";
import { flushSync } from "@/lib/sync";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

const FIXED_NAV = [
  { to: "/", i18nKey: "nav.dashboard", icon: Home, emoji: "🏠" },
  { to: "/configuracoes", i18nKey: "nav.configuracoes", icon: Settings, emoji: "⚙️" },
] as const;

type RoutePath = "/" | "/financas" | "/corpo" | "/biblioteca" | "/estudos" | "/kaizen" | "/agente" | "/configuracoes";

/** Mostra se as alterações já foram para a nuvem. */
function SyncBadge() {
  const status = useSyncStatus((s) => s.status);
  const t = useT();
  if (status === "saving")
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 size={11} className="animate-spin" /> {t("sync.saving")}
      </span>
    );
  if (status === "error")
    return (
      <span className="flex items-center gap-1 text-[10px] text-destructive">
        <CloudOff size={11} /> {t("sync.error")}
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <Cloud size={11} /> {t("sync.saved")}
    </span>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const t = useT();
  const profileName = useStore((s) => s.profile.name);
  const primaryAreas = useStore((s) => s.primaryAreas);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const name =
    profileName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Visionário";

  const primaryNav = primaryAreas
    .map((key) => AREA_DEFS.find((d) => d.key === key))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const moreNav = AREA_DEFS.filter((d) => !primaryAreas.includes(d.key));

  async function handleSignOut() {
    await flushSync();
    await signOut();
  }

  return (
    <div className="min-h-screen text-foreground">
      {/* Mobile topbar */}
      <header className="md:hidden sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <svg
            viewBox="0 0 36 36"
            className="w-7 h-7 shrink-0 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"
            fill="none"
          >
            <path d="M18 3L31 29H24.5L18 16L11.5 29H5L18 3Z" fill="url(#mobile-logo-grad)" />
            <defs>
              <linearGradient
                id="mobile-logo-grad"
                x1="5"
                y1="3"
                x2="31"
                y2="29"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#C084FC" />
                <stop offset="0.5" stopColor="#A855F7" />
                <stop offset="1" stopColor="#6366F1" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-display font-bold tracking-wider text-base text-foreground">
            ALTUS
          </span>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="flex">
        <aside
          className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex"
        >
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-900/40 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-950/50">
                <svg
                  viewBox="0 0 36 36"
                  className="w-6 h-6 drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]"
                  fill="none"
                >
                  <path d="M18 3L31 29H24.5L18 16L11.5 29H5L18 3Z" fill="url(#sidebar-logo-grad)" />
                  <defs>
                    <linearGradient
                      id="sidebar-logo-grad"
                      x1="5"
                      y1="3"
                      x2="31"
                      y2="29"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#C084FC" />
                      <stop offset="0.5" stopColor="#A855F7" />
                      <stop offset="1" stopColor="#6366F1" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="font-display font-extrabold leading-none tracking-widest text-lg bg-gradient-to-r from-slate-900 via-purple-900 to-purple-600 dark:from-white dark:via-purple-100 dark:to-purple-300 bg-clip-text text-transparent">
                  ALTUS
                </div>
                <div className="text-[9px] uppercase tracking-[0.22em] text-purple-400 font-semibold mt-1">
                  {t("app.tagline")}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{name}</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {FIXED_NAV.slice(0, 1).map((n) => (
              <NavItem key={n.to} to={n.to} emoji={n.emoji} label={t(n.i18nKey)} active={pathname === n.to} />
            ))}

            {primaryNav.length > 0 && (
              <>
                <div className="pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-purple-400/70 font-semibold px-3.5">
                  {t("pz.nav.primary")}
                </div>
                {primaryNav.map((d) => (
                  <NavItem key={d.key} to={d.to} emoji={d.emoji} label={t(d.i18nKey)} active={pathname === d.to} />
                ))}
              </>
            )}

            {moreNav.length > 0 && (
              <>
                <div className="pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold px-3.5">
                  {t("pz.nav.more")}
                </div>
                {moreNav.map((d) => (
                  <NavItem key={d.key} to={d.to} emoji={d.emoji} label={t(d.i18nKey)} active={pathname === d.to} />
                ))}
              </>
            )}

            {FIXED_NAV.slice(1).map((n) => (
              <NavItem key={n.to} to={n.to} emoji={n.emoji} label={t(n.i18nKey)} active={pathname === n.to} />
            ))}
          </nav>

          <div className="p-4 border-t border-border space-y-3">
            <p className="text-xs italic text-muted-foreground leading-relaxed">"{dailyQuote()}"</p>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
              <div className="min-w-0">
                <div className="truncate text-xs text-muted-foreground" title={user?.email ?? ""}>
                  {user?.email}
                </div>
                <SyncBadge />
              </div>
              <LanguageSwitcher />
              <button
                onClick={handleSignOut}
                title={t("auth.signOut")}
                className="shrink-0 p-2 rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground transition"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-[1400px] mx-auto w-full pb-28 md:pb-8">
          {children}
        </main>
      </div>
      <QuickAddFab />
      {!moreOpen && (
        <BottomNav
          primaryAreas={primaryAreas}
          pathname={pathname}
          onOpenMore={() => setMoreOpen(true)}
        />
      )}
      <MobileMoreDrawer
        open={moreOpen}
        onOpenChange={setMoreOpen}
        primaryAreas={primaryAreas}
        email={user?.email}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

function NavItem({
  to,
  emoji,
  label,
  active,
}: {
  to: RoutePath;
  emoji: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
        "hover:bg-muted/50 hover:translate-x-1",
        active
          ? "bg-gradient-to-r from-purple-950/80 to-indigo-900/60 text-purple-100 border border-purple-500/40 shadow-sm shadow-purple-900/30 font-semibold"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="text-lg">{emoji}</span>
      <span>{label}</span>
    </Link>
  );
}

function MobileMoreDrawer({
  open,
  onOpenChange,
  primaryAreas,
  email,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryAreas: (typeof AREA_DEFS)[number]["key"][];
  email?: string;
  onSignOut: () => Promise<void>;
}) {
  const t = useT();
  const bottomAreaKeys = new Set(primaryAreas.slice(0, 4));
  const remainingAreas = AREA_DEFS.filter((area) => !bottomAreaKeys.has(area.key));

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="mx-auto max-h-[78vh] max-w-lg border-border bg-popover/98 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <DrawerHeader className="px-2 pb-3 pt-2 text-left">
          <DrawerTitle className="font-display text-xl">{t("pz.nav.more")}</DrawerTitle>
          <DrawerDescription>{t("nav.moreDescription")}</DrawerDescription>
        </DrawerHeader>

        <div className="grid grid-cols-2 gap-2">
          {remainingAreas.map((area) => {
            const Icon = area.icon;
            return (
              <DrawerClose key={area.key} asChild>
                <Link
                  to={area.to}
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent/15"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t(area.i18nKey)}</span>
                </Link>
              </DrawerClose>
            );
          })}
          <DrawerClose asChild>
            <Link
              to="/configuracoes"
              className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent/15"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Settings className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">{t("nav.configuracoes")}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </DrawerClose>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-t border-border px-1 pt-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <SyncBadge />
          </div>
          <LanguageSwitcher />
          <Button type="button" variant="ghost" size="icon" onClick={onSignOut} aria-label={t("auth.signOut")} title={t("auth.signOut")}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
