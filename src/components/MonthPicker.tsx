import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { addMonths, monthLabel } from "@/lib/finance";

export function MonthPicker({
  value,
  current,
  onChange,
}: {
  value: string;
  /** Mês atual — quando diferente do selecionado, aparece o atalho para voltar. */
  current: string;
  onChange: (month: string) => void;
}) {
  const { t, locale } = useI18n();
  const btn = "p-2 rounded-lg border border-border hover:bg-muted/50 transition";
  return (
    <div className="flex items-center gap-2" data-month-picker={value}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(addMonths(value, -1))}
        aria-label={t("financas.prevMonth")}
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[9.5rem] text-center font-medium" aria-live="polite">
        {monthLabel(value, locale)}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(addMonths(value, 1))}
        aria-label={t("financas.nextMonth")}
      >
        <ChevronRight size={16} />
      </button>
      {value !== current && (
        <button
          type="button"
          className="text-xs text-gold hover:underline px-1"
          onClick={() => onChange(current)}
        >
          {t("financas.currentMonth")}
        </button>
      )}
    </div>
  );
}
