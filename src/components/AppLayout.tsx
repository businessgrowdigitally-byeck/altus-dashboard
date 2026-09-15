import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Settings,
  Menu,
  X,
  LogOut,
  Cloud,
  CloudOff,
  Loader2,
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
  const [open, setOpen] = useState(false);
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
      <div className="md:hidden flex items-center justify-between p-4 glass-strong sticky top-0 z-30 border-b border-purple-500/20">
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
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg hover:bg-muted/80 transition text-muted-foreground hover:text-foreground"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="flex">
        <aside
          className={cn(
            "fixed md:sticky top-0 z-40 h-screen w-64 shrink-0 transition-transform duration-300",
            "glass-strong border-r flex flex-col",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
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
              <NavItem key={n.to} to={n.to} emoji={n.emoji} label={t(n.i18nKey)} active={pathname === n.to} onNavigate={() => setOpen(false)} />
            ))}

            {primaryNav.length > 0 && (
              <>
                <div className="pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-purple-400/70 font-semibold px-3.5">
                  {t("pz.nav.primary")}
                </div>
                {primaryNav.map((d) => (
                  <NavItem key={d.key} to={d.to} emoji={d.emoji} label={t(d.i18nKey)} active={pathname === d.to} onNavigate={() => setOpen(false)} />
                ))}
              </>
            )}

            {moreNav.length > 0 && (
              <>
                <div className="pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold px-3.5">
                  {t("pz.nav.more")}
                </div>
                {moreNav.map((d) => (
                  <NavItem key={d.key} to={d.to} emoji={d.emoji} label={t(d.i18nKey)} active={pathname === d.to} onNavigate={() => setOpen(false)} />
                ))}
              </>
            )}

            {FIXED_NAV.slice(1).map((n) => (
              <NavItem key={n.to} to={n.to} emoji={n.emoji} label={t(n.i18nKey)} active={pathname === n.to} onNavigate={() => setOpen(false)} />
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

        {open && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-[1400px] mx-auto w-full pb-28 md:pb-8">
          {children}
        </main>
      </div>
      <QuickAddFab />
      <BottomNav
        primaryAreas={primaryAreas}
        pathname={pathname}
        onOpenMore={() => setOpen(true)}
      />
    </div>
  );
}

function NavItem({
  to,
  emoji,
  label,
  active,
  onNavigate,
}: {
  to: RoutePath;
  emoji: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
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
