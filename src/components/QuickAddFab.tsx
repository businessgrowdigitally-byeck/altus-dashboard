import { useState } from "react";
import { Plus, Wallet, HeartPulse, BookOpen, GraduationCap, Dumbbell, Check } from "lucide-react";
import { Modal, inpCls, btnGold } from "./Modal";
import { useStore } from "@/lib/store";
import { todayISO, CATEGORIES, WORKOUT_TYPES, STUDY_AREAS, GENRES } from "@/lib/format";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

type QuickActionType = "menu" | "transaction" | "weight" | "workout" | "study" | "book";

export function QuickAddFab() {
  const [currentModal, setCurrentModal] = useState<QuickActionType | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const t = useT();
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
        aria-label={t("quickAdd.fab")}
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-900/50 border border-purple-400/30 flex items-center justify-center active:scale-95 transition-all"
      >
        <Plus size={28} className="transition-transform duration-200" />
      </button>

      {/* Main Action Menu Modal */}
      <Modal
        open={currentModal === "menu"}
        onClose={() => setCurrentModal(null)}
        title={t("quickAdd.menuTitle")}
      >
        <p className="text-xs text-muted-foreground mb-4">{t("quickAdd.subtitle")}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCurrentModal("transaction")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-gold/40 hover:bg-white/10 transition text-center"
          >
            <span className="text-3xl">💰</span>
            <span className="text-sm font-medium">{t("quickAdd.transaction")}</span>
          </button>
          <button
            onClick={() => setCurrentModal("weight")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-emerald-bgt/40 hover:bg-white/10 transition text-center"
          >
            <span className="text-3xl">⚖️</span>
            <span className="text-sm font-medium">{t("quickAdd.weight")}</span>
          </button>
          <button
            onClick={() => setCurrentModal("workout")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-purple-500/40 hover:bg-white/10 transition text-center"
          >
            <span className="text-3xl">💪</span>
            <span className="text-sm font-medium">{t("quickAdd.workout")}</span>
          </button>
          <button
            onClick={() => setCurrentModal("study")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-500/40 hover:bg-white/10 transition text-center"
          >
            <span className="text-3xl">🎓</span>
            <span className="text-sm font-medium">{t("quickAdd.study")}</span>
          </button>
          <button
            onClick={() => setCurrentModal("book")}
            className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-amber-500/40 hover:bg-white/10 transition text-center col-span-2"
          >
            <span className="text-3xl">📚</span>
            <span className="text-sm font-medium">{t("quickAdd.book")}</span>
          </button>
        </div>
      </Modal>

      {/* Quick Transaction Modal */}
      {currentModal === "transaction" && (
        <Modal
          open={true}
          onClose={() => setCurrentModal(null)}
          title={t("quickAdd.modalTransaction")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const val = parseFloat(String(fd.get("value")).replace(",", "."));
              if (!Number.isFinite(val) || val <= 0) {
                toast.error(t("quickAdd.errValue"));
                return;
              }
              addTransaction({
                type: String(fd.get("type")) as "entrada" | "saida",
                value: val,
                description: String(fd.get("description") || "Gasto"),
                category: String(fd.get("category") || "Alimentação"),
                date: String(fd.get("date") || todayISO()),
              });
              showFeedback(t("quickAdd.toastTransaction"));
            }}
            className="space-y-3"
          >
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <label className="flex-1 text-center py-2 text-sm font-medium cursor-pointer bg-white/5 has-[:checked]:bg-emerald-bgt has-[:checked]:text-black transition">
                <input type="radio" name="type" value="entrada" className="sr-only" />
                {t("quickAdd.entrada")}
              </label>
              <label className="flex-1 text-center py-2 text-sm font-medium cursor-pointer bg-white/5 has-[:checked]:bg-coral has-[:checked]:text-white transition">
                <input type="radio" name="type" value="saida" defaultChecked className="sr-only" />
                {t("quickAdd.saida")}
              </label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.value")}
              </label>
              <input
                name="value"
                type="number"
                step="0.01"
                placeholder={t("quickAdd.placeholderValue")}
                className={inpCls}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.description")}
              </label>
              <input
                name="description"
                placeholder={t("quickAdd.placeholderDescription")}
                className={inpCls}
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.category")}
              </label>
              <select name="category" className={inpCls}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {t("cat." + c.id)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.date")}
              </label>
              <input
                name="date"
                type="date"
                defaultValue={todayISO()}
                className={inpCls}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCurrentModal("menu")}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm"
              >
                {t("quickAdd.back")}
              </button>
              <button type="submit" className={btnGold}>
                {t("quickAdd.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Weight Modal */}
      {currentModal === "weight" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title={t("quickAdd.modalWeight")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const val = parseFloat(String(fd.get("weight")).replace(",", "."));
              if (!Number.isFinite(val) || val <= 0) {
                toast.error(t("quickAdd.errWeight"));
                return;
              }
              addWeight({
                weight: val,
                date: String(fd.get("date") || todayISO()),
                notes: String(fd.get("notes") || ""),
              });
              showFeedback(t("quickAdd.toastWeight"));
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.weightKg")}
              </label>
              <input
                name="weight"
                type="number"
                step="0.1"
                placeholder={t("quickAdd.placeholderWeight")}
                className={inpCls}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.date")}
              </label>
              <input
                name="date"
                type="date"
                defaultValue={todayISO()}
                className={inpCls}
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.observations")}
              </label>
              <textarea
                name="notes"
                placeholder={t("quickAdd.placeholderNotes")}
                rows={2}
                className={inpCls}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCurrentModal("menu")}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm"
              >
                {t("quickAdd.back")}
              </button>
              <button type="submit" className={btnGold}>
                {t("quickAdd.saveWeight")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Workout Modal */}
      {currentModal === "workout" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title={t("quickAdd.modalWorkout")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const dur = parseInt(String(fd.get("duration")), 10);
              if (!Number.isFinite(dur) || dur <= 0) {
                toast.error(t("quickAdd.errWorkoutDuration"));
                return;
              }
              addWorkout({
                type: String(fd.get("type") || "Musculação"),
                duration: dur,
                date: String(fd.get("date") || todayISO()),
                notes: String(fd.get("notes") || ""),
              });
              showFeedback(t("quickAdd.toastWorkout"));
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.workoutType")}
              </label>
              <select name="type" className={inpCls}>
                {WORKOUT_TYPES.map((w) => (
                  <option key={w} value={w}>
                    {t("workout." + w)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.durationMin")}
              </label>
              <input
                name="duration"
                type="number"
                placeholder={t("quickAdd.placeholderDuration")}
                className={inpCls}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.date")}
              </label>
              <input
                name="date"
                type="date"
                defaultValue={todayISO()}
                className={inpCls}
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.notes")}
              </label>
              <textarea
                name="notes"
                placeholder={t("quickAdd.placeholderNotesOptional")}
                rows={2}
                className={inpCls}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCurrentModal("menu")}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm"
              >
                {t("quickAdd.back")}
              </button>
              <button type="submit" className={btnGold}>
                {t("quickAdd.saveWorkout")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Study Modal */}
      {currentModal === "study" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title={t("quickAdd.modalStudy")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const dur = parseInt(String(fd.get("duration")), 10);
              const tema = String(fd.get("topic") ?? "").trim();
              if (!tema) {
                toast.error(t("quickAdd.errTopic"));
                return;
              }
              if (!Number.isFinite(dur) || dur <= 0) {
                toast.error(t("quickAdd.errStudyDuration"));
                return;
              }
              addStudy({
                topic: tema,
                area: String(fd.get("area") || "Tecnologia"),
                type: String(fd.get("type") || "Leitura"),
                duration: dur,
                date: String(fd.get("date") || todayISO()),
                learned: String(fd.get("learned") || ""),
                insights: String(fd.get("insights") || ""),
                status: String(fd.get("status") || "concluido") as "progresso" | "concluido",
              });
              showFeedback(t("quickAdd.toastStudy"));
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.topic")}
              </label>
              <input
                name="topic"
                placeholder={t("quickAdd.placeholderTopic")}
                className={inpCls}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("quickAdd.area")}
                </label>
                <select name="area" className={inpCls}>
                  {STUDY_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {t("area." + a)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("quickAdd.durationMinShort")}
                </label>
                <input
                  name="duration"
                  type="number"
                  placeholder={t("quickAdd.placeholderDuration")}
                  className={inpCls}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.learned")}
              </label>
              <textarea
                name="learned"
                placeholder={t("quickAdd.placeholderLearned")}
                rows={2}
                className={inpCls}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCurrentModal("menu")}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm"
              >
                {t("quickAdd.back")}
              </button>
              <button type="submit" className={btnGold}>
                {t("quickAdd.saveStudy")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Book Modal */}
      {currentModal === "book" && (
        <Modal open={true} onClose={() => setCurrentModal(null)} title={t("quickAdd.modalBook")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const titulo = String(fd.get("title") ?? "").trim();
              const autor = String(fd.get("author") ?? "").trim();
              if (!titulo || !autor) {
                toast.error(t("quickAdd.errBook"));
                return;
              }
              addBook({
                title: titulo,
                author: autor,
                genre: String(fd.get("genre") || "Negócios"),
                finishedAt: String(fd.get("finishedAt") || todayISO()),
                rating: parseInt(String(fd.get("rating") || "5"), 10),
                notes: String(fd.get("notes") || ""),
              });
              showFeedback(t("quickAdd.toastBook"));
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.title")}
              </label>
              <input
                name="title"
                placeholder={t("quickAdd.placeholderTitle")}
                className={inpCls}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.author")}
              </label>
              <input
                name="author"
                placeholder={t("quickAdd.placeholderAuthor")}
                className={inpCls}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("quickAdd.genre")}
                </label>
                <select name="genre" className={inpCls}>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {t("genre." + g)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("quickAdd.rating")}
                </label>
                <select name="rating" defaultValue="5" className={inpCls}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {t("quickAdd.stars", { n })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("quickAdd.finishDate")}
              </label>
              <input
                name="finishedAt"
                type="date"
                defaultValue={todayISO()}
                className={inpCls}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCurrentModal("menu")}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm"
              >
                {t("quickAdd.back")}
              </button>
              <button type="submit" className={btnGold}>
                {t("quickAdd.saveBook")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
