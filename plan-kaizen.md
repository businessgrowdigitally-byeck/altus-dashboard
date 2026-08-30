# Plano de Implementação — Kaizen Diário

> Aba de reflexão diária com 2 perguntas + notas livres. Só planejamento, sem código.

## 1. Objetivo
Criar a sessão **Kaizen Diário** (`/kaizen`) onde o usuário registra todo dia:
1. **“O que melhorei 1% hoje?”**
2. **“O que posso melhorar 1% amanhã?”**
3. **Anotações livres** sobre o dia

Requisitos do usuário: sessão/aba própria, acesso rápido, persistência local + nuvem, histórico navegável.

---

## 2. Decisão de Arquitetura

| Decisão | Escolha | Por quê |
|---|---|---|
| Rota | Nova rota `src/routes/kaizen.tsx` (`/kaizen`) | Evita sobrecarregar `index.tsx` (Dashboard já tem hero + KPIs + 4 charts + atividade + insights + GoalsSection). Segue padrão de `estudos.tsx`, `biblioteca.tsx`, `financas.tsx`. |
| Nav | Item em `AppLayout.tsx:13-21` entre `Estudos` e `Configurações` | Visível desktop + mobile drawer, emoji `🌱`, ícone `lucide: Sparkles` (eco “1%” de `index.tsx:398`). |
| Persistência | Zustand `persist` (`store.ts:271` `altus-v2`) + `SYNC_KEYS` → `user_data.data` JSON (`sync.ts:52`) | Mesmo mecanismo de `studies`, `transactions`, `completions`. Sem migração Supabase. |
| Granularidade | 1 registro por `date` (upsert por data) | Simplifica streak, evita duplicatas. Histórico = timeline por data. |
| Auto-gerado | `routeTree.gen.ts` não é editado manualmente | TanStack Router regenera ao criar `kaizen.tsx`. |

**Arquitetura híbrida adotada (sugestão do usuário):** embed leve no Dashboard + rota completa. Motivo: o usuário já marca hábitos no bloco “Hoje — Suas ações prioritárias para cumprir hoje” (`index.tsx:409-464` checklist com toggle). Colocar o Kaizen do dia **imediatamente abaixo** desse bloco cria fluxo natural “fiz → refleti → planejei”, sem exigir troca de aba para o ritual diário obrigatório. A rota `/kaizen` continua existindo para histórico, busca, edição de dias passados e KPIs.

---

## 3. Modelo de Dados

### 3.1 Tipo novo em `src/lib/store.ts` (~linha 88 após `GoalDaily`)

```ts
export type KaizenEntry = {
  id: string;
  date: string;            // YYYY-MM-DD local — usar toISODate/todayISO (format.ts:13-19)
  improvedToday: string;   // resposta 1
  improveTomorrow: string; // resposta 2
  notes: string;           // livre
  createdAt: string;       // ISO timestamp
  updatedAt: string;
};
```

### 3.2 State

```ts
// em type State (~linha 99-145):
kaizen: KaizenEntry[];

// ações:
addKaizen: (k: Omit<KaizenEntry,"id"|"createdAt"|"updatedAt">) => void;
updateKaizen: (id: string, patch: Partial<Omit<KaizenEntry,"id">>) => void;
removeKaizen: (id: string) => void;
upsertKaizenByDate: (date: string, data: Pick<KaizenEntry,"improvedToday"|"improveTomorrow"|"notes">) => void;
```

`upsertKaizenByDate` é o usado pelo form (se já existe `date`, faz update; senão add). Evita 2 cliques criarem 2 linhas do mesmo dia.

### 3.3 Store — detalhes

- `SYNC_KEYS:31-33` adicionar `"kaizen"`.
- `initial.kaizen: []` + `emptyState.kaizen: []` (mesmo que `studies:[]`).
- `seedState` pode ganhar 2 exemplos (opcional) para demo.
- `version` permanece `2` (não precisa bump — `persist` faz merge; se quiser, bump para `3`).
- Implementação segue `addStudy`/`updateStudy` (`store.ts:287-289`): `id = uid()`, `createdAt/updatedAt = new Date().toISOString()`.

### 3.4 Datas

Sempre `format.ts:todayISO()` / `toISODate()` — nunca `toISOString().slice(0,10)` (bug UTC-3 explicado em `format.ts:9-11`).

---

## 4. Arquivos a Alterar/Criar

### 4.1 `src/lib/store.ts` — editar
- Adicionar `KaizenEntry` type.
- Estender `State` com `kaizen` + 4 ações.
- Atualizar `SYNC_KEYS`, `initial`, `emptyState`.
- Implementar `upsertKaizenByDate`.

### 4.2 `src/routes/kaizen.tsx` — criar (novo)
Estrutura espelhando `estudos.tsx:21-68` e `corpo.tsx`:

