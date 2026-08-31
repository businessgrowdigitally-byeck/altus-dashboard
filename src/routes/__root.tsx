import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AppLayout } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider, translate, useLangStore } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useEffect } from "react";

function getLang(): "pt" | "en" | "es" {
  try {
    if (typeof window === "undefined") return "pt";
    const raw = localStorage.getItem("altus-lang");
    if (!raw) return "pt";
    const p = JSON.parse(raw);
    const l = p?.state?.lang ?? p?.lang;
    return l === "en" || l === "es" ? l : "pt";
  } catch {
    return "pt";
  }
}

function NotFoundComponent() {
  const t = (k: string) => translate(k, getLang());
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("common.pageNotFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("common.pageNotFoundDesc")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const t = (k: string) => translate(k, getLang());

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("common.errorTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("common.errorDesc")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("common.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ALTUS — Become your best version" },
      {
        name: "description",
        content:
          "ALTUS é o sistema operacional pessoal para gerenciar sua vida como uma empresa: finanças, corpo, biblioteca, estudos e metas.",
      },
      { name: "author", content: "ALTUS" },
      { property: "og:title", content: "ALTUS — Become your best version" },
      {
        property: "og:description",
        content: "Gerencie sua vida como um CEO administra sua empresa.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:locale:alternate", content: "en_US" },
      { property: "og:locale:alternate", content: "es_ES" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "ALTUS — Become your best version" },
      {
        name: "twitter:description",
        content: "Gerencie sua vida como um CEO administra sua empresa.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "alternate", href: "/", hrefLang: "pt" },
      { rel: "alternate", href: "/?lang=en", hrefLang: "en" },
      { rel: "alternate", href: "/?lang=es", hrefLang: "es" },
      { rel: "alternate", href: "/", hrefLang: "x-default" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);
  const lang = useLangStore((s) => s.lang);
  useEffect(() => {
    const titles: Record<string, string> = {
      pt: "ALTUS — Organize. Foque. Conquiste.",
      en: "ALTUS — Organize. Focus. Conquer.",
      es: "ALTUS — Organiza. Enfoca. Conquista.",
    };
    const descs: Record<string, string> = {
      pt: "ALTUS é o sistema operacional pessoal para gerenciar sua vida como uma empresa: finanças, corpo, biblioteca, estudos e metas.",
      en: "ALTUS is your personal operating system to manage your life like a company: finances, body, library, studies and goals.",
      es: "ALTUS es tu sistema operativo personal para gestionar tu vida como una empresa: finanzas, cuerpo, biblioteca, estudios y metas.",
    };
    document.title = titles[lang] ?? titles.pt;
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", descs[lang] ?? descs.pt);
  }, [lang]);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <AuthGate>
            <AppLayout>
              <Outlet />
            </AppLayout>
          </AuthGate>
        </I18nProvider>
      </AuthProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
