import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildChatHistory,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CHAT_MESSAGES,
} from "../src/lib/ai/history.ts";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };
const user = (content: string): Msg => ({ role: "user", content });
const bot = (content: string, error?: boolean): Msg =>
  error === undefined ? { role: "assistant", content } : { role: "assistant", content, error };

describe("buildChatHistory", () => {
  it("keeps a short valid conversation unchanged", () => {
    const msgs = [user("oi"), bot("olá"), user("e agora?")];
    assert.deepEqual(buildChatHistory(msgs), msgs);
  });

  it("never sends more than the endpoint limit", () => {
    const msgs: Msg[] = [];
    for (let i = 0; i < 60; i++) msgs.push(i % 2 ? bot(`r${i}`) : user(`p${i}`));
    msgs.push(user("última"));
    const out = buildChatHistory(msgs);
    assert.ok(out.length <= MAX_CHAT_MESSAGES);
    assert.equal(out[0].role, "user");
    assert.deepEqual(out.at(-1), { role: "user", content: "última" });
  });

  it("drops flagged errors, legacy error messages and empty replies", () => {
    const out = buildChatHistory([
      user("a"),
      bot("Erro: Limite de requisições excedido.", true),
      bot("Erro: Failed to fetch"),
      bot(""),
      bot("   "),
      user("b"),
    ]);
    assert.deepEqual(out, [user("a"), user("b")]);
  });

  it("does not start the window with an assistant reply", () => {
    const msgs: Msg[] = [];
    for (let i = 0; i < MAX_CHAT_MESSAGES + 1; i++) msgs.push(i % 2 ? user(`p${i}`) : bot(`r${i}`));
    const out = buildChatHistory(msgs);
    assert.equal(out[0].role, "user");
    assert.ok(out.length <= MAX_CHAT_MESSAGES);
  });

  it("truncates oversized messages to the endpoint limit", () => {
    const out = buildChatHistory([user("x".repeat(MAX_CHAT_MESSAGE_CHARS + 500))]);
    assert.equal(out[0].content.length, MAX_CHAT_MESSAGE_CHARS);
  });

  it("strips the local error flag from what is sent", () => {
    const out = buildChatHistory([user("a"), bot("ok", false)]);
    assert.deepEqual(out, [user("a"), { role: "assistant", content: "ok" }]);
  });
});