```
export const Route = createFileRoute("/kaizen")({ component: Kaizen })

function Kaizen() {
  const { kaizen, upsertKaizenByDate, removeKaizen } = useStore()
  // form state: date (todayISO default), improvedToday, improveTomorrow, notes
  // streak = useMemo igual estudos.tsx:30-39 (Set de kaizen.map(k=>k.date))
  // grouped = useMemo Map<date, KaizenEntry> para histórico
  // KPIs: streak | total no mês | taxa preenchimento
  // save: valida >=1 campo não vazio, chama upsertKaizenByDate(date, {...})
}
```

UI com `PageHeader`, `GlassCard`, `KpiCard` (`components/primitives.tsx`), `Modal` para editar, `toast` (`sonner`) para feedback, `lucide: Pencil, Trash2`.

**Layout proposto (v1 enxuta):**
- Header: `PageHeader title="Kaizen Diário" subtitle="1% melhor todo dia — 🌱"`
- KPIs: `Streak Kaizen` | `Dias este mês` | `Taxa de preenchimento`
- Card form do dia selecionado: date picker (input type=date) + 2 textarea + textarea notas + botão Salvar (btnGold)
- Histórico: lista agrupada por data (mais recente primeiro), paginação 20, busca textual em notes, botão editar/deletar por item.

**Validação:**
- Pelo menos 1 dos 3 campos com `trim().length > 0`; caso contrário `toast.error("Preencha ao menos um campo.")`.
- `date` sempre `YYYY-MM-DD`; não permitir futuro distante (opcional: `max=todayISO()`).

### 4.3 `src/components/AppLayout.tsx` — editar
- Import `Sparkles` de `lucide-react` (já usado `Home, Wallet...` linha 3).
- Adicionar ao `NAV:13`:
  ```ts
  { to: "/kaizen", label: "Kaizen Diário", icon: Sparkles, emoji: "🌱" },
  ```
  Posição: após `Estudos` (linha 18) e antes de `Agente IA`/`Configurações`. Mantém ordem lógica de pilares.

### 4.4 `src/components/KaizenTodayCard.tsx` — criar (novo, reutilizável)
Componente compartilhado usado **no Dashboard e na rota /kaizen** para não duplicar lógica. Props: `embedded?: boolean`.

- Lê/escreve `kaizen` do store, resolve `entryToday = kaizen.find(k=>k.date===todayISO())`.
- Form: 2 `textarea` (O que melhorei 1% hoje? / O que posso melhorar 1% amanhã?) + `textarea` notas + botão `Salvar` (`btnGold` de `Modal.tsx`). Validação: ≥1 campo não vazio → `upsertKaizenByDate(today, {...})` + `toast.success`.
- Estado local com `useState` + `useEffect` sync quando `entryToday` muda (ex.: veio da nuvem).
- Se `embedded` (Dashboard): título compacto `🌱 Kaizen de Hoje — 1% melhor` + badge streak + link “Ver histórico → /kaizen” no canto. Sem date picker, sem lista — só o dia corrente.
- Se não embedded (rota): date picker opcional + mesmos campos.

Estilo: `glass-strong rounded-2xl p-6 border border-purple-500/20` idêntico ao bloco “Hoje” para continuidade visual.

### 4.5 `src/routes/index.tsx` — editar (obrigatório nesta versão híbrida)
- Importar `KaizenTodayCard`.
- Inserir **imediatamente após** o bloco `Hoje` (`index.tsx:464` fecha `</div>` do checklist) e **antes** de `Relatório Executivo` (`index.tsx:466`):
  ```tsx
  {/* Seção Hoje ... */}  {/* linha 409-464 */}
  <KaizenTodayCard embedded />
  {/* Relatório Executivo */}
  ```
- Fluxo resultante: usuário marca hábitos (check) → rola 1 card e já reflete “melhorei / melhorar” + notas, sem sair do Dashboard. Mantém ritual diário de 30s visível todo dia.
- Sem prop drilling: card consome store direto.

### 4.6 `src/routes/kaizen.tsx` — criar (completo)
Reutiliza `KaizenTodayCard` no topo + KPIs + histórico:
- Importa `KaizenTodayCard` sem `embedded` (ou com date picker) + `PageHeader`.
- KPIs e histórico como já descrito em 4.2 (mantidos).

### 4.7 `src/lib/format.ts` — sem alteração

### 4.8 `routeTree.gen.ts` — auto-gerado (não editar)

### 4.9 `supabase/` — sem alteração (JSON em `user_data` já cobre)

---

## 5. Análise da dica — Kaizen no Dashboard abaixo do “Hoje”

Sua intuição está correta. **Híbrido é superior a só-aba ou só-dashboard:**

