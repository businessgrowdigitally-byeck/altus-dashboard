import { create } from "zustand";
import { persist } from "zustand/middleware";
import { daysAgoISO, todayISO } from "./format";

export type Transaction = {
  id: string;
  type: "entrada" | "saida";
  value: number;
  description: string;
  category: string;
  date: string; // ISO yyyy-mm-dd
};

export type WeightEntry = {
  id: string;
  weight: number;
  date: string;
  notes?: string;
};

export type Workout = {
  id: string;
  date: string;
  type: string;
  duration: number;
  notes?: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  year?: number;
  pages?: number;
  genre: string;
  finishedAt: string;
  rating: number;
  notes?: string;
  applications?: string;
};

export type StudyEntry = {
  id: string;
  date: string;
  topic: string;
  area: string;
  type: string;
  duration: number; // minutes
  learned?: string;
  insights?: string;
  status: "progresso" | "concluido";
};

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type Profile = {
  name: string;
  goalWeight: number;
  incomeTarget: number;
  maxExpenses: number;
  /** Altura em metros. 0 = não informada — o IMC fica oculto até ser preenchida. */
  height: number;
};

export type Settings = {
  theme: "dark" | "light";
  accent: "gold" | "emerald" | "purple" | "blue";
  geminiKey: string;
};

export type GoalArea = "Finanças" | "Corpo & Saúde" | "Biblioteca" | "Estudos" | "Geral";
export type GoalType = "numerica" | "data" | "habito";

export type GoalMacro = {
  id: string;
  name: string;
  area: GoalArea;
  type: GoalType;
  currentValue: number;
  targetValue: number;
  unit: string;
  deadline?: string;
  motivation?: string;
  linkedModule?: "weight" | "books" | "finance_saved" | "study_hours" | null;
  createdAt: string;
};

export type GoalDaily = {
  id: string;
  name: string;
  area: GoalArea;
  linkedGoalId?: string | null;
  suggestedTime?: string; // HH:MM
  daysOfWeek: number[]; // 0=Dom..6=Sáb
};

export type DailyCompletion = { date: string; actionId: string };

