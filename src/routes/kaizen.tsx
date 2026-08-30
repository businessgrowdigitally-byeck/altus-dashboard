import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, type KaizenEntry } from "@/lib/store";
import { daysAgoISO, fmtDate, todayISO } from "@/lib/format";
import { GlassCard, KpiCard, PageHeader } from "@/components/primitives";
import { KaizenTodayCard } from "@/components/KaizenTodayCard";
import { Pencil, Trash2 } from "lucide-react";
import { Modal, ConfirmButton, inpCls, btnGold } from "@/components/Modal";
import { toast } from "sonner";

export const Route = createFileRoute("/kaizen")({ component: Kaizen });

function Kaizen() {
  const { kaizen, updateKaizen, removeKaizen } = useStore();
  const [editing, setEditing] = useState<KaizenEntry | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const streak = useMemo(() => {
    const days = new Set(kaizen.map((k) => k.date));
    let n = 0;
    for (let i = 0; i < 365; i++) {
      const d = daysAgoISO(i);
      if (days.has(d)) n++;
      else if (i > 0) break;
    }
    return n;
  }, [kaizen]);

  const month = todayISO().slice(0, 7);
  const monthCount = kaizen.filter((k) => k.date.startsWith(month)).length;

  const completionRate = useMemo(() => {
    const totalDays = 30;
    let filled = 0;
    for (let i = 0; i < totalDays; i++) {
      const d = daysAgoISO(i);
      if (kaizen.some((k) => k.date === d)) filled++;
    }
    return Math.round((filled / totalDays) * 100);
  }, [kaizen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...kaizen].sort((a, b) => b.date.localeCompare(a.date));
    if (!q) return sorted;
    return sorted.filter(
      (k) =>
        k.improvedToday.toLowerCase().includes(q) ||
        k.improveTomorrow.toLowerCase().includes(q) ||
        k.notes.toLowerCase().includes(q) ||
        k.date.includes(q)
    );
  }, [kaizen, search]);

  const paged = filtered.slice(0, page * 20);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof paged>();
    paged.forEach((k) => {
      const arr = map.get(k.date) || [];
      arr.push(k);
      map.set(k.date, arr);
    });
    return Array.from(map);
  }, [paged]);

  return (
    <div className="space-y-6">
      <PageHeader title="Kaizen Diário" subtitle="1% melhor todo dia — reflita, registre e evolua 🌱" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Streak Kaizen" value={`${streak}d`} icon="🔥" tone="gold" />
        <KpiCard label="Dias este mês" value={monthCount} icon="📅" />
        <KpiCard label="Taxa 30 dias" value={`${completionRate}%`} icon="📈" tone="gold" />
      </div>

      <KaizenTodayCard />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl font-semibold">Histórico</h2>
        <input
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 w-full sm:w-64 text-white placeholder:text-muted-foreground/60"
          placeholder="Buscar por texto ou data..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="space-y-4">
        {grouped.length === 0 && (
          <GlassCard>
            <p className="text-sm text-muted-foreground py-4 text-center">
              {search ? "Nenhum registro encontrado." : "Nenhum Kaizen registrado ainda. Comece pelo card acima!"}
            </p>
          </GlassCard>
        )}
        {grouped.map(([date, items]) => (
          <div key={date}>
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{fmtDate(date)}</div>
            <div className="space-y-2">
              {items.map((k) => (
                <GlassCard key={k.id} className="!p-4 group hover:border-purple-500/30 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      {k.improvedToday && (
                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">O que melhorei 1% hoje</div>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-0.5">{k.improvedToday}</p>
                        </div>
                      )}
                      {k.improveTomorrow && (
                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-gold font-semibold">O que posso melhorar 1% amanhã</div>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-0.5">{k.improveTomorrow}</p>
                        </div>
                      )}
                      {k.notes && (
                        <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Anotações</div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">{k.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={() => setEditing(k)}
                        title="Editar"
                        className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      <ConfirmButton
                        onConfirm={() => {
                          removeKaizen(k.id);
                          toast.success("Kaizen removido.");
                        }}
                        message="Excluir este Kaizen?"
                        className="p-1.5 rounded hover:bg-white/10 text-coral"
                      >
                        <Trash2 size={14} />
                      </ConfirmButton>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        ))}
        {filtered.length > page * 20 && (
          <button onClick={() => setPage(page + 1)} className="text-sm text-gold hover:underline">
            Ver mais
          </button>
        )}
      </div>

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title={`Editar Kaizen — ${fmtDate(editing.date)}`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const improvedToday = String(fd.get("improvedToday") ?? "");
              const improveTomorrow = String(fd.get("improveTomorrow") ?? "");
              const notes = String(fd.get("notes") ?? "");
              const date = String(fd.get("date") ?? editing.date);
              if (!improvedToday.trim() && !improveTomorrow.trim() && !notes.trim()) {
                toast.error("Preencha ao menos um campo.");
                return;
              }
              updateKaizen(editing.id, { date, improvedToday: improvedToday.trim(), improveTomorrow: improveTomorrow.trim(), notes: notes.trim() });
              toast.success("Kaizen atualizado.");
              setEditing(null);
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data</label>
              <input name="date" type="date" defaultValue={editing.date} className={inpCls} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">O que melhorei 1% hoje?</label>
              <textarea name="improvedToday" defaultValue={editing.improvedToday} rows={3} className={inpCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">O que posso melhorar 1% amanhã?</label>
              <textarea name="improveTomorrow" defaultValue={editing.improveTomorrow} rows={3} className={inpCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Anotações livres</label>
              <textarea name="notes" defaultValue={editing.notes} rows={3} className={inpCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition">
                Cancelar
              </button>
              <button type="submit" className={btnGold}>
                Salvar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
