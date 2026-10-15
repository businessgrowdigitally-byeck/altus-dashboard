// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// The MCP SDK probes this optional Workers binding inside a caught dynamic import.
// On Vercel, leave the probe to Node so the SDK uses its process.env fallback;
// bundling a Cloudflare-only module into a Node function fails at build time.
const isVercel = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      mcpPlugin(),
      ...(isVercel
        ? [
            {
              name: "vercel-optional-workers-import",
              enforce: "pre" as const,
              apply: "build" as const,
              resolveId(source: string) {
                if (source === "cloudflare:workers") return { id: source, external: true };
              },
            },
          ]
        : []),
    ],
  },
});