type State = {
  version: number;
  profile: Profile;
  settings: Settings;
  transactions: Transaction[];
  weights: WeightEntry[];
  workouts: Workout[];
  books: Book[];
  studies: StudyEntry[];
  chat: ChatMsg[];
  goalsMacro: GoalMacro[];
  goalsDaily: GoalDaily[];
  completions: DailyCompletion[];

  addTransaction: (t: Omit<Transaction, "id">) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  removeTransaction: (id: string) => void;
  addWeight: (w: Omit<WeightEntry, "id">) => void;
  updateWeight: (id: string, patch: Partial<Omit<WeightEntry, "id">>) => void;
  removeWeight: (id: string) => void;
  addWorkout: (w: Omit<Workout, "id">) => void;
  updateWorkout: (id: string, patch: Partial<Omit<Workout, "id">>) => void;
  removeWorkout: (id: string) => void;
  addBook: (b: Omit<Book, "id">) => void;
  updateBook: (id: string, patch: Partial<Omit<Book, "id">>) => void;
  removeBook: (id: string) => void;
  addStudy: (s: Omit<StudyEntry, "id">) => void;
  updateStudy: (id: string, patch: Partial<Omit<StudyEntry, "id">>) => void;
  removeStudy: (id: string) => void;
  addGoalMacro: (g: Omit<GoalMacro, "id" | "createdAt">) => void;
  updateGoalMacro: (id: string, patch: Partial<Omit<GoalMacro, "id">>) => void;
  removeGoalMacro: (id: string) => void;
  addGoalDaily: (g: Omit<GoalDaily, "id">) => void;
  updateGoalDaily: (id: string, patch: Partial<Omit<GoalDaily, "id">>) => void;
  removeGoalDaily: (id: string) => void;
  toggleCompletion: (actionId: string, date: string) => void;
  recomputeLinkedGoals: () => void;
  pushChat: (m: ChatMsg) => void;
  updateLastAssistant: (content: string) => void;
  clearChat: () => void;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  exportAll: () => string;
  importAll: (json: string) => void;
  clearAll: () => void;
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const daysAgo = (n: number) => daysAgoISO(n);

const sampleTransactions: Transaction[] = [
  { id: uid(), type: "entrada", value: 8500, description: "Salário", category: "Investimento", date: daysAgo(25) },
  { id: uid(), type: "entrada", value: 1200, description: "Freela design", category: "Investimento", date: daysAgo(12) },
  { id: uid(), type: "saida", value: 1800, description: "Aluguel", category: "Moradia", date: daysAgo(24) },
  { id: uid(), type: "saida", value: 480, description: "Mercado da semana", category: "Alimentação", date: daysAgo(20) },
  { id: uid(), type: "saida", value: 89, description: "iFood com amigos", category: "Alimentação", date: daysAgo(8) },
  { id: uid(), type: "saida", value: 220, description: "Uber e gasolina", category: "Transporte", date: daysAgo(6) },
  { id: uid(), type: "saida", value: 65, description: "Cinema", category: "Lazer", date: daysAgo(4) },
  { id: uid(), type: "saida", value: 350, description: "Tesouro Selic", category: "Investimento", date: daysAgo(2) },
];

const sampleWeights: WeightEntry[] = [
  { id: uid(), weight: 82.4, date: daysAgo(50), notes: "Começando a registrar" },
  { id: uid(), weight: 81.8, date: daysAgo(40) },
  { id: uid(), weight: 81.1, date: daysAgo(30), notes: "Treinos consistentes" },
  { id: uid(), weight: 80.5, date: daysAgo(20) },
  { id: uid(), weight: 80.0, date: daysAgo(10) },
  { id: uid(), weight: 79.6, date: daysAgo(2), notes: "Constância" },
];

const sampleBooks: Book[] = [
  { id: uid(), title: "Hábitos Atômicos", author: "James Clear", year: 2018, pages: 320, genre: "Desenvolvimento Pessoal", finishedAt: daysAgo(120), rating: 5, notes: "Sistemas > metas. 1% melhor todo dia.", applications: "Criar rotinas de hábitos visíveis." },
  { id: uid(), title: "Princípios", author: "Ray Dalio", year: 2017, pages: 592, genre: "Negócios", finishedAt: daysAgo(80), rating: 5, notes: "Radical transparency. Diário de erros.", applications: "Documentar decisões." },
  { id: uid(), title: "Sapiens", author: "Yuval Noah Harari", year: 2011, pages: 464, genre: "Não-Ficção", finishedAt: daysAgo(45), rating: 4, notes: "Revoluções cognitiva, agrícola e científica." },
  { id: uid(), title: "Pai Rico, Pai Pobre", author: "Robert Kiyosaki", year: 1997, pages: 336, genre: "Negócios", finishedAt: daysAgo(20), rating: 4, notes: "Ativos vs passivos." },
  { id: uid(), title: "Meditações", author: "Marco Aurélio", year: 180, pages: 256, genre: "Filosofia", finishedAt: daysAgo(8), rating: 5, notes: "Estoicismo prático.", applications: "Reflexão diária pela manhã." },
];

const sampleStudies: StudyEntry[] = [
  { id: uid(), date: daysAgo(7), topic: "React Server Components", area: "Tecnologia", type: "Leitura", duration: 45, learned: "RSC reduzem JS no cliente.", insights: "Adotar em projetos novos.", status: "concluido" },
  { id: uid(), date: daysAgo(5), topic: "Análise fundamentalista", area: "Finanças", type: "Curso Online", duration: 90, learned: "P/L, P/VP, ROE.", status: "concluido" },
  { id: uid(), date: daysAgo(4), topic: "TanStack Start", area: "Tecnologia", type: "Pesquisa", duration: 60, learned: "Server functions e file routing.", insights: "Stack favorita.", status: "concluido" },
  { id: uid(), date: daysAgo(3), topic: "Estoicismo aplicado", area: "Filosofia", type: "Podcast", duration: 35, learned: "Dicotomia do controle.", status: "concluido" },
  { id: uid(), date: daysAgo(2), topic: "SEO técnico", area: "Marketing", type: "Vídeo", duration: 25, status: "progresso" },
  { id: uid(), date: daysAgo(1), topic: "TypeScript avançado", area: "Tecnologia", type: "Leitura", duration: 50, learned: "Generics condicionais.", status: "progresso" },
  { id: uid(), date: daysAgo(0), topic: "Treino HIIT — fisiologia", area: "Saúde", type: "Vídeo", duration: 20, status: "concluido" },
];

const sampleWorkouts: Workout[] = [
  { id: uid(), date: daysAgo(6), type: "Musculação", duration: 60, notes: "Peito e tríceps" },
  { id: uid(), date: daysAgo(4), type: "Cardio", duration: 30, notes: "Corrida 5km" },
  { id: uid(), date: daysAgo(2), type: "Musculação", duration: 70, notes: "Costas e bíceps" },
  { id: uid(), date: daysAgo(0), type: "Funcional", duration: 45 },
];

const sampleGoalsMacro: GoalMacro[] = [
  { id: uid(), name: "Chegar a 75kg", area: "Corpo & Saúde", type: "numerica", currentValue: 79.6, targetValue: 75, unit: "kg", deadline: daysAgo(-120), motivation: "Saúde e disposição.", linkedModule: "weight", createdAt: daysAgo(60) },
  { id: uid(), name: "Ler 24 livros em 2026", area: "Biblioteca", type: "numerica", currentValue: 5, targetValue: 24, unit: "livros", deadline: `${new Date().getFullYear()}-12-31`, motivation: "Construir biblioteca mental.", linkedModule: "books", createdAt: daysAgo(150) },
  { id: uid(), name: "Economizar R$20.000", area: "Finanças", type: "numerica", currentValue: 8120, targetValue: 20000, unit: "R$", deadline: `${new Date().getFullYear()}-12-31`, motivation: "Reserva de emergência + investimentos.", linkedModule: "finance_saved", createdAt: daysAgo(90) },
];

const sampleGoalsDaily: GoalDaily[] = [
  { id: uid(), name: "Treinar", area: "Corpo & Saúde", suggestedTime: "07:00", daysOfWeek: [1,2,3,4,5] },
  { id: uid(), name: "Ler 30 minutos", area: "Biblioteca", suggestedTime: "22:00", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: uid(), name: "Registrar gastos do dia", area: "Finanças", suggestedTime: "21:00", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: uid(), name: "Estudar 1h", area: "Estudos", suggestedTime: "20:00", daysOfWeek: [1,2,3,4,5] },
  { id: uid(), name: "Meditação 10min", area: "Geral", suggestedTime: "06:30", daysOfWeek: [0,1,2,3,4,5,6] },
];

const initial = {
  version: 2,
  profile: { name: "Visionário", goalWeight: 75, incomeTarget: 10000, maxExpenses: 6000, height: 1.75 } as Profile,
  settings: { theme: "dark" as const, accent: "gold" as const, geminiKey: "" },
  transactions: sampleTransactions,
  weights: sampleWeights,
  workouts: sampleWorkouts,
  books: sampleBooks,
  studies: sampleStudies,
  chat: [] as ChatMsg[],
  goalsMacro: sampleGoalsMacro,
  goalsDaily: sampleGoalsDaily,
  completions: [] as DailyCompletion[],
};

/** Campos que são sincronizados com a nuvem (tudo menos as funções do store). */
export const SYNC_KEYS = [
  "version", "profile", "settings", "transactions", "weights", "workouts",
  "books", "studies", "chat", "goalsMacro", "goalsDaily", "completions",
] as const;

/** Estado de uma conta recém-criada: sem nenhum dado de exemplo. */
export const emptyState = {
  ...initial,
  transactions: [] as Transaction[],
  weights: [] as WeightEntry[],
  workouts: [] as Workout[],
  books: [] as Book[],
  studies: [] as StudyEntry[],
  chat: [] as ChatMsg[],
  goalsMacro: [] as GoalMacro[],
  goalsDaily: [] as GoalDaily[],
  completions: [] as DailyCompletion[],
  // Conta nova não tem altura: o card de IMC só aparece depois que a pessoa informa.
  profile: { ...initial.profile, name: "", height: 0 },
};

/** Estado com os dados de demonstração — usado no botão "carregar exemplo". */
export const seedState = initial;

function recomputeGoals(s: State): GoalMacro[] {
  return s.goalsMacro.map((g) => {
    if (!g.linkedModule) return g;
    let current = g.currentValue;
    if (g.linkedModule === "weight") {
      const sorted = [...s.weights].sort((a, b) => b.date.localeCompare(a.date));
      if (sorted[0]) current = sorted[0].weight;
    } else if (g.linkedModule === "books") {
      const y = new Date().getFullYear();
      current = s.books.filter((b) => b.finishedAt.startsWith(String(y))).length;
    } else if (g.linkedModule === "finance_saved") {
      const income = s.transactions.filter((t) => t.type === "entrada").reduce((a, b) => a + b.value, 0);
      const exp = s.transactions.filter((t) => t.type === "saida").reduce((a, b) => a + b.value, 0);
      current = income - exp;
    } else if (g.linkedModule === "study_hours") {
      current = +(s.studies.reduce((a, x) => a + x.duration, 0) / 60).toFixed(1);
    }
    return { ...g, currentValue: current };
  });
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      addTransaction: (t) => { set((s) => ({ transactions: [{ ...t, id: uid() }, ...s.transactions] })); get().recomputeLinkedGoals(); },
      updateTransaction: (id, p) => { set((s) => ({ transactions: s.transactions.map((x) => x.id === id ? { ...x, ...p } : x) })); get().recomputeLinkedGoals(); },
      removeTransaction: (id) => { set((s) => ({ transactions: s.transactions.filter((x) => x.id !== id) })); get().recomputeLinkedGoals(); },
      addWeight: (w) => { set((s) => ({ weights: [{ ...w, id: uid() }, ...s.weights] })); get().recomputeLinkedGoals(); },
      updateWeight: (id, p) => { set((s) => ({ weights: s.weights.map((x) => x.id === id ? { ...x, ...p } : x) })); get().recomputeLinkedGoals(); },
      removeWeight: (id) => { set((s) => ({ weights: s.weights.filter((x) => x.id !== id) })); get().recomputeLinkedGoals(); },
      addWorkout: (w) => set((s) => ({ workouts: [{ ...w, id: uid() }, ...s.workouts] })),
      updateWorkout: (id, p) => set((s) => ({ workouts: s.workouts.map((x) => x.id === id ? { ...x, ...p } : x) })),
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((x) => x.id !== id) })),
      addBook: (b) => { set((s) => ({ books: [{ ...b, id: uid() }, ...s.books] })); get().recomputeLinkedGoals(); },
      updateBook: (id, p) => { set((s) => ({ books: s.books.map((x) => x.id === id ? { ...x, ...p } : x) })); get().recomputeLinkedGoals(); },
      removeBook: (id) => { set((s) => ({ books: s.books.filter((x) => x.id !== id) })); get().recomputeLinkedGoals(); },
      addStudy: (st) => { set((s) => ({ studies: [{ ...st, id: uid() }, ...s.studies] })); get().recomputeLinkedGoals(); },
      updateStudy: (id, p) => { set((s) => ({ studies: s.studies.map((x) => x.id === id ? { ...x, ...p } : x) })); get().recomputeLinkedGoals(); },
      removeStudy: (id) => { set((s) => ({ studies: s.studies.filter((x) => x.id !== id) })); get().recomputeLinkedGoals(); },
      addGoalMacro: (g) => set((s) => ({ goalsMacro: [{ ...g, id: uid(), createdAt: todayISO() }, ...s.goalsMacro] })),
      updateGoalMacro: (id, p) => set((s) => ({ goalsMacro: s.goalsMacro.map((x) => x.id === id ? { ...x, ...p } : x) })),
      removeGoalMacro: (id) => set((s) => ({ goalsMacro: s.goalsMacro.filter((x) => x.id !== id) })),
      addGoalDaily: (g) => set((s) => ({ goalsDaily: [{ ...g, id: uid() }, ...s.goalsDaily] })),
      updateGoalDaily: (id, p) => set((s) => ({ goalsDaily: s.goalsDaily.map((x) => x.id === id ? { ...x, ...p } : x) })),
      removeGoalDaily: (id) => set((s) => ({ goalsDaily: s.goalsDaily.filter((x) => x.id !== id), completions: s.completions.filter((c) => c.actionId !== id) })),
      toggleCompletion: (actionId, date) => set((s) => {
        const exists = s.completions.find((c) => c.actionId === actionId && c.date === date);
        return { completions: exists ? s.completions.filter((c) => !(c.actionId === actionId && c.date === date)) : [...s.completions, { actionId, date }] };
      }),
      recomputeLinkedGoals: () => set((s) => ({ goalsMacro: recomputeGoals(s) })),
      pushChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
      updateLastAssistant: (content) =>
        set((s) => {
          const chat = [...s.chat];
          for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].role === "assistant") {
              chat[i] = { ...chat[i], content };
              break;
            }
          }
          return { chat };
        }),
      clearChat: () => set({ chat: [] }),
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setSettings: (sx) => set((s) => ({ settings: { ...s.settings, ...sx } })),
      exportAll: () => JSON.stringify(get(), null, 2),
      importAll: (json) => {
        try {
          const data = JSON.parse(json);
          set({ ...get(), ...data });
        } catch {}
      },
      clearAll: () => set({ ...initial }),
    }),
    { name: "altus-v2" }
  )
);