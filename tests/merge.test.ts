import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeSnapshots, same } from "../src/lib/merge.ts";

const tx = (id: string, value = 10, description = id) => ({
  id,
  value,
  description,
  type: "saida",
});

describe("combinação entre aparelhos (três vias)", () => {
  it("keeps what only one side changed", () => {
    const base = { profile: { name: "A", height: 1.7 }, transactions: [tx("t1")] };
    const local = { ...base, profile: { name: "A", height: 1.8 } };
    const remote = { ...base, transactions: [tx("t2"), tx("t1")] };
    assert.deepEqual(mergeSnapshots(base, local, remote), {
      profile: { name: "A", height: 1.8 },
      transactions: [tx("t2"), tx("t1")],
    });
  });

  it("keeps items added on both devices (the bug: the last save erased the other one)", () => {
    const base = { transactions: [tx("t1")] };
    const local = { transactions: [tx("phone"), tx("t1")] };
    const remote = { transactions: [tx("laptop"), tx("t1")] };
    const merged = mergeSnapshots(base, local, remote) as { transactions: { id: string }[] };
    assert.deepEqual(merged.transactions.map((t) => t.id).sort(), ["laptop", "phone", "t1"]);
    assert.equal(merged.transactions[0].id, "phone", "new local items first, like the app inserts");
  });

  it("respects deletions on either side", () => {
    const base = { transactions: [tx("t1"), tx("t2"), tx("t3")] };
    const local = { transactions: [tx("t2"), tx("t3"), tx("new")] }; // apagou t1
    const remote = { transactions: [tx("t1"), tx("t2")] }; // apagou t3
    const merged = mergeSnapshots(base, local, remote) as { transactions: { id: string }[] };
    assert.deepEqual(merged.transactions.map((t) => t.id).sort(), ["new", "t2"]);
  });

  it("an item edited on one side survives its deletion on the other", () => {
    const base = { transactions: [tx("t1", 10)] };
    const local = { transactions: [] };
    const remote = { transactions: [tx("t1", 99)] };
    assert.deepEqual(mergeSnapshots(base, local, remote), { transactions: [tx("t1", 99)] });
  });

  it("merges the same item field by field; a real conflict keeps this device", () => {
    const base = { transactions: [tx("t1", 10, "a")] };
    const local = { transactions: [{ ...tx("t1", 20, "a") }] };
    const remote = { transactions: [{ ...tx("t1", 10, "b") }] };
    assert.deepEqual(mergeSnapshots(base, local, remote), { transactions: [tx("t1", 20, "b")] });
    const conflict = mergeSnapshots(
      base,
      { transactions: [tx("t1", 20)] },
      { transactions: [tx("t1", 30)] },
    );
    assert.deepEqual(conflict, { transactions: [tx("t1", 20, "t1")] });
  });

  it("merges nested plan data (Micro Goal checked here, stage edited there)", () => {
    const plan = {
      id: "p1",
      stages: [{ id: "s1", title: "Base" }],
      microGoals: [{ id: "m1", status: "pendente" }],
    };
    const base = { altusPlans: [plan] };
    const local = { altusPlans: [{ ...plan, microGoals: [{ id: "m1", status: "concluida" }] }] };
    const remote = { altusPlans: [{ ...plan, stages: [{ id: "s1", title: "Base revisada" }] }] };
    assert.deepEqual(mergeSnapshots(base, local, remote), {
      altusPlans: [
        {
          ...plan,
          stages: [{ id: "s1", title: "Base revisada" }],
          microGoals: [{ id: "m1", status: "concluida" }],
        },
      ],
    });
  });

  it("chat only grows: keeps the cloud and appends this device's new messages", () => {
    const m = (c: string) => ({ role: "user", content: c });
    const base = { chat: [m("1")] };
    const merged = mergeSnapshots(base, { chat: [m("1"), m("aqui")] }, { chat: [m("1"), m("lá")] });
    assert.deepEqual(merged, { chat: [m("1"), m("lá"), m("aqui")] });
  });

  it("lists without ids (completions, tags) merge as sets", () => {
    const c = (d: string) => ({ date: d, actionId: "a1" });
    const base = { completions: [c("d1")], primaryAreas: ["financas"] };
    const local = { completions: [c("d1"), c("d2")], primaryAreas: ["financas", "corpo"] };
    const remote = { completions: [c("d3")], primaryAreas: ["financas", "estudos"] };
    const merged = mergeSnapshots(base, local, remote) as {
      completions: unknown[];
      primaryAreas: string[];
    };
    assert.deepEqual(
      merged.completions,
      [c("d2"), c("d3")],
      "d1 unchecked remotely, d2 checked here",
    );
    assert.deepEqual(merged.primaryAreas.sort(), ["corpo", "estudos", "financas"]);
  });

  it("the same deterministic id created on both devices is not duplicated", () => {
    const r = tx("rec-sal-2026-11", 5000);
    const merged = mergeSnapshots(
      { transactions: [] },
      { transactions: [r] },
      { transactions: [r] },
    );
    assert.deepEqual(merged, { transactions: [r] });
  });

  it("budget objects merge key by key, including removals", () => {
    const base = { categoryBudgets: { Lazer: 100, Moradia: 1500 } };
    const local = { categoryBudgets: { Lazer: 100, Moradia: 1500, Alimentação: 800 } };
    const remote = { categoryBudgets: { Moradia: 1500 } }; // limite de Lazer removido
    assert.deepEqual(mergeSnapshots(base, local, remote), {
      categoryBudgets: { Moradia: 1500, Alimentação: 800 },
    });
  });

  it("same() ignores undefined fields and key order", () => {
    assert.ok(same({ a: 1, b: undefined }, { a: 1 }));
    assert.ok(same({ a: 1, b: 2 }, { b: 2, a: 1 }));
    assert.ok(!same([1, 2], [2, 1]));
  });
});
