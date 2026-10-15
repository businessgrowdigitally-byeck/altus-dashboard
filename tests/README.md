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
