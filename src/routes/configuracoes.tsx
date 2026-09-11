import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, type TaxonomyScope } from "@/lib/store";
import { GlassCard, PageHeader, Section } from "@/components/primitives";
import { Modal, ConfirmButton } from "@/components/Modal";
import { todayISO } from "@/lib/format";
import { Pencil, Trash2 } from "lucide-react";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { taxLabel, PREFIX } from "@/components/TaxonomySelect";

export const Route = createFileRoute("/configuracoes")({ component: Config });

const ACCENTS = [
  { id: "gold", color: "#F5C842", label: "config.accentGold" },
  { id: "emerald", color: "#2ECC71", label: "config.accentEmerald" },
  { id: "purple", color: "#9B59B6", label: "config.accentPurple" },
  { id: "blue", color: "#3498DB", label: "config.accentBlue" },
] as const;

function Config() {
  const { profile, setProfile, settings, setSettings, exportAll, importAll, clearAll, customTaxonomy, renameCustomItem, removeCustomItem } = useStore();
  const [importText, setImportText] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState("");
  const [backupFeito, setBackupFeito] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ scope: TaxonomyScope; id: string; icon?: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const t = useT();

  const download = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altus-export-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupFeito(true);
    toast.success(t("config.toastBackup"));
  };

  const handleImport = () => {
    if (!importText.trim()) {
      toast.error(t("config.toastPaste"));
      return;
    }
    const erro = importAll(importText);
    if (erro) {
      const key =
        erro.includes("JSON válido") || erro.includes("valid JSON")
          ? "config.importErrorInvalid"
          : erro.includes("formato esperado") || erro.includes("expected format")
            ? "config.importErrorFormat"
            : erro.includes("Nenhum dado") || erro.includes("No recognizable")
              ? "config.importErrorEmpty"
              : null;
      toast.error(key ? t(key) : erro);
      return;
    }
    setImportText("");
    toast.success(t("config.toastImported"));
  };

  const executarLimpeza = () => {
    clearAll();
    setClearOpen(false);
    setClearConfirm("");
    setBackupFeito(false);
    toast.success(t("config.toastCleared"));
  };

  const confirmRename = () => {
    if (!renameTarget) return;
    const v = renameValue.trim();
    if (!v) return;
    const ok = renameCustomItem(renameTarget.scope, renameTarget.id, v);
    setRenameTarget(null);
    setRenameValue("");
    toast.success(t(ok ? "config.categorySaved" : "config.categoryExists"));
  };

  const sections: { scope: TaxonomyScope; label: string; items: string[]; icons?: Record<string, string> }[] = [
    {
      scope: "financeCategories",
      label: t("config.categoryFinance"),
      items: customTaxonomy.financeCategories.map((c) => c.id),
      icons: Object.fromEntries(customTaxonomy.financeCategories.map((c) => [c.id, c.icon])),
    },
    {
      scope: "studyAreas",
      label: t("config.categoryStudyAreas"),
      items: customTaxonomy.studyAreas,
    },
    {
      scope: "studyTypes",
      label: t("config.categoryStudyTypes"),
      items: customTaxonomy.studyTypes.map((c) => c.id),
      icons: Object.fromEntries(customTaxonomy.studyTypes.map((c) => [c.id, c.icon])),
    },
    {
      scope: "genres",
      label: t("config.categoryGenres"),
      items: customTaxonomy.genres,
    },
    {
      scope: "workoutTypes",
      label: t("config.categoryWorkout"),
      items: customTaxonomy.workoutTypes,
    },
  ];
  const hasCustom = sections.some((s) => s.items.length > 0);

  return (
    <div>
      <PageHeader title={t("config.title")} subtitle={t("config.subtitle")} />

      <Section title={t("config.profile")}>
        <GlassCard className="grid md:grid-cols-2 gap-3">
          <Field label={t("config.name")}>
            <input
              className="inp"
              value={profile.name}
              onChange={(e) => setProfile({ name: e.target.value })}
            />
          </Field>
          <Field label={t("config.height")}>
            <input
              className="inp"
              type="number"
              step="0.01"
              min="0.5"
              max="2.5"
              placeholder="1.75"
              value={profile.height || ""}
              onChange={(e) => setProfile({ height: +e.target.value })}
            />
            <span className="text-xs text-muted-foreground mt-1 block">
              {t("config.heightHint")}
            </span>
          </Field>
          <Field label={t("config.weightGoal")}>
            <input
              className="inp"
              type="number"
              step="0.1"
              value={profile.goalWeight}
              onChange={(e) => setProfile({ goalWeight: +e.target.value })}
            />
          </Field>
          <Field label={t("config.incomeTarget")}>
            <input
              className="inp"
              type="number"
              value={profile.incomeTarget}
              onChange={(e) => setProfile({ incomeTarget: +e.target.value })}
            />
          </Field>
          <Field label={t("config.maxExpenses")}>
            <input
              className="inp"
              type="number"
              value={profile.maxExpenses}
              onChange={(e) => setProfile({ maxExpenses: +e.target.value })}
            />
          </Field>
        </GlassCard>
      </Section>

      <Section title={t("config.aiAgent")}>
        <GlassCard className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-sm font-medium">{t("config.notIncluded")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("config.aiAgentDescA")} <strong>{t("config.aiAgentDescB")}</strong>{" "}
            {t("config.aiAgentDescC")}
          </p>
        </GlassCard>
      </Section>

      <Section title={t("config.data")}>
        <GlassCard className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={download} className="btn-gold">
              {t("config.downloadBackup")}
            </button>
            <button
              onClick={() => setClearOpen(true)}
              className="px-4 py-2 rounded-lg bg-coral text-white font-semibold hover:brightness-110"
            >
              {t("config.clearData")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t("config.backupHint")}</p>
          <Field label={t("config.restoreFrom")}>
            <textarea
              className="inp"
              rows={3}
              placeholder={t("config.importPlaceholder")}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </Field>
          <p className="text-xs text-muted-foreground">{t("config.restoreHint")}</p>
          <button onClick={handleImport} className="text-sm text-gold hover:underline">
            {t("config.restore")}
          </button>
        </GlassCard>
      </Section>

      <Modal
        open={clearOpen}
        onClose={() => {
          setClearOpen(false);
          setClearConfirm("");
        }}
        title={t("config.clearModalTitle")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("config.clearWarning")}</p>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{t("config.downloadBefore")}</span>
              <button onClick={download} className="text-sm text-gold hover:underline shrink-0">
                {backupFeito ? t("config.downloadAgain") : t("config.downloadNow")}
              </button>
            </div>
            {backupFeito && (
              <p className="text-xs text-emerald-bgt">{t("config.backupDownloaded")}</p>
            )}
          </div>

          <Field label={t("config.confirmLabel")}>
            <input
              className="inp"
              value={clearConfirm}
              onChange={(e) => setClearConfirm(e.target.value)}
              placeholder={t("config.confirmWord")}
              autoComplete="off"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setClearOpen(false);
                setClearConfirm("");
              }}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition"
            >
              {t("config.cancel")}
            </button>
            <button
              onClick={executarLimpeza}
              disabled={clearConfirm.trim().toUpperCase() !== t("config.confirmWord")}
              className="px-4 py-2 rounded-lg bg-coral text-white font-semibold text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("config.clearAll")}
            </button>
          </div>
        </div>
      </Modal>

      <Section title={t("config.categories")}>
        <GlassCard className="space-y-4">
          <p className="text-xs text-muted-foreground">{t("config.categoriesHint")}</p>
          {!hasCustom ? (
            <p className="text-sm text-muted-foreground">{t("config.categoriesEmpty")}</p>
          ) : (
            <div className="space-y-5">
              {sections.map((sec) => {
                if (sec.items.length === 0) return null;
                return (
                  <div key={sec.scope}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {sec.label}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sec.items.map((id) => (
                        <div
                          key={id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border"
                        >
                          {sec.icons?.[id] && <span>{sec.icons[id]}</span>}
                          <span className="text-sm">{taxLabel(t, PREFIX[sec.scope], id)}</span>
                          <button
                            onClick={() => {
                              setRenameTarget({ scope: sec.scope, id, icon: sec.icons?.[id] });
                              setRenameValue(id);
                            }}
                            title={t("action.edit")}
                            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80"
                          >
                            <Pencil size={13} />
                          </button>
                          <ConfirmButton
                            onConfirm={() => {
                              removeCustomItem(sec.scope, id);
                              toast.success(t("config.categoryRemoved"));
                            }}
                            message={t("config.categoryConfirmRemove")}
                            className="text-coral p-1 rounded hover:bg-muted/80"
                          >
                            <Trash2 size={13} />
                          </ConfirmButton>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </Section>

      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title={t("config.categoryRename")}
      >
        <div className="space-y-4">
          {renameTarget && (
            <div className="flex items-center gap-2 text-sm">
              {renameTarget.icon && <span>{renameTarget.icon}</span>}
              <span>{taxLabel(t, PREFIX[renameTarget.scope], renameTarget.id)}</span>
            </div>
          )}
          <Field label={t("config.categoryRename")}>
            <input
              className="inp"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              autoComplete="off"
            />
          </Field>
          <p className="text-xs text-muted-foreground">{t("config.categoryRenameHint")}</p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setRenameTarget(null)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition"
            >
              {t("config.cancel")}
            </button>
            <button
              onClick={confirmRename}
              disabled={!renameValue.trim()}
              className="px-4 py-2 rounded-lg bg-gold text-[#0A0F1E] font-semibold text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("action.save")}
            </button>
          </div>
        </div>
      </Modal>

      <Section title={t("config.appearance")}>
        <GlassCard className="space-y-4">
          <Field label={t("config.theme")}>
            <div className="flex gap-2">
              <button
                onClick={() => setSettings({ theme: "dark" })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${settings.theme === "dark" ? "border-gold bg-gold/10" : "border-border"}`}
              >
                <Moon size={16} /> {t("config.themeDark")}
              </button>
              <button
                onClick={() => setSettings({ theme: "light" })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${settings.theme === "light" ? "border-gold bg-gold/10" : "border-border"}`}
              >
                <Sun size={16} /> {t("config.themeLight")}
              </button>
            </div>
          </Field>
          <Field label={t("config.accent")}>
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSettings({ accent: a.id })}
                  className={`w-10 h-10 rounded-full transition ${settings.accent === a.id ? "ring-2 ring-offset-2 ring-offset-background ring-white" : ""}`}
                  style={{ backgroundColor: a.color }}
                  title={t(a.label)}
                />
              ))}
            </div>
          </Field>
        </GlassCard>
      </Section>

      <style>{`
        .inp { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; font-size: 14px; color: inherit; }
        .inp:focus { outline: none; border-color: #F5C842; }
        .btn-gold { background: #F5C842; color: #0A0F1E; font-weight: 600; padding: 8px 16px; border-radius: 8px; }
        .btn-gold:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}
