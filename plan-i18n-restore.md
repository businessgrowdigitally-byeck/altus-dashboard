# Plano de Restauração — i18n Complexo (venda internacional)

> Restaurar o dict completo revertido em `7d3eb95` (original `be1e457`) já adaptado ao Kaizen híbrido (`958ec91`). Só planejamento, sem código. Mesmo processo de antes: analisar tudo antes de commit.

## 1. Objetivo
Devolver tradução total do app — do **login (`AuthScreen.tsx`) até dentro** (`Dashboard, Finanças, Corpo, Biblioteca, Estudos, Kaizen, Agente, Configurações, GoalsSection, QuickAddFab, Modal, TermsGate` futuro) — em **PT / EN / ES**, com controle de glossário para venda fora. Sem widget Google.

## 2. Estado Atual vs. O que falta

| Estado hoje (`b1f1ece`) | O que foi revertido |
|---|---|
| Kaizen híbrido ok (`store.ts:KaizenEntry`, `KaizenTodayCard.tsx` embedded `index.tsx:464`, rota `/kaizen`, NAV `🌱`) | `LanguageSwitcher.tsx`, `lib/i18n/dict/*` (12 arquivos), `I18nProvider` em `__root.tsx`, `t()` em 13 arquivos |
| `src/lib/i18n/index.tsx` e `dict/common.ts` ainda existem (esqueleto) mas `dict/index.ts` agregador e os 12 dicts sumiram | `AppLayout.tsx` sem seletor, `__root.tsx` sem provider, rotas todas em PT hardcoded |

`be1e457` tocou 28 arquivos: `AppLayout, AuthScreen, GoalsSection, Modal, QuickAddFab, TermsGate, agente/biblioteca/configuracoes/corpo/estudos/financas/index, __root, routeTree.gen`. Agora são 30 com `kaizen` + `KaizenTodayCard`.

## 3. Decisão de Restauração

Não fazer `git revert 7d3eb95` direto — conflitaria com Kaizen novo. Estratégia: **reaplicar `be1e457` manualmente** (cherry-pick lógico) já com Kaizen:

- Recriar `src/lib/i18n/dict/index.ts` agregador + 12 dicts originais (`agente, auth, biblioteca, configuracoes, corpo, dashboard, estudos, financas, goals, quickAdd, terms`) com mesmo shape `Record<DictKey, Record<Lang,string>>`.
- **Novo** `src/lib/i18n/dict/kaizen.ts` (3 chaves do Kaizen: títulos, perguntas, placeholders, KPIs, histórico) — PT/EN/ES.
- Recriar `src/components/LanguageSwitcher.tsx` (43 linhas, bandeiras 🇧🇷/🇺🇸/🇪🇸, `useLangStore`).
- Reutilizar `src/lib/i18n/index.tsx` já existente (LANGS, `translate`, `useI18n`, `useT`, `I18nProvider` com `skipHydration` e `document.documentElement.lang`).

Vantagem: reaproveita `be1e457` já validado (`tsc/vite build` passou), só adiciona Kaizen.

## 4. Arquivos a Criar/Editar

### 4.1 Criar
- `src/lib/i18n/dict/index.ts` — reexporta todos dicts + type `DictKey`
- `src/lib/i18n/dict/{agente,auth,biblioteca,configuracoes,corpo,dashboard,estudos,financas,goals,quickAdd,terms}.ts` — conteúdo idêntico ao `be1e457` (não precisa re-traduir, só restaurar)
- `src/lib/i18n/dict/kaizen.ts` — novo, ex.:
  ```ts
  export const kaizen: Record<string, Record<Lang,string>> = {
    "kaizen.title": { pt:"Kaizen Diário", en:"Daily Kaizen", es:"Kaizen Diario" },
    "kaizen.subtitle": { pt:"1% melhor todo dia — 🌱", en:"1% better every day — 🌱", es:"1% mejor cada día — 🌱" },
    "kaizen.q1": { pt:"O que melhorei 1% hoje?", en:"What did I improve 1% today?", es:"¿Qué mejoré 1% hoy?" },
    // ... q2, notes, placeholders, kpis, history, toasts
  }
  ```
- `src/components/LanguageSwitcher.tsx` — idem `be1e457:43` (select com `LANGS`, `useLangStore`)

### 4.2 Editar
- `src/routes/__root.tsx:1,126-146` — importar `I18nProvider` e envolver `AuthProvider/AuthGate`:
  ```tsx
  <I18nProvider><AuthProvider>...<AppLayout><Outlet/></AppLayout>...</AuthProvider></I18nProvider>
  ```
  Mantém `theme` effect já existente.

