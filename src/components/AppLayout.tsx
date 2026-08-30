import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Wallet,
  HeartPulse,
  BookOpen,
  GraduationCap,
  Bot,
  Settings,
  Menu,
  X,
  LogOut,
  Cloud,
  CloudOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { dailyQuote } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QuickAddFab } from "@/components/QuickAddFab";
import { AI_AGENT_ENABLED } from "@/lib/features";
import { useAuth } from "@/lib/auth";
import { useSyncStatus } from "@/lib/sync";
import { flushSync } from "@/lib/sync";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const NAV = [
  { to: "/", i18nKey: "nav.dashboard", icon: Home, emoji: "🏠" },
  { to: "/financas", i18nKey: "nav.financas", icon: Wallet, emoji: "💰" },
  { to: "/corpo", i18nKey: "nav.corpo", icon: HeartPulse, emoji: "⚖️" },
  { to: "/biblioteca", i18nKey: "nav.biblioteca", icon: BookOpen, emoji: "📚" },
  { to: "/estudos", i18nKey: "nav.estudos", icon: GraduationCap, emoji: "🎓" },
  { to: "/kaizen", i18nKey: "nav.kaizen", icon: Sparkles, emoji: "🌱" },
  ...(AI_AGENT_ENABLED ? [{ to: "/agente", i18nKey: "nav.agente", icon: Bot, emoji: "🤖" }] : []),
  { to: "/configuracoes", i18nKey: "nav.configuracoes", icon: Settings, emoji: "⚙️" },
] as const;

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const name =
    profileName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Visionário";

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
          className="p-2 rounded-lg hover:bg-white/10 transition text-muted-foreground hover:text-foreground"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="flex">
        <aside
          className={cn(
            "fixed md:sticky top-0 z-40 h-screen w-64 shrink-0 transition-transform duration-300",
            "glass-strong border-r border-purple-500/15 flex flex-col bg-[#090714]/90",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          <div className="p-5 border-b border-white/10">
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
                <div className="font-display font-extrabold leading-none tracking-widest text-lg bg-gradient-to-r from-white via-purple-100 to-purple-300 bg-clip-text text-transparent">
                  ALTUS
                </div>
                <div className="text-[9px] uppercase tracking-[0.22em] text-purple-400 font-semibold mt-1">
                  Organize • Foque • Conquiste
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{name}</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {NAV.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                    "hover:bg-white/5 hover:translate-x-1",
                    active
                      ? "bg-gradient-to-r from-purple-900/50 to-indigo-900/30 text-purple-200 border border-purple-500/40 shadow-sm shadow-purple-900/20 font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-lg">{n.emoji}</span>
                  <span>{t(n.i18nKey)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 space-y-3">
            <p className="text-xs italic text-muted-foreground leading-relaxed">"{dailyQuote()}"</p>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
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
                className="shrink-0 p-2 rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground transition"
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

        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-[1400px] mx-auto w-full">{children}</main>
      </div>
      <QuickAddFab />
    </div>
  );
}
