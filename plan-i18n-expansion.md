# Plano Minucioso — Expansão / Internacionalização Total (PT/EN/ES)

> Análise criteriosa do estado pós-restauração `6148037` + Kaizen híbrido. Algumas telas ainda caem em PT ao trocar para EN/ES.

## 1. Diagnóstico — O que já está 100% traduzido

`LanguageSwitcher.tsx`, `I18nProvider` (`__root.tsx:149`), `dict/*` (13 arquivos + `kaizen`), `AppLayout NAV`, `AuthScreen`, `GoalsSection`, `QuickAddFab`, `index (Dashboard)`, `financas, corpo, biblioteca, estudos, configuracoes (maioria), agente (UI), KaizenTodayCard + /kaizen` — todos via `useT()` + `DICT` com PT/EN/ES e teste de troca persiste `altus-lang`.

## 2. Gaps mapeados (strings ainda em PT hardcoded)

Varredura `src/**/*.tsx` excluindo `dict/` e `ui/` encontrou **3 JSX/props ainda fora do `t()`** + **5 famílias de gaps sistêmicos** não pegos por scan de acentos:

### 2.1 Gaps pontuais (filepath:line)

| Arquivo:linha | Trecho hardcoded | Deveria ser |
|---|---|---|
| `src/components/AuthGate.tsx:31` | `<Splash label="Carregando..." />` | `t("sync.loading")` / `t("auth.loading")` |
| `src/components/AuthGate.tsx:40` | `<h1>Não consegui carregar seus dados</h1>` + botão "Tentar novamente" | `t("sync.loadErrorTitle")`, `t("action.retry")` |
| `src/routes/biblioteca.tsx:330` | `<Section title="Estatísticas de Leitura">` | `t("biblioteca.statsTitle")` (já existe `biblioteca.stats` mas não usado aqui) |
| `src/routes/configuracoes.tsx:151` | `placeholder="Cole aqui o conteúdo do arquivo .json..."` | `t("config.importPlaceholder")` |
| `src/routes/configuracoes.tsx: ~120-180` | Toasts "Perfil atualizado", "Dados exportados", mensagens de `importAll` (`store.ts:355,358,362`) retornam PT puro | Mover para `dict/configuracoes.ts` com `t()` |
| `src/components/Modal.tsx:63` | `ConfirmButton` usa `t("action.confirmDelete")` ok, mas fallback de `QuickAddFab.tsx:28` "✓ Salvo" está hardcoded | `t("common.saved")` |
| `src/routes/__root.tsx:81,86` | `meta description "ALTUS é o sistema..."` fixo PT | `t()` por idioma no `head()` (ou 3 metas estáticas por lang) |
| `src/routes/api/chat.ts:10,29,46,52` | `systemPrompt` força `Responda SEMPRE em português do Brasil` e erros PT | Condicionar prompt por `lang` vinda do `store`/`header` |

### 2.2 Gaps sistêmicos (não aparecem como JSX)

| Família | Exemplo | Impacto venda fora | Onde corrigir |
|---|---|---|---|
| **Formatação** | `brl()` (`lib/format.ts:1`) sempre `pt-BR`/`BRL`, `kg()` fixo, `fmtDate`/`fmtDateLong` sem `locale` (`format.ts:28-34`), `toLocaleDateString` sem `locale` (`GoalsSection.tsx:452`) | EN vê "R$ 8.500,00" e "25/12/2026" — quebra confiança/checkout | `lib/format.ts` → `formatCurrency(n, locale)`, `formatDate(iso, locale)`, `formatWeight` |
| **Sample data** | `store.ts:167-222` `description: "Salário"`, `notes: "Treinos consistentes"`, livros PT, metas PT | Conta demo em EN/ES mostra PT misturado | `store.ts:initial` gerar sample por `lang` ou 3 seeds (`seedPT/EN/ES`) |
| **Validação/toasts** | `store.ts:355 "Isso não é um JSON válido"`, `QuickAddFab.tsx:98` `toast.error("Preencha...")` já cobre alguns mas `GoalsSection.tsx:153` ainda PT | Erro em EN mostra PT | Mover todas strings de `store`/`components` para `dict/common.ts` |
| **NotFound/Error** | `__root.tsx:25 "Page not found" + "Go home"` já EN, mas `AuthGate` error PT | Inconsistência | Unificar via `t()` |
| **Agente IA** | `agente.tsx:104` envia `rotina_diaria` com chaves PT (`por_categoria`, `peso_historico`) | Prompt funciona mas EN perde contexto | Enviar chaves neutras + `lang` no contexto |

## 3. Plano de Expansão (3 fases, sem quebrar Kaizen)

### Fase 1 — Fechar buracos visíveis (1 commit, ~2h)

