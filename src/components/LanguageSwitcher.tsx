import { Check, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LANGS, useLangStore, useT } from "@/lib/i18n";

/**
 * Seletor de idioma (PT/EN/ES) com bandeiras. Fica na barra lateral e no topo
 * mobile. A troca persiste no localStorage via useLangStore.
 */
export function LanguageSwitcher() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const t = useT();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={t("lang.change")}
          title={t("lang.change")}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        >
          <Globe size={14} />
          <span>{LANGS.find((l) => l.code === lang)?.flag}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition hover:bg-white/10 ${
              lang === l.code ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            <span className="text-base">{l.flag}</span>
            <span className="flex-1 text-left">{l.label}</span>
            {lang === l.code && <Check size={14} className="text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