| Opção | Prós | Contras |
|---|---|---|
| Só rota `/kaizen` (plano anterior) | Histórico limpo, Dashboard leve | Ritual diário escondido — usuário precisa lembrar de navegar |
| Só no Dashboard | Ritual sempre visível | Poluiria Dashboard com histórico/paginação; perde profundidade |
| **Híbrido (adotado)** | Ritual diário obrigatório sempre visível abaixo do checklist “Hoje” (1 scroll), sem fricção; rota preserva histórico. Fluxo “marquei hábitos → já reflito o que melhorei / o que melhorar” é psicologicamente contínuo. | Dashboard cresce +1 card (~120px). Custo irrelevante (mesmo `GlassCard`). |

**Por que abaixo do “Hoje” funciona melhor que com checkbox:**
Kaizen não é checkbox — são 3 `textarea`. Colocar abaixo do “Hoje” (`index.tsx:464`) mantém a metáfora: primeiro **ação** (tiques), depois **reflexão** (texto). O usuário não precisa decidir “vou ao Kaizen?” — o campo já está lá. O item de nav `🌱 Kaizen Diário` continua entre `Estudos` e `Configurações` para quando quiser rever semana/mês.

**Detalhe UX:** no Dashboard, sem date picker — só `todayISO()`. Na rota `/kaizen`, date picker libera backfill (corrige limitação “só marca hoje” que causou a dor do streak zerado).

**v1 (este plano híbrido):**
- Dashboard: `KaizenTodayCard embedded` logo após “Hoje” + link “Ver histórico →”
- Rota `/kaizen`: card completo (com date picker) + KPIs (streak, dias no mês, taxa) + histórico com busca
- Streak Kaizen (`estudos.tsx:78-87` adaptado para `kaizen.map(k=>k.date)`)
- Toast + persistência + sync

**v2 (backlog):**
- Humor 1-5 / tags `#foco`
- Integrar com Heatmap (opcional: Kaizen contar para `consistencyRate` se quiser)
- Agente IA consumir Kaizen como contexto (`agente.tsx:28-66`)
- Exportar Kaizen em `configuracoes.tsx:exportAll`

---

## 6. Ordem de Implementação (híbrida)

1. **store.ts** — tipo + state + `SYNC_KEYS` + `upsertKaizenByDate` (verifica `bun run build`)
2. **components/KaizenTodayCard.tsx** — componente reutilizável (form + streak badge) isolado para reuso
3. **routes/kaizen.tsx** — rota completa reutilizando `KaizenTodayCard` + KPIs + histórico (testar `/kaizen` direto antes do NAV)
4. **AppLayout.tsx** — adicionar `🌱 Kaizen Diário` no `NAV` entre `Estudos` e `Configurações` (testar drawer mobile)
5. **routes/index.tsx** — importar e inserir `<KaizenTodayCard embedded />` após bloco `Hoje` (`index.tsx:464`) — teste visual de fluxo check → reflexão
6. Verificação: `bun run build`, `bun run lint`, teste manual: (a) no Dashboard preencher Kaizen hoje → ir em `/kaizen` deve aparecer; (b) em `/kaizen` editar data ontem (backfill) → Dashboard não afeta; (c) reload persiste; (d) streak = dias consecutivos com Kaizen

---

## 7. Testes / Verificação

- Manual: criar Kaizen hoje → recarregar → deve persistir (localStorage `altus-v2`). Criar Kaizen com data ontem (backfill) → streak deve virar 2 se hoje e ontem preenchidos. Deletar deve remover e ajustar streak.
- Multi-aba: `sync.ts:109` subscribe deve propagar via Supabase após 1,2s debounce — conferir `SyncBadge` (`AppLayout.tsx:25`).
- Build: `bun run build` sem erros TS.

---

## 8. Riscos

- Duplicata por data: mitigado por `upsertKaizenByDate` (find por `date` antes de inserir).
- Data inválida / futuro: validar `date` com regex `^\d{4}-\d{2}-\d{2}$` e `new Date(date).toString() !== "Invalid Date"`.
- Store version bump desnecessário — manter `2` para não forçar migration.

---

## 9. Commit Sugerido

```
feat: adiciona Kaizen Diário híbrido (reflexão 1% ao dia)

- store: KaizenEntry + kaizen[] + upsertKaizenByDate, SYNC_KEYS
- components/KaizenTodayCard: card reutilizável (2 perguntas + notas)
- routes/kaizen: rota /kaizen (KPIs, histórico, backfill)
- routes/index: KaizenTodayCard embedded abaixo do bloco Hoje
- AppLayout: item 🌱 Kaizen Diário no NAV
```

---

## 10. Estimativa

1 rodada, ~5 arquivos tocados (`store.ts`, `KaizenTodayCard.tsx`, `kaizen.tsx`, `index.tsx`, `AppLayout.tsx`), ~350 linhas novas. Sem alteração de infra ou Supabase.

Pronto para executar quando autorizar — sem aplicação neste plano.