- `src/components/AppLayout.tsx:1,13-21,119-139,142-160` — importar `LanguageSwitcher` + `useT`, traduzir `NAV` labels (`nav.dashboard` etc.), badges `SyncBadge` ("salvo na nuvem"/"saving..."), quote e logout. Mesmo diff de `be1e457`.

- `src/components/AuthScreen.tsx` — trocar strings hardcoded por `t("auth.*")` (título, subtítulo, Google, termos).

- `src/components/GoalsSection.tsx`, `QuickAddFab.tsx`, `Modal.tsx`, `src/routes/{index,financas,corpo,biblioteca,estudos,configuracoes,agente}.tsx` — reaplicar `useT` + `t("*.key")` do `be1e457`. Não mexem em lógica de Kaizen, só strings.

- `src/components/KaizenTodayCard.tsx` — novo, mas já traduzir na criação: importar `useT`, trocar "Kaizen de Hoje — 1% melhor", perguntas, placeholders, botão "Salvar Kaizen de hoje", badge "✓ preenchido hoje", link "Ver histórico →".

- `src/routes/kaizen.tsx` — idem: `PageHeader` title/subtitle, KPIs ("Streak Kaizen", "Dias este mês", "Taxa 30 dias"), placeholder busca, histórico labels, modal editar.

- `src/lib/format.ts` — **opcional** mas recomendado para venda: `brl` → `formatCurrency(value, locale)` usando `Intl.NumberFormat` com `locale` do `useI18n` (R$ vs $ vs €). Não bloqueia v1.

- `routeTree.gen.ts` — auto-gerado (ignorar).

### 4.3 Não tocar
- `src/lib/store.ts` (Kaizen já ok), `sync.ts`, `supabase/`, `plan-kaizen.md`

## 5. Ordem de Implementação (sem commit até análise)

1. **dicts** — recriar `dict/index.ts` + 12 dicts + `kaizen.ts` (sem uso ainda, `tsc` deve passar)
2. **LanguageSwitcher + I18nProvider** — criar componente e plugar em `__root.tsx`
3. **AppLayout + AuthScreen** — traduzir navegação/login (primeiro contato do usuário fora)
4. **Rotas principais** — `index, financas, corpo, biblioteca, estudos, configuracoes, agente, GoalsSection, QuickAddFab, Modal` (reaplicar diff `be1e457` — pode ser em lote)
5. **Kaizen** — traduzir `KaizenTodayCard` + `kaizen.tsx` (já com `useT`)
6. Verificação: `tsc --noEmit --skipLibCheck` (zero erro novo, só `TS7016` pré-existente), trocar PT→EN→ES e checar login, Dashboard (Hoje + Kaizen embedded), /kaizen, /estudos, /financas

## 6. Testes / Verificação (antes do commit)

- Trocar idioma no `LanguageSwitcher` (sidebar e mobile) → `localStorage altus-lang` persiste, `document.documentElement.lang` muda, reload mantém idioma.
- Login em EN/ES → `AuthScreen` traduzido.
- Dashboard PT/EN/ES → "Hoje", Kaizen "O que melhorei 1% hoje?" traduzido e ainda salva em `kaizen` (store não muda por idioma).
- /kaizen histórico e modal editar traduzidos.
- `bun run build` (quando policy liberar) sem erros.

## 7. Riscos

- Conflito `AppLayout.tsx` / `index.tsx` já mexidos pelo Kaizen — resolver mantendo embed `KaizenTodayCard` + `t()` (não sobrescrever).
- `routeTree.gen.ts` será sobrescrito — não commitar manualmente.
- Glossário: "Kaizen", "Streak" manter original em EN/ES ou traduzir — definir no `kaizen.ts`.

## 8. Estimativa

1 rodada, ~30 arquivos (12 dicts + 1 kaizen dict + LanguageSwitcher + 14 telas/components), ~3500 linhas reaplicadas + ~80 linhas Kaizen i18n. Mesmo tamanho do `be1e457` original, já validado.

## 9. Commit Sugerido (após sua análise)

```
feat: restaura i18n completo PT/EN/ES ja com Kaizen

- lib/i18n/dict: agregador + 12 dicts + kaizen
- components/LanguageSwitcher + I18nProvider em __root
- AppLayout, AuthScreen, GoalsSection, QuickAddFab, Modal e rotas traduzidas
- KaizenTodayCard e /kaizen com t()
```

Pronto para executar quando autorizar — sem commit neste plano.
