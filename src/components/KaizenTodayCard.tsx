import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

type Props = {
  embedded?: boolean;
};

export function KaizenTodayCard({ embedded = false }: Props) {
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
      toast.error("Preencha ao menos um campo.");
      return;
    }
    upsertKaizenByDate(today, {
      improvedToday: improvedToday.trim(),
      improveTomorrow: improveTomorrow.trim(),
      notes: notes.trim(),
    });
    toast.success(entry ? "Kaizen atualizado." : "Kaizen registrado.");
  };

  const hasContent = !!entry && (!!entry.improvedToday || !!entry.improveTomorrow || !!entry.notes);

  return (
    <div className="glass-strong rounded-2xl p-6 border border-purple-500/20 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <span>🌱</span> {embedded ? "Kaizen de Hoje — 1% melhor" : "Kaizen de Hoje"}
          </h3>
          <p className="text-xs text-muted-foreground">Reflexão diária — registre e evolua</p>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              ✓ preenchido hoje
            </span>
          )}
          {embedded && (
            <Link to="/kaizen" className="text-xs text-purple-300 hover:text-purple-200 underline underline-offset-4">
              Ver histórico →
            </Link>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-muted-foreground block mb-1">O que melhorei 1% hoje?</span>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition text-white placeholder:text-muted-foreground/60 min-h-[84px] resize-none"
            placeholder="Ex.: finalizei o relatório sem procrastinar..."
            value={improvedToday}
            onChange={(e) => setImprovedToday(e.target.value)}
            rows={3}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground block mb-1">O que posso melhorar 1% amanhã?</span>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition text-white placeholder:text-muted-foreground/60 min-h-[84px] resize-none"
            placeholder="Ex.: dormir 30 min mais cedo para acordar com energia..."
            value={improveTomorrow}
            onChange={(e) => setImproveTomorrow(e.target.value)}
            rows={3}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-muted-foreground block mb-1">Anotações livres sobre o dia</span>
        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition text-white placeholder:text-muted-foreground/60 min-h-[72px] resize-none"
          placeholder="Como foi seu dia? Insights, gratidão, aprendizados..."
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
          Salvar Kaizen de hoje
        </button>
      </div>
    </div>
  );
}