**Objetivo:** nenhum JSX/props PT ao trocar para EN/ES nas 6 rotas principais + login.

- [ ] `dict/common.ts` + `dict/configuracoes.ts` + `dict/auth.ts` — adicionar 12 chaves faltantes:
  `auth.loading`, `sync.loadErrorTitle`, `sync.loadErrorDesc`, `action.retry`, `action.tryAgain`, `biblioteca.statsTitle`, `config.importPlaceholder`, `config.profileUpdated`, `config.dataExported`, `common.savedShort`, `agente.promptLang`, `notFound.*`
- [ ] `AuthGate.tsx:31,40` — `useT()` + `t()` nos 2 `Splash`/error
- [ ] `biblioteca.tsx:330` — `t("biblioteca.statsTitle")`
- [ ] `configuracoes.tsx:151` — `placeholder={t("config.importPlaceholder")}`
- [ ] `store.ts:importAll` — retornar chaves `tKey` em vez de string PT, traduzir no caller (`configuracoes.tsx` faz `t(resultKey)`)
- [ ] `QuickAddFab.tsx:28` — `t("common.savedShort")`
- [ ] `__root.tsx:81` — `head()` ler `lang` de `useLangStore` (via `create` fora do hook) ou 3 blocos `meta` por lang (fallback PT)
- [ ] `AppLayout.tsx` — `dailyQuote()` já tem PT; adicionar `QUOTES_EN/ES` em `format.ts:42` e selecionar por `lang`

**Critério pronto:** abrir `/`, trocar para EN → Dashboard, /financas, /corpo, /biblioteca, /estudos, /kaizen, /configuracoes sem PT visível (exceto dados do usuário).

### Fase 2 — Localização real (1 commit, ~3h)

**Objetivo:** moeda, data e número mudam com o idioma — essencial para venda fora.

- [ ] `lib/format.ts` — refatorar:
  ```ts
  export const formatCurrency = (n:number, lang:Lang) => n.toLocaleString(localeOf(lang), {style:"currency", currency: currencyOf(lang)}) // BRL/USD/EUR
  export const formatDate = (iso:string, lang:Lang) => new Date(iso+"T12:00:00").toLocaleDateString(localeOf(lang))
  export const formatWeight = (n:number, lang:Lang) => lang==="en" ? `${(n*2.20462).toFixed(1)} lbs` : `${n.toFixed(1)} kg`
  ```
  + `localeOf`, `currencyOf` helpers. Trocar `brl/kg/fmtDate/fmtDateLong` em `index, financas, corpo, biblioteca` para usar `locale` do `useI18n()`.
- [ ] `store.ts` — `sampleTransactions/Books/Goals` gerar por `lang` (função `makeSample(lang)`), ou manter PT e documentar que demo é PT-only (menor esforço).
- [ ] `GoalsSection.tsx:452` — `toLocaleDateString("pt-BR" ...)` → `locale`
- [ ] `agente.tsx:29` — `systemPrompt` com `lang` do usuário: ``Responda SEMPRE em ${lang==="en"?"English":"español"...}``

### Fase 3 — Polimento comercial (opcional, 1 commit)

- [ ] Pluralização revisada: `dashboard.ts: streaOne/Many` já ok, mas `kaizen.ts` e `goals.ts` precisam `one/many` por lang (EN `1 book` vs `2 books` já tem, mas revisar `booksReadOne` etc.)
- [ ] SEO por lang: `__root.tsx` gerar `og:locale`, `hreflang` e `canonical` por `lang`
- [ ] E2E: `tests/i18n.spec.ts` — visita cada rota em PT/EN/ES e assert `t()` (evita regressão futura)

## 4. Arquivos a tocar (Fase 1+2)

`dict/common, dict/configuracoes, dict/auth, lib/format.ts, components/AuthGate.tsx, routes/biblioteca.tsx:330, routes/configuracoes.tsx:151, store.ts:importAll, components/QuickAddFab.tsx, routes/__root.tsx, format.ts QUOTES, routes/* (só troca de `brl/fmtDate` para `formatCurrency/formatDate`), agente.tsx`

Estimativa Fase1: ~12 arquivos, +80 linhas dict + 20 trocas `t()`.
Estimativa Fase2: ~8 arquivos, ~60 linhas `format.ts`.

## 5. Validação (antes de cada commit)

- `tsc --noEmit --skipLibCheck` (só `TS7016` pré-existente)
- Manual: trocar PT→EN→ES e percorrer login → Dashboard (Hoje+Kaizen) → /kaizen histórico → /financas modal → /corpo gráfico → /biblioteca stats → /configuracoes import → checar moeda/data/hora
- `git diff --stat` deve mostrar só strings, sem lógica de Kaizen quebrada

Pronto para executar Fase 1 quando autorizar — sem código neste plano.
