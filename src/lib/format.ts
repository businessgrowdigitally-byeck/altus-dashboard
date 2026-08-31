export const brl = (n: number) => formatCurrency(n);
export const kg = (n: number) => formatWeight(n);

export type LangCode = "pt" | "en" | "es";
const LOCALE: Record<LangCode, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };
const CURRENCY: Record<LangCode, string> = { pt: "BRL", en: "USD", es: "EUR" };

function getCurrentLang(): LangCode {
  try {
    if (typeof window === "undefined") return "pt";
    const raw = localStorage.getItem("altus-lang");
    if (!raw) return "pt";
    const parsed = JSON.parse(raw);
    const lang = (parsed?.state?.lang ?? parsed?.lang) as string | undefined;
    if (lang === "en" || lang === "es" || lang === "pt") return lang;
    return "pt";
  } catch {
    return "pt";
  }
}

export const formatCurrency = (n: number, lang?: LangCode) => {
  const l = lang ?? getCurrentLang();
  return n.toLocaleString(LOCALE[l], { style: "currency", currency: CURRENCY[l] });
};

export const formatWeight = (n: number, lang?: LangCode) => {
  const l = lang ?? getCurrentLang();
  return l === "en" ? `${(n * 2.20462).toFixed(1)} lbs` : `${n.toFixed(1)} kg`;
};

/**
 * Data no formato YYYY-MM-DD usando o fuso do usuário.
 *
 * Nunca use `toISOString().slice(0, 10)` para isso: ele converte para UTC, e
 * no Brasil (UTC−3) das 21h à meia-noite o resultado já é o dia seguinte —
 * o que faz o registro da noite cair no dia errado.
 */
export const toISODate = (d: Date) => {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
};

export const todayISO = () => toISODate(new Date());

/** Data de N dias atrás em hora local. Valores negativos avançam no tempo. */
export const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

export const fmtDate = (iso: string, lang?: LangCode) => {
  const l = lang ?? getCurrentLang();
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString(LOCALE[l]);
};

export const fmtDateLong = (d: Date, lang?: LangCode) =>
  d.toLocaleDateString(LOCALE[lang ?? getCurrentLang()], { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const greeting = (lang?: LangCode) => {
  const l = lang ?? getCurrentLang();
  const h = new Date().getHours();
  if (l === "en") return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  if (l === "es") return h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export const QUOTES: Record<LangCode, string[]> = {
  pt: [
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
  ],
  en: [
    "Discipline is the bridge between goals and achievement.",
    "You become what you measure.",
    "Small daily gains compound into great victories.",
    "What is not recorded is not managed.",
    "Your life is your most important business.",
    "Excellence is a habit, not an accident.",
    "Every decision is a vote for the person you want to become.",
    "Today is the newest version of you.",
    "Focus is saying no to 100 good ideas.",
    "Consistency beats intensity.",
  ],
  es: [
    "La disciplina es el puente entre objetivos y logros.",
    "Te conviertes en lo que mides.",
    "Pequeñas ganancias diarias se acumulan en grandes victorias.",
    "Lo que no se registra no se gestiona.",
    "Tu vida es tu empresa más importante.",
    "La excelencia es un hábito, no un accidente.",
    "Cada decisión es un voto por la persona que quieres ser.",
    "Hoy es la versión más nueva de ti.",
    "Enfocarse es decir no a 100 buenas ideas.",
    "La constancia vence a la intensidad.",
  ],
};

export const dailyQuote = (lang?: LangCode) => {
  const l = lang ?? getCurrentLang();
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const arr = QUOTES[l] ?? QUOTES.pt;
  return arr[day % arr.length];
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