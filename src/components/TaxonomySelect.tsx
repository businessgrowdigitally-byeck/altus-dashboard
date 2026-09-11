import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useStore, type TaxonomyScope } from "@/lib/store";
import { CATEGORIES, GENRES, STUDY_AREAS, STUDY_TYPES, WORKOUT_TYPES } from "@/lib/format";
import { useT } from "@/lib/i18n";

type Option = { id: string; icon?: string; label: string };
export type { Option as TaxonomyOption };

const PREFIX: Record<TaxonomyScope, string> = {
  financeCategories: "cat.",
  studyAreas: "area.",
  studyTypes: "studyType.",
  genres: "genre.",
  workoutTypes: "workout.",
};

/** Traduz o label de uma categoria; se não existir tradução (item custom), retorna o próprio id. */
export function taxLabel(t: (k: string) => string, prefix: string, id: string): string {
  const tr = t(prefix + id);
  return tr === prefix + id ? id : tr;
}

const DEFAULTS: Record<TaxonomyScope, { id: string; icon?: string }[]> = {
  financeCategories: CATEGORIES,
  studyAreas: STUDY_AREAS.map((a) => ({ id: a })),
  studyTypes: STUDY_TYPES,
  genres: GENRES.map((g) => ({ id: g })),
  workoutTypes: WORKOUT_TYPES.map((w) => ({ id: w })),
};

export function useTaxonomyOptions(scope: TaxonomyScope): Option[] {
  const t = useT();
  const custom = useStore((s) => s.customTaxonomy[scope]);
  return useMemo(() => {
    const prefix = PREFIX[scope];
    const customList = custom as (string | { id: string; icon?: string })[];
    const known = new Set(customList.map((c) => (typeof c === "string" ? c : c.id)));
    const defaults = DEFAULTS[scope].filter((d) => !known.has(d.id)).map((d) => ({
      id: d.id,
      icon: d.icon,
      label: taxLabel(t, prefix, d.id),
    }));
    const customs = customList.map((c) =>
      typeof c === "string"
        ? { id: c, label: c }
        : { id: c.id, icon: c.icon, label: c.id },
    );
    return [...defaults, ...customs];
  }, [scope, custom, t]);
}

export function TaxonomySelect({
  scope,
  value,
  defaultValue,
  onChange,
  onAdd,
  name,
  className,
}: {
  scope: TaxonomyScope;
  /** Controlado: use junto com onChange. */
  value?: string;
  /** Não controlado: use sozinho (ex: formulários com FormData). */
  defaultValue?: string;
  onChange?: (v: string) => void;
  onAdd: (scope: TaxonomyScope, value: string) => void;
  name?: string;
  className?: string;
}) {
  const t = useT();
  const options = useTaxonomyOptions(scope);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(defaultValue ?? (options[0]?.id ?? ""));

  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const select = (v: string) => {
    if (!isControlled) setInternal(v);
    onChange?.(v);
  };

  const confirm = () => {
    const v = draft.trim();
    if (!v) {
      setAdding(false);
      setDraft("");
      return;
    }
    if (options.some((o) => o.id === v)) {
      select(v);
      setAdding(false);
      setDraft("");
      return;
    }
    onAdd(scope, v);
    select(v);
    setAdding(false);
    setDraft("");
  };

  if (adding) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {name && <input type="hidden" name={name} value={current} />}
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
            if (e.key === "Escape") {
              setAdding(false);
              setDraft("");
            }
          }}
          placeholder={t("taxonomy.newPlaceholder")}
          className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition"
        />
        <button
          type="button"
          onClick={confirm}
          className="px-2.5 py-2 rounded-lg bg-gold text-[#0A0F1E] text-sm font-semibold hover:brightness-110 transition"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setDraft("");
          }}
          className="px-2.5 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <select
      name={name}
      className={className}
      value={current}
      onChange={(e) => {
        if (e.target.value === "__add__") {
          setAdding(true);
          return;
        }
        select(e.target.value);
      }}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.icon ? `${o.icon} ` : ""}
          {o.label}
        </option>
      ))}
      <option value="__add__">{t("taxonomy.addNew")}</option>
    </select>
  );
}