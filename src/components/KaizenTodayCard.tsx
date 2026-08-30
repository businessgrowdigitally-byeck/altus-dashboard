import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

type Props = {
  embedded?: boolean;
};

export function KaizenTodayCard({ embedded = false }: Props) {
  const t = useT();
  const kaizen = useStore((s) => s.kaizen);
  const upsertKaizenByDate = useStore((s) => s.upsertKaizenByDate);
  const today = todayISO();
  const entry = kaizen.find((k) => k.date === today);

  const [improvedToday, setImprovedToday] = useState(entry?.improvedToday ?? "");
  const [improveTomorrow, setImproveTomorrow] = useState(entry?.improveTomorrow ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");

  useEffect(() => {
    setImprovedToday(entry?.improvedToday ?? "");
    setImproveTomorrow(entry?.improveTomorrow ?? "");
    setNotes(entry?.notes ?? "");
  }, [entry?.improvedToday, entry?.improveTomorrow, entry?.notes]);

  const handleSave = () => {
    if (!improvedToday.trim() && !improveTomorrow.trim() && !notes.trim()) {
      toast.error(t("kaizen.needOne"));
      return;
    }
    upsertKaizenByDate(today, {
      improvedToday: improvedToday.trim(),
      improveTomorrow: improveTomorrow.trim(),
      notes: notes.trim(),
    });
    toast.success(entry ? t("kaizen.updated") : t("kaizen.saved"));
  };

  const hasContent = !!entry && (!!entry.improvedToday || !!entry.improveTomorrow || !!entry.notes);

  return (
    <div className="glass-strong rounded-2xl p-6 border border-purple-500/20 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <span>🌱</span> {embedded ? t("kaizen.cardTitle") : t("kaizen.cardTitleShort")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("kaizen.cardSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {t("kaizen.filled")}
            </span>
          )}
          {embedded && (
            <Link to="/kaizen" className="text-xs text-purple-300 hover:text-purple-200 underline underline-offset-4">
              {t("kaizen.viewHistory")}
            </Link>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-muted-foreground block mb-1">{t("kaizen.q1")}</span>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition text-white placeholder:text-muted-foreground/60 min-h-[84px] resize-none"
            placeholder={t("kaizen.q1ph")}
            value={improvedToday}
            onChange={(e) => setImprovedToday(e.target.value)}
            rows={3}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground block mb-1">{t("kaizen.q2")}</span>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition text-white placeholder:text-muted-foreground/60 min-h-[84px] resize-none"
            placeholder={t("kaizen.q2ph")}
            value={improveTomorrow}
            onChange={(e) => setImproveTomorrow(e.target.value)}
            rows={3}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-muted-foreground block mb-1">{t("kaizen.notes")}</span>
        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition text-white placeholder:text-muted-foreground/60 min-h-[72px] resize-none"
          placeholder={t("kaizen.notesPh")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </label>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#6E38F7] to-[#9055FF] text-white hover:brightness-110 transition shadow-lg shadow-purple-600/25"
        >
          {t("kaizen.save")}
        </button>
      </div>
    </div>
  );
}
