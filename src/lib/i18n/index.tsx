import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DICT, type DictKey } from "./dict";

export const LANGS = [
  { code: "pt", label: "Português", short: "PT", flag: "🇧🇷", locale: "pt-BR" },
  { code: "en", label: "English", short: "EN", flag: "🇺🇸", locale: "en-US" },
  { code: "es", label: "Español", short: "ES", flag: "🇪🇸", locale: "es-ES" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

type LangState = {
  lang: Lang;
  setLang: (l: Lang) => void;
};

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: "pt",
      setLang: (lang) => set({ lang }),
    }),
    {
      name: "altus-lang",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

/** Traduz uma chave para o idioma informado, com fallback para português. */
export function translate(key: DictKey | string, lang: Lang, vars?: Record<string, string | number>) {
  const entry = (DICT as Record<string, Record<Lang, string>>)[key];
  let out = entry ? (entry[lang] ?? entry.pt) : String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function useI18n() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const t = (key: DictKey | string, vars?: Record<string, string | number>) => translate(key, lang, vars);
  const locale = LANGS.find((l) => l.code === lang)?.locale ?? "pt-BR";
  return { lang, setLang, t, locale };
}

/** Atalho para componentes que só precisam traduzir. */
export function useT() {
  return useI18n().t;
}

/**
 * Reidrata o idioma salvo só no cliente para não quebrar a hidratação do SSR
 * (o servidor sempre renderiza em português, o padrão do app).
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useLangStore((s) => s.lang);
  useEffect(() => {
    void useLangStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    const locale = LANGS.find((l) => l.code === lang)?.locale ?? "pt-BR";
    document.documentElement.lang = locale;
  }, [lang]);
  return <>{children}</>;
}
