import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mutateData } from "../src/lib/mcp/data.ts";

// Supabase simulado via fetch: a linha user_data com versão (updated_at), como no banco.
type Row = { data: Record<string, unknown>; updated_at: string };
function stubCloud(initial: Row | null, onBeforeUpdate?: (row: Row) => void) {
  let row = initial;
  let n = 0;
  let updates = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (req.method === "GET")
      return json(row ? { data: row.data, updated_at: row.updated_at } : null);
    if (req.method === "PATCH") {
      updates++;
      if (row && onBeforeUpdate) onBeforeUpdate(row);
      const expected = (url.searchParams.get("updated_at") ?? "").replace(/^eq\./, "");
      if (!row || expected !== row.updated_at) return json([]);
      row = { data: (await req.json()).data, updated_at: `v${++n}` };
      return json([{ updated_at: row.updated_at }]);
    }
    if (req.method === "POST") {
      row = { data: (await req.json()).data, updated_at: `v${++n}` };
      return json([{ updated_at: row.updated_at }], 201);
    }
    return json({});
  }) as typeof fetch;
  return { get: () => row, updates: () => updates };
}

const ctx = {
  getUserId: () => "00000000-0000-4000-8000-000000000001",
  getToken: () => "test-token",
} as unknown as Parameters<typeof mutateData>[0];

describe("MCP: gravação sem apagar outro aparelho", () => {
  it("re-reads and re-applies when another device saved in between", async () => {
    let raced = false;
    const cloud = stubCloud({ data: { transactions: [{ id: "t1" }] }, updated_at: "v0" }, (row) => {
      if (raced) return;
      raced = true; // o navegador grava antes do MCP
      row.data = {
        ...row.data,
        transactions: [{ id: "browser" }, ...(row.data.transactions as unknown[])],
      };
      row.updated_at = "v-browser";
    });
    await mutateData(
      ctx,
      (d) =>
        ({
          ...d,
          transactions: [{ id: "mcp" }, ...((d.transactions ?? []) as { id: string }[])],
        }) as never,
    );
    const ids = (cloud.get()!.data.transactions as { id: string }[]).map((t) => t.id);
    assert.deepEqual(ids, ["mcp", "browser", "t1"]);
    assert.equal(cloud.updates(), 2, "first update refused, second applied on fresh data");
  });

  it("creates the row for a new account", async () => {
    const cloud = stubCloud(null);
    await mutateData(ctx, (d) => ({ ...d, weights: [{ id: "w1" }] }) as never);
    assert.deepEqual(cloud.get()!.data, { weights: [{ id: "w1" }] });
  });

  it("gives up with a clear error after repeated conflicts", async () => {
    stubCloud({ data: {}, updated_at: "v0" }, (row) => {
      row.updated_at = `busy-${Math.random()}`;
    });
    await assert.rejects(
      mutateData(ctx, (d) => d),
      /alterados em outro aparelho/,
    );
  });
});
