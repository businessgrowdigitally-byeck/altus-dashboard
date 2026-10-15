import assert from "node:assert/strict";
import { test } from "node:test";
import app from "../.vercel/output/functions/__server.func/index.mjs";

// Run after NITRO_PRESET=vercel bun run build. Exercise the actual Node artifact,
// including the MCP SDK's optional, caught Cloudflare import, without real users.
test("Vercel Node artifact renders the application", async () => {
  const response = await app.fetch(new Request("http://localhost/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /ALTUS/);
});

test("Vercel Node artifact serves MCP discovery metadata", async () => {
  const response = await app.fetch(
    new Request("http://localhost/.well-known/oauth-protected-resource"),
    {},
  );
  assert.equal(response.status, 200);
  const metadata = await response.json();
  assert.equal(metadata.resource, "http://localhost/mcp");
  assert.deepEqual(metadata.authorization_servers, [
    "https://oskwtnluunvdlbjptday.supabase.co/auth/v1",
  ]);
});

test("MCP on Vercel retains authentication enforcement", async () => {
  const response = await app.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "build-smoke", version: "1" },
        },
      }),
    }),
    {},
  );
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate"), /Bearer/);
});

test("Vercel Node artifact preserves the disabled AI feature", async () => {
  const response = await app.fetch(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    {},
  );
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /não está ativo/);
});
