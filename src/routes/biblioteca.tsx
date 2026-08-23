import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, type Book } from "@/lib/store";
import { fmtDate, GENRES, todayISO } from "@/lib/format";
import { GlassCard, KpiCard, PageHeader, Section } from "@/components/primitives";
import { Star, Trash2, Pencil, BookOpen, Eye } from "lucide-react";
import { Modal, ConfirmButton, inpCls, btnGold } from "@/components/Modal";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/biblioteca")({ component: Biblioteca });

const GENRE_COLORS: Record<string, string> = {
  "Ficção": "#9B59B6",
  "Não-Ficção": "#3498DB",
  "Negócios": "#F5C842",
  "Desenvolvimento Pessoal": "#2ECC71",
  "Filosofia": "#E67E22",
  "Ciências": "#1ABC9C",
  "Biografia": "#E74C3C",
  "Outro": "#95A5A6",
};

function Biblioteca() {
  const { books, addBook, updateBook, removeBook } = useStore();
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);

  const [form, setForm] = useState({
    title: "",
    author: "",
    year: "",
    pages: "",
    genre: "Negócios",
    finishedAt: todayISO(),
    rating: 5,
    notes: "",
    applications: "",
  });

  const [search, setSearch] = useState("");
  const [filterGenre, setFilterGenre] = useState("Todos");

  const filtered = books.filter((b) => {
    if (filterGenre !== "Todos" && b.genre !== filterGenre) return false;
    if (search && !(b.title + b.author).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const year = new Date().getFullYear();
  const thisYear = books.filter((b) => b.finishedAt.startsWith(String(year)));
  const avgRating = books.length ? books.reduce((a, b) => a + b.rating, 0) / books.length : 0;
  const totalPages = books.reduce((a, b) => a + (b.pages || 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      toast.error("Título e autor são obrigatórios.");
      return;
    }
    addBook({
      title: form.title,
      author: form.author,
      year: form.year ? parseInt(form.year, 10) : undefined,
      pages: form.pages ? parseInt(form.pages, 10) : undefined,
      genre: form.genre,
      finishedAt: form.finishedAt,
      rating: form.rating,
      notes: form.notes,
      applications: form.applications,
    });
    setForm({ ...form, title: "", author: "", year: "", pages: "", notes: "", applications: "" });
    toast.success("Livro adicionado à biblioteca.");
  };

  const byMonth = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({
      mes: String(i + 1).padStart(2, "0"),
      livros: 0,
    }));
    thisYear.forEach((b) => {
      const m = parseInt(b.finishedAt.slice(5, 7), 10) - 1;
      arr[m].livros++;
    });
    return arr;
  }, [thisYear]);

  const byGenre = useMemo(() => {
    const map = new Map<string, number>();
    books.forEach((b) => map.set(b.genre, (map.get(b.genre) || 0) + 1));
    return Array.from(map, ([genero, qtd]) => ({ genero, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 6);
  }, [books]);

  const ratingTrend = useMemo(() => {
    return [...books]
      .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
      .map((b) => ({ date: b.finishedAt.slice(5), nota: b.rating }));
  }, [books]);

  return (
    <div>
      <PageHeader title="Sua Biblioteca" subtitle={`${books.length} livro${books.length !== 1 ? "s" : ""} lido${books.length !== 1 ? "s" : ""}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Livros Lidos" value={books.length} icon="📚" tone="gold" />
        <KpiCard label={`Livros em ${year}`} value={thisYear.length} icon="📖" />
        <KpiCard label="Nota Média" value={avgRating ? avgRating.toFixed(1) : "—"} icon="⭐" tone="gold" />
        <KpiCard label="Páginas Totais" value={totalPages.toLocaleString("pt-BR")} icon="📃" />
      </div>

      <Section title="Adicionar Livro">
        <GlassCard>
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
            <input className={inpCls} placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <input className={inpCls} placeholder="Autor" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} required />
            <input className={inpCls} type="number" placeholder="Ano de publicação" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            <input className={inpCls} type="number" placeholder="Número de páginas" value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} />
            <select className={inpCls} value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <input className={inpCls} type="date" value={form.finishedAt} onChange={(e) => setForm({ ...form, finishedAt: e.target.value })} required />
            <div className="md:col-span-2 flex items-center gap-1">
              <span className="text-sm mr-2 text-muted-foreground">Nota:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setForm({ ...form, rating: n })} className="p-1 hover:scale-110 transition">
                  <Star size={22} className={n <= form.rating ? "fill-[#F5C842] text-[#F5C842]" : "text-white/30"} />
                </button>
              ))}
            </div>
            <textarea className={`${inpCls} md:col-span-2`} rows={3} placeholder="Minhas notas (principais ideias, citações)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <textarea className={`${inpCls} md:col-span-2`} rows={2} placeholder="Aplicações práticas na vida/trabalho" value={form.applications} onChange={(e) => setForm({ ...form, applications: e.target.value })} />
            <button type="submit" className={`${btnGold} md:col-span-2`}>Adicionar à Biblioteca</button>
          </form>
        </GlassCard>
      </Section>

      <div className="flex flex-wrap gap-2 mt-6">
        <input className={`${inpCls} max-w-xs`} placeholder="Buscar título ou autor..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${inpCls} max-w-xs`} value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)}>
          <option value="Todos">Todos os gêneros</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <Section>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((b) => (
            <GlassCard key={b.id} className="group flex flex-col justify-between relative hover:border-gold/40 transition">
              <div>
                <div
                  className="h-32 rounded-lg mb-3 flex items-center justify-center font-display text-5xl font-bold text-black/70 relative overflow-hidden shadow-inner"
                  style={{ background: `linear-gradient(135deg, ${GENRE_COLORS[b.genre] || "#888"}, ${GENRE_COLORS[b.genre] || "#888"}88)` }}
                >
                  {b.title[0]}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition bg-black/60 backdrop-blur-sm p-1 rounded-md">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingBook(b); }}
                      title="Editar"
                      className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white"
                    >
                      <Pencil size={13} />
                    </button>
                    <ConfirmButton
                      onConfirm={() => removeBook(b.id)}
                      message={`Excluir o livro "${b.title}"?`}
                      className="p-1 rounded hover:bg-white/20 text-coral"
                    >
                      <Trash2 size={13} />
                    </ConfirmButton>
                  </div>
                </div>
                <h4 className="font-semibold text-sm leading-tight line-clamp-2">{b.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{b.author}{b.year ? ` • ${b.year}` : ""}</p>
                <div className="flex items-center gap-0.5 my-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={12} className={n <= b.rating ? "fill-[#F5C842] text-[#F5C842]" : "text-white/20"} />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1.5">{b.genre}</span>
                </div>
                {b.notes && <p className="text-xs text-muted-foreground line-clamp-2 italic">"{b.notes}"</p>}
              </div>

              <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{fmtDate(b.finishedAt)}</span>
                {(b.notes || b.applications) && (
                  <button
                    onClick={() => setViewingBook(b)}
                    className="text-xs text-gold hover:underline flex items-center gap-1"
                  >
                    <Eye size={12} /> Ver notas
                  </button>
                )}
              </div>
            </GlassCard>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-8 text-center">Nenhum livro encontrado.</p>}
        </div>
      </Section>

      <Section title="Estatísticas de Leitura">
        <div className="grid md:grid-cols-3 gap-4">
          <GlassCard>
            <h4 className="text-sm text-muted-foreground mb-2">Livros por mês ({year})</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byMonth}>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis dataKey="mes" fontSize={10} stroke="#888" />
                <YAxis fontSize={10} stroke="#888" />
                <Tooltip contentStyle={ttStyle} />
                <Bar dataKey="livros" fill="#F5C842" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
          <GlassCard>
            <h4 className="text-sm text-muted-foreground mb-2">Por gênero</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byGenre} layout="vertical">
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis type="number" fontSize={10} stroke="#888" />
                <YAxis type="category" dataKey="genero" fontSize={10} stroke="#888" width={80} />
                <Tooltip contentStyle={ttStyle} />
                <Bar dataKey="qtd" fill="#2ECC71" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
          <GlassCard>
            <h4 className="text-sm text-muted-foreground mb-2">Notas ao longo do tempo</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ratingTrend}>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis dataKey="date" fontSize={10} stroke="#888" />
                <YAxis domain={[0, 5]} fontSize={10} stroke="#888" />
                <Tooltip contentStyle={ttStyle} />
                <Line type="monotone" dataKey="nota" stroke="#F5C842" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>
      </Section>

      {/* Modal Visualizar Detalhes do Livro */}
      {viewingBook && (
        <Modal open={!!viewingBook} onClose={() => setViewingBook(null)} title={viewingBook.title}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{viewingBook.author}</p>
                <p className="text-xs text-muted-foreground">{viewingBook.genre} • Concluído em {fmtDate(viewingBook.finishedAt)}</p>
              </div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={14} className={n <= viewingBook.rating ? "fill-[#F5C842] text-[#F5C842]" : "text-white/20"} />
                ))}
              </div>
            </div>

            {viewingBook.notes && (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-gold mb-1.5">Anotações &amp; Citações</h5>
                <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{viewingBook.notes}</p>
              </div>
            )}

            {viewingBook.applications && (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-emerald-bgt mb-1.5">Aplicações Práticas</h5>
                <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{viewingBook.applications}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const b = viewingBook;
                  setViewingBook(null);
                  setEditingBook(b);
                }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm transition"
              >
                Editar Livro
              </button>
              <button type="button" onClick={() => setViewingBook(null)} className={btnGold}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Editar Livro */}
      {editingBook && (
        <Modal open={!!editingBook} onClose={() => setEditingBook(null)} title="Editar Livro">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateBook(editingBook.id, {
                title: String(fd.get("title") || editingBook.title),
                author: String(fd.get("author") || editingBook.author),
                year: fd.get("year") ? parseInt(String(fd.get("year")), 10) : undefined,
                pages: fd.get("pages") ? parseInt(String(fd.get("pages")), 10) : undefined,
                genre: String(fd.get("genre") || editingBook.genre),
                finishedAt: String(fd.get("finishedAt") || editingBook.finishedAt),
                rating: parseInt(String(fd.get("rating") || editingBook.rating), 10),
                notes: String(fd.get("notes") || ""),
                applications: String(fd.get("applications") || ""),
              });
              setEditingBook(null);
            }}
            className="space-y-3"
          >
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Título</label>
                <input name="title" defaultValue={editingBook.title} className={inpCls} required />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Autor</label>
                <input name="author" defaultValue={editingBook.author} className={inpCls} required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Ano</label>
                <input name="year" type="number" defaultValue={editingBook.year} className={inpCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Páginas</label>
                <input name="pages" type="number" defaultValue={editingBook.pages} className={inpCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Nota (1 a 5)</label>
                <select name="rating" defaultValue={editingBook.rating} className={inpCls}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} estrela{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Gênero</label>
                <select name="genre" defaultValue={editingBook.genre} className={inpCls}>
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Data de Conclusão</label>
                <input name="finishedAt" type="date" defaultValue={editingBook.finishedAt} className={inpCls} required />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Minhas Anotações</label>
              <textarea name="notes" defaultValue={editingBook.notes ?? ""} rows={3} className={inpCls} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Aplicações Práticas</label>
              <textarea name="applications" defaultValue={editingBook.applications ?? ""} rows={2} className={inpCls} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingBook(null)} className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition">
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

const ttStyle = {
  backgroundColor: "rgba(12,11,24,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
};