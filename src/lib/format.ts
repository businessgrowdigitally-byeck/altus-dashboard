export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const kg = (n: number) => `${n.toFixed(1)} kg`;

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso: string) => {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
};

export const fmtDateLong = (d: Date) =>
  d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export const QUOTES = [
  "Disciplina é a ponte entre objetivos e conquistas.",
  "Você se torna aquilo que mede.",
  "Pequenos ganhos diários se acumulam em grandes vitórias.",
  "O que não é registrado, não é gerenciado.",
  "Sua vida é a sua empresa mais importante.",
  "Excelência é hábito, não acidente.",
  "Cada decisão é um voto na pessoa que você quer se tornar.",
  "Hoje é a versão mais nova de você.",
  "Foco é dizer não a 100 boas ideias.",
  "Constância vence intensidade.",
];

export const dailyQuote = () => {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return QUOTES[day % QUOTES.length];
};

export const CATEGORIES = [
  { id: "Alimentação", icon: "🍔" },
  { id: "Moradia", icon: "🏠" },
  { id: "Lazer", icon: "🎮" },
  { id: "Transporte", icon: "🚗" },
  { id: "Saúde", icon: "💊" },
  { id: "Investimento", icon: "📈" },
  { id: "Outros", icon: "📦" },
];

export const STUDY_TYPES = [
  { id: "Leitura", icon: "📖" },
  { id: "Curso Online", icon: "💻" },
  { id: "Aula", icon: "🎓" },
  { id: "Pesquisa", icon: "🔬" },
  { id: "Revisão", icon: "🧠" },
  { id: "Podcast", icon: "🎧" },
  { id: "Vídeo", icon: "🎬" },
];

export const STUDY_AREAS = [
  "Tecnologia",
  "Finanças",
  "Saúde",
  "Filosofia",
  "Linguagens",
  "Marketing",
  "Outros",
];

export const GENRES = [
  "Ficção",
  "Não-Ficção",
  "Negócios",
  "Desenvolvimento Pessoal",
  "Filosofia",
  "Ciências",
  "Biografia",
  "Outro",
];

export const WORKOUT_TYPES = ["Musculação", "Cardio", "Funcional", "Yoga", "Outro"];