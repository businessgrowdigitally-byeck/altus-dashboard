## Plano: Refatoração ALTUS - Sistema Operacional Pessoal

### Visão geral
Renomear o app de "BGD" para **ALTUS - Become your best version**, restaurar a paleta original (deep navy + gold), e adicionar todos os módulos faltantes (Metas, Rotina Diária, FAB mobile, CRUD completo, sample data).

### 1. Branding & Design System
- Renomear "BGD" / "BGTIWW" → **ALTUS** em todos os lugares (`__root.tsx`, `AppLayout.tsx`, `configuracoes.tsx`, `chat.ts` system prompt, etc.)
- Restaurar paleta: deep navy `#0A0F1E` base, electric gold `#F5C842` primário, emerald `#2ECC71` positivo, coral `#E74C3C` negativo
- Tipografia: Space Grotesk (headings) + Inter (body) via Google Fonts no `__root.tsx`
- Glass-morphism nos cards mantido

### 2. Dashboard (página inicial)
- Header "Seu Relatório Executivo" + saudação por horário
- 4 KPIs: Saldo do Mês, Peso Atual (+delta semana), Livros 2025, Streak Estudos
- Grid 2x2 de mini-charts (Recharts): saldo 30d, peso 60d, livros/mês, horas estudo/semana
- "Atividade Recente" — últimas 5 entradas cross-módulo
- "Insights da Semana" — 3 observações auto-geradas
- Seção "🎯 Metas & Sistema Diário" com 2 tabs (ver §3)

### 3. Novo módulo Goals (Metas)
Adicionar ao store Zustand:
- `goals_macro`: nome, área, tipo, valor atual/alvo, unidade, deadline, motivação, linked_module
- `goals_daily`: nome, área, linked_goal_id, horário, dias da semana
- `daily_completions`: {date, action_id}
- Auto-link: ao adicionar peso/livro/transação, atualizar `current_value` das metas vinculadas
- Heatmap GitHub-style de consistência (3 meses)

### 4. CRUD completo em todos os módulos
Hoje só existe `add` e `remove`. Adicionar `update*` em store para: transações, pesos, treinos, livros, estudos, metas, ações diárias. Cada lista/card recebe ✏️ (modal de edição pré-preenchido) e 🗑️ (confirmação).

### 5. Páginas existentes — completar conforme spec
- **Finanças**: seletor mês/ano, donut por categoria, evolução 6m, tabela 12 meses
- **Corpo**: IMC, % progresso meta, filtros 1M/3M/6M/1A, linha tracejada da meta, treinos
- **Biblioteca**: filtros (ano/gênero/rating/search), grid de cards com cover colorido por gênero, modal detalhe, stats
- **Estudos**: timeline agrupada por dia, áreas (bar horizontal), histórico 12 semanas

### 6. Agente IA
- Atualizar system prompt: "ALTUS" no lugar de "BGTIWW"
- Adicionar metas + completions ao contexto enviado
- Manter setup card de instruções (já usa Lovable AI, sem necessidade de key)

### 7. Configurações
- Remover seção "API do Gemini" (Lovable AI já está conectado) ou converter em status de conexão
- Manter perfil, integrações, dados (export/import/clear), aparência

### 8. Mobile FAB
- Botão flutuante "+" no canto inferior direito (mobile only) → modal escolhe módulo → abre formulário rápido

### 9. Sample data
- Seed inicial: 8 transações, 6 pesos, 5 livros, 7 estudos, 4 treinos, 3 metas macro, 5 ações diárias — todos com contexto brasileiro realista

### Notas técnicas
- Stack atual mantido: TanStack Start, Zustand+persist, Recharts, date-fns, Lucide
- Versionar store: bump `version` e migration para novos campos (`goals_macro`, `goals_daily`, `daily_completions`)
- Tema dark restaurado em `src/styles.css` (oklch equivalente de #0A0F1E e #F5C842)

### Escopo / tamanho
Esta é uma refatoração grande (~15 arquivos, novo módulo Metas completo, CRUD em todas as listas, FAB, sample data). Estimativa: implementação em uma rodada, mas longa. Posso fazer tudo de uma vez ou prefere quebrar em etapas (ex: 1º branding+dashboard, 2º metas+CRUD, 3º polish+FAB+sample data)?
