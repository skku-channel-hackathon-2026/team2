import assert from "node:assert/strict";
import test from "node:test";
import type { Context } from "@channel.io/app-sdk-server";

process.env.APP_ID ??= "test-app";
process.env.APP_SECRET ??= "test-secret";
process.env.SIGNING_KEY ??= "11";
const { TutorialFunctions } = await import("./tutorial.functions.js");

/** AppStore still routes the registered `/tutorial` here, so it must answer. */
test("tutorial.open reports the round trip as text", () => {
  const ctx = {
    channel: { id: "ch-1" },
    caller: { type: "manager", id: "mgr-1" },
  } as unknown as Context;

  const result = new TutorialFunctions().open(ctx, {
    chat: { type: "group", id: "grp-1" },
    input: {},
  });

  assert.equal(result.type, "text");
  const message = String(result.attributes?.message);
  assert.match(message, /channel: ch-1/);
  assert.match(message, /caller: manager/);
  assert.match(message, /chat: group grp-1/);
});

test("tutorial.open tolerates a missing chat", () => {
  const ctx = {
    channel: { id: "ch-1" },
    caller: { type: "user", id: "u-1" },
  } as unknown as Context;

  const result = new TutorialFunctions().open(ctx, { input: {} });
  assert.equal(result.type, "text");
  assert.match(String(result.attributes?.message), /chat: - -/);
});
