import { useState } from "react";
import { Plus, Wallet, HeartPulse, BookOpen, GraduationCap, Dumbbell, Check } from "lucide-react";
import { Modal, inpCls, btnGold } from "./Modal";
import { useStore } from "@/lib/store";
import { todayISO, CATEGORIES, WORKOUT_TYPES, STUDY_AREAS, STUDY_TYPES, GENRES } from "@/lib/format";

type QuickActionType = "menu" | "transaction" | "weight" | "workout" | "study" | "book";

export function QuickAddFab() {
  const [currentModal, setCurrentModal] = useState<QuickActionType | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { addTransaction, addWeight, addWorkout, addStudy, addBook } = useStore();

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setCurrentModal(null);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <>
      {/* Toast Feedback */}
      {successMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-bgt text-black text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-bounce">
          <Check size={16} /> {successMsg}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setCurrentModal("menu")}
        aria-label="Adicionar rápido"
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-900/50 border border-purple-400/30 flex items-center justify-center active:scale-95 transition-all"
      >
        <Plus size={28} className="transition-transform duration-200" />
      </button>

      {/* Main Action Menu Modal */}
      <Modal open={currentModal === "menu"} onClose={() => setCurrentModal(null)} title="Registro Rápido">
        <p className="text-xs text-muted-foreground mb-4">Escolha o que deseja registrar agora em 1 toque:</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCurrentModal("transaction")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-gold/40 hover:bg-white/10 transition text-center"
          >
            <span className="text-3xl">💰</span>
            <span className="text-sm font-medium">Transação</span>
          </button>
          <button
            onClick={() => setCurrentModal("weight")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-emerald-bgt/40 hover:bg-white/10 transition text-center"
          >
            <span className="text-3xl">⚖️</span>
            <span className="text-sm font-medium">Peso Corporal</span>
          </button>
          <button
            onClick={() => setCurrentModal("workout")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-purple-500/40 hover:bg-white/10 transition text-center"
          >
            <span className="text-3xl">💪</span>
            <span className="text-sm font-medium">Treino</span>
          </button>
          <button
            onClick={() => setCurrentModal("study")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-500/40 hover:bg-white/10 transition text-center"
          >
            <span className="text-3xl">🎓</span>
            <span className="text-sm font-medium">Sessão de Estudo</span>
          </button>
          <button
            onClick={() => setCurrentModal("book")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-amber-500/40 hover:bg-white/10 transition text-center col-span-2"
          >
            <span className="text-3xl">📚</span>
            <span className="text-sm font-medium">Livro Lido</span>
          </button>
        </div>
      </Modal>

      {/* Quick Transaction Modal */}
      {currentModal === "transaction" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title="Registrar Transação">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const val = parseFloat(String(fd.get("value")).replace(",", "."));
              if (!val) return;
              addTransaction({
                type: String(fd.get("type")) as "entrada" | "saida",
                value: val,
                description: String(fd.get("description") || "Gasto"),
                category: String(fd.get("category") || "Alimentação"),
                date: String(fd.get("date") || todayISO()),
              });
              showFeedback("Transação registrada!");
            }}
            className="space-y-3"
          >
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <label className="flex-1 text-center py-2 text-sm font-medium cursor-pointer bg-white/5 has-[:checked]:bg-emerald-bgt has-[:checked]:text-black transition">
                <input type="radio" name="type" value="entrada" className="sr-only" />
                Entrada
              </label>
              <label className="flex-1 text-center py-2 text-sm font-medium cursor-pointer bg-white/5 has-[:checked]:bg-coral has-[:checked]:text-white transition">
                <input type="radio" name="type" value="saida" defaultChecked className="sr-only" />
                Saída
              </label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Valor (R$)</label>
              <input name="value" type="number" step="0.01" placeholder="0,00" className={inpCls} required autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Descrição</label>
              <input name="description" placeholder="ex: Supermercado" className={inpCls} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Categoria</label>
              <select name="category" className={inpCls}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data</label>
              <input name="date" type="date" defaultValue={todayISO()} className={inpCls} required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCurrentModal("menu")} className="px-4 py-2 rounded-lg border border-white/10 text-sm">
                Voltar
              </button>
              <button type="submit" className={btnGold}>
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Weight Modal */}
      {currentModal === "weight" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title="Registrar Peso">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const val = parseFloat(String(fd.get("weight")).replace(",", "."));
              if (!val) return;
              addWeight({
                weight: val,
                date: String(fd.get("date") || todayISO()),
                notes: String(fd.get("notes") || ""),
              });
              showFeedback("Peso registrado!");
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Peso Atual (kg)</label>
              <input name="weight" type="number" step="0.1" placeholder="ex: 78.5" className={inpCls} required autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data</label>
              <input name="date" type="date" defaultValue={todayISO()} className={inpCls} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Observações</label>
              <textarea name="notes" placeholder="ex: Jejum matinal..." rows={2} className={inpCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCurrentModal("menu")} className="px-4 py-2 rounded-lg border border-white/10 text-sm">
                Voltar
              </button>
              <button type="submit" className={btnGold}>
                Salvar Peso
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Workout Modal */}
      {currentModal === "workout" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title="Registrar Treino">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const dur = parseInt(String(fd.get("duration")), 10);
              if (!dur) return;
              addWorkout({
                type: String(fd.get("type") || "Musculação"),
                duration: dur,
                date: String(fd.get("date") || todayISO()),
                notes: String(fd.get("notes") || ""),
              });
              showFeedback("Treino registrado!");
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo de Treino</label>
              <select name="type" className={inpCls}>
                {WORKOUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Duração (minutos)</label>
              <input name="duration" type="number" placeholder="ex: 60" className={inpCls} required autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data</label>
              <input name="date" type="date" defaultValue={todayISO()} className={inpCls} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Notas</label>
              <textarea name="notes" placeholder="ex: Peito, ombro e tríceps" rows={2} className={inpCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCurrentModal("menu")} className="px-4 py-2 rounded-lg border border-white/10 text-sm">
                Voltar
              </button>
              <button type="submit" className={btnGold}>
                Salvar Treino
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Study Modal */}
      {currentModal === "study" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title="Registrar Estudo">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const dur = parseInt(String(fd.get("duration")), 10);
              if (!dur) return;
              addStudy({
                topic: String(fd.get("topic")),
                area: String(fd.get("area") || "Tecnologia"),
                type: String(fd.get("type") || "Leitura"),
                duration: dur,
                date: String(fd.get("date") || todayISO()),
                learned: String(fd.get("learned") || ""),
                insights: String(fd.get("insights") || ""),
                status: String(fd.get("status") || "concluido") as "progresso" | "concluido",
              });
              showFeedback("Estudo registrado!");
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tópico</label>
              <input name="topic" placeholder="ex: Next.js Server Actions" className={inpCls} required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Área</label>
                <select name="area" className={inpCls}>
                  {STUDY_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Duração (min)</label>
                <input name="duration" type="number" placeholder="ex: 45" className={inpCls} required />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">O que aprendeu?</label>
              <textarea name="learned" placeholder="Resumo em poucas palavras..." rows={2} className={inpCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCurrentModal("menu")} className="px-4 py-2 rounded-lg border border-white/10 text-sm">
                Voltar
              </button>
              <button type="submit" className={btnGold}>
                Salvar Estudo
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Book Modal */}
      {currentModal === "book" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title="Registrar Livro">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addBook({
                title: String(fd.get("title")),
                author: String(fd.get("author")),
                genre: String(fd.get("genre") || "Negócios"),
                finishedAt: String(fd.get("finishedAt") || todayISO()),
                rating: parseInt(String(fd.get("rating") || "5"), 10),
                notes: String(fd.get("notes") || ""),
              });
              showFeedback("Livro adicionado!");
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Título</label>
              <input name="title" placeholder="ex: Essencialismo" className={inpCls} required autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Autor</label>
              <input name="author" placeholder="ex: Greg McKeown" className={inpCls} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Gênero</label>
                <select name="genre" className={inpCls}>
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Nota</label>
                <select name="rating" defaultValue="5" className={inpCls}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} estrelas
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data Conclusão</label>
              <input name="finishedAt" type="date" defaultValue={todayISO()} className={inpCls} required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCurrentModal("menu")} className="px-4 py-2 rounded-lg border border-white/10 text-sm">
                Voltar
              </button>
              <button type="submit" className={btnGold}>
                Salvar Livro
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}