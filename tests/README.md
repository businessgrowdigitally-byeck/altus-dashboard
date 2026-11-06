# Daily focus checks

Unit tests require Node 22.18+ (Node 24 was validated), with no additional runner:

```sh
node --experimental-strip-types --test tests/daily-schedule.test.ts
```

The browser smoke test uses Playwright and Chromium supplied by the cloud development environment. Start the app in another terminal, then run:

```sh
npm run dev -- --host 0.0.0.0 --port 3000
node tests/daily-focus.browser.cjs
```

Outside this cloud environment, start Vite with the appropriate local configuration and provide Playwright in Node's module search path. `DEV_SERVER_URL` overrides the server URL; `CHROMIUM_PATH` overrides `/usr/bin/chromium`.

The browser test creates a temporary browser context, uses fake authentication and intercepts Supabase requests with an in-memory snapshot. It does not require a real account or validate live Supabase connectivity. It covers agenda geometry, legacy data, unscheduled actions, completion across views, duration and time editing, mock synchronization, preference persistence, mobile layout, weekday preview and midnight rollover. No test data is written to the real database.

## Vercel deployment build

A default local build targets Cloudflare and does not exercise Vercel's Node bundler. Reproduce the deployment target explicitly:

```sh
NITRO_PRESET=vercel bun run build
node --test tests/vercel-build.test.mjs
```

The checks import the generated Vercel Node function and verify HTML rendering, OAuth resource metadata, MCP authentication and the disabled chat endpoint. They require no real user session and do not change database records. The MCP SDK's optional Cloudflare binding stays external only for Vercel builds; its caught import failure lets the SDK use its existing Node environment behavior.

## Mentor ALTUS chat

The history window sent to `/api/chat` is unit-tested without a build:

```sh
node --experimental-strip-types --test tests/chat-history.test.ts
```

The authenticated endpoint path runs against the Vercel build with Supabase and Gemini stubbed through `fetch` (no real account, model call or database write):

```sh
NITRO_PRESET=vercel bun run build
node --test tests/chat-endpoint.test.mjs
```

Run `npx tsc --noEmit` as well: the Vite build does not type-check, so a missing import only shows up at runtime.

## Mentor ALTUS planning proposals (F1)

Proposal parsing, versioning, preview and per-message state are unit-tested:

```sh
node --experimental-strip-types --test tests/plan-proposal.test.ts
```

The browser smoke test covers the confirmation card end to end (hidden `altus-plan` block, nothing saved before confirming, save and sync, decision kept after reload, discard). With the dev server running as above:

```sh
node tests/agente-plan.browser.cjs
```

It fakes the session and intercepts Supabase and `/api/chat` in the browser; no real account, model call or database write. `SCREENSHOT_DIR` saves a screenshot of the card.

## Mentor ALTUS model (F2)

The single General Plan, mandatory Macro Goal link, ALTUS Filter decisions, the conversion of plans saved in the previous format and the Mentor context are unit-tested:

```sh
node --experimental-strip-types --test tests/altus-model.test.ts
```

`tests/agente-plan.browser.cjs` also starts from a plan in the previous format and checks that it is migrated (not duplicated) when the app saves.

## Finances (F3)

Accumulated balance vs. month result, opening balance, monthly series, budgets, search, recurring transactions (idempotent posting) and the Mentor's finance context are unit-tested:

```sh
node --experimental-strip-types --test tests/finance.test.ts
```

The browser smoke test (dev server running as above) starts in a new month with last month's history and checks that the accumulated balance does not reset, the opening balance, the localized month picker, income target and spending cap, a category budget, search, a recurring entry posted once (also after reload) and no horizontal scroll at 390 px:

```sh
node tests/financas.browser.cjs
```

## Mobile (F4)

With the dev server running as above, checks two phone sizes (390×844 and 375×667) on every screen: no horizontal scroll, no input/select/textarea under 16px (iOS zooms in on focus below that), the Mentor fits the screen with the input above the bottom navigation and no "+" button over it, edit/delete actions visible on touch screens, and the quick-add modal fits. It also checks that desktop keeps the hover-reveal for row actions:

```sh
node tests/mobile.browser.cjs
```

Chromium's mobile emulation cannot reproduce Safari's auto-zoom itself; the test checks the computed font size that triggers it.

## Planning screen (F5)

Overdue reviews, linkable Macro Goals (one plan per goal), Micro Goal progress and Filter decisions by verdict are unit-tested:

```sh
node --experimental-strip-types --test tests/planning-view.test.ts
```

With the dev server running, the browser test opens the screen from the menu and checks the single General Plan, a plan with its active stage, results and Micro Goal progress, toggling a Micro Goal, linking an old plan to a free Macro Goal, filtering and deleting Filter decisions, and that the overdue-review shortcut prefills the Mentor without sending; `tests/mobile.browser.cjs` covers the screen on phones too:

```sh
node tests/planejamento.browser.cjs
```

## Mentor replies (Markdown)

The Mentor's Markdown (bold, italics, lists, headings, separators) is rendered as React elements, never raw HTML. The parser is unit-tested with a real reply; `tests/mobile.browser.cjs` checks that no raw `**` or list markers are visible:

```sh
node --experimental-strip-types --test tests/markdown.test.ts
```

## Sync across devices (F7)

Three-way merge (last synced × this device × cloud) and the MCP's conditional write are unit-tested:

```sh
node --experimental-strip-types --test tests/merge.test.ts tests/mcp-mutate.test.ts
```

`tests/fake-supabase.cjs` is the in-memory Supabase used by all browser tests: it versions `user_data` like the real `updated_at` trigger and can simulate another device writing (`remoteWrite`) or a failed save (`failNextWrite`). With the dev server running:

```sh
node tests/sync.browser.cjs
```

## Home (reorganized)

Per-action week progress and streak are unit-tested:

```sh
node --experimental-strip-types --test tests/daily-stats.test.ts
```

With the dev server running, the browser test checks the acceptance criteria at 390×844 ("Hoje" and 3 actions above the fold, real 0% with no actions, tapping a name does not mark, the 44px checkbox marks with an undo toast, counters, chart tabs, insights, shortcuts, empty state) and the desktop layout:

```sh
node tests/home.browser.cjs
```

## Day plan

The per-day adjustment over the routine (order, durations, postponed actions not counted as missed, extras), the Mentor's dayPlan proposal and its context are unit-tested:

```sh
node --experimental-strip-types --test tests/day-plan.test.ts
```

With the dev server running, the browser test reorders and postpones by hand on the Home (with undo and "Voltar à rotina"), then confirms a Mentor dayPlan in the chat and checks the Home follows it:

```sh
node tests/day-plan.browser.cjs
```
