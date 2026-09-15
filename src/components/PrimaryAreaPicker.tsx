import { AREA_DEFS, type AreaKey } from "@/lib/areas";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MAX_PRIMARY = 5;

/**
 * Seletor de áreas prioritárias (chips clicáveis).
 * Garante o mínimo de 1 e o máximo de MAX_PRIMARY selecionados.
 */
export function PrimaryAreaPicker({
  value,
  onChange,
}: {
  value: AreaKey[];
  onChange: (areas: AreaKey[]) => void;
}) {
  const t = useT();

  const toggle = (key: AreaKey) => {
    if (value.includes(key)) {
      if (value.length > 1) onChange(value.filter((a) => a !== key));
      return;
    }
    if (value.length >= MAX_PRIMARY) return;
    onChange([...value, key]);
  };

  const selectAll = () => onChange(AREA_DEFS.map((d) => d.key));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {AREA_DEFS.map((area) => {
          const selected = value.includes(area.key);
          const disabled = !selected && value.length >= MAX_PRIMARY;
          return (
            <button
              key={area.key}
              type="button"
              onClick={() => toggle(area.key)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                selected
                  ? "border-purple-500/50 bg-purple-500/15 text-purple-200 shadow-sm shadow-purple-900/30"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                disabled && "opacity-40 cursor-not-allowed",
              )}
            >
              <span className="text-lg">{area.emoji}</span>
              <span className="truncate">{t(area.i18nKey)}</span>
              {selected && <span className="ml-auto text-xs text-purple-400">✓</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {value.length} {t("pz.commonOf")} {MAX_PRIMARY}
        </span>
        {value.length < MAX_PRIMARY && (
          <button
            type="button"
            onClick={selectAll}
            className="text-purple-400 hover:text-purple-300 hover:underline"
          >
            {t("pz.config.selectAll")}
          </button>
        )}
      </div>
    </div>
  );
}