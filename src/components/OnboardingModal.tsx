import { useState } from "react";
import { Modal } from "@/components/Modal";
import { PrimaryAreaPicker } from "@/components/PrimaryAreaPicker";
import { useT } from "@/lib/i18n";
import { AREA_DEFS, type AreaKey } from "@/lib/areas";

type Step = 0 | 1 | 2;

/**
 * Onboarding em 3 passos: nome → áreas prioritárias → porquê focar.
 * "Pular" conclui mostrando todas as áreas (comportamento padrão).
 */
export function OnboardingModal({
  open,
  initialName,
  initialAreas,
  onComplete,
  onSkip,
}: {
  open: boolean;
  initialName: string;
  initialAreas: AreaKey[];
  onComplete: (name: string, areas: AreaKey[]) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState(initialName);
  const [areas, setAreas] = useState<AreaKey[]>(initialAreas.length > 0 ? initialAreas : AREA_DEFS.map((d) => d.key));
  const t = useT();

  function next() {
    if (step === 0 && !name.trim()) return;
    setStep((s) => Math.min(s + 1, 2) as Step);
  }

  function finish() {
    onComplete(name.trim() || "Visionário", areas.length > 0 ? areas : AREA_DEFS.map((d) => d.key));
  }

  return (
    <Modal open={open} onClose={onSkip} title={t("pz.onboarding.title")} maxWidth="max-w-xl">
      <div className="space-y-5">
        {/* Stepper */}
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          {[t("pz.onboarding.step1"), t("pz.onboarding.step2"), t("pz.onboarding.step3")].map((label, i) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 ${i <= step ? "text-purple-400" : ""}`}
            >
              <span
                className={`flex items-center justify-center rounded-full w-5 h-5 text-[10px] font-bold ${
                  i <= step ? "bg-purple-500/25 text-purple-200 border border-purple-400/40" : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-purple-700/80 dark:text-purple-200/80 leading-relaxed">
              {t("pz.onboarding.whoAreYou")}
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("pz.onboarding.namePlaceholder")}
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition text-foreground"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{t("pz.onboarding.whoAreYouHint")}</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-purple-700/80 dark:text-purple-200/80 leading-relaxed">
              {t("pz.onboarding.primaryTitle")}
            </p>
            <PrimaryAreaPicker value={areas} onChange={setAreas} />
            <p className="text-xs text-muted-foreground">{t("pz.onboarding.primaryHint")}</p>
            <p className="text-xs text-amber-500/90">{t("pz.onboarding.minOne")}</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{t("pz.onboarding.whyPrimaryTitle")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("pz.onboarding.whyPrimaryBody")}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {areas.map((k) => {
                const def = AREA_DEFS.find((a) => a.key === k);
                if (!def) return null;
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-sm text-purple-200"
                  >
                    <span>{def.emoji}</span> {t(def.i18nKey)}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2 border-t border-border">
          <button
            onClick={onSkip}
            className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 transition"
          >
            {t("pz.onboarding.skip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => Math.max(s - 1, 0) as Step)}
                className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted/50 transition"
              >
                {t("pz.onboarding.back")}
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={next}
                disabled={step === 0 && !name.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#6E38F7] to-[#9055FF] text-white hover:brightness-110 transition shadow-lg shadow-purple-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("pz.onboarding.continue")}
              </button>
            ) : (
              <button
                onClick={finish}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#6E38F7] to-[#9055FF] text-white hover:brightness-110 transition shadow-lg shadow-purple-600/25"
              >
                {t("pz.onboarding.finish")}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}