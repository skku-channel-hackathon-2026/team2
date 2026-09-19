import assert from "node:assert/strict";
import test from "node:test";
import { COMMANDS } from "@tutorial/shared";
import { GetCommandsOutputSchema } from "@channel.io/app-sdk-server";

process.env.APP_ID ??= "test-app";
process.env.APP_SECRET ??= "test-secret";
process.env.SIGNING_KEY ??= "11".repeat(32);

const { CommandExtension } = await import("./commands.extension.js");

test("command metadata matches the SDK discovery schema", () => {
  const output = new CommandExtension().getCommands();
  assert.doesNotThrow(() => GetCommandsOutputSchema.parse(output));
  assert.equal(output.commands.length, COMMANDS.length);
});

test("command identifiers stay unique and within the channel limit", () => {
  const names = COMMANDS.map((command) => command.name);
  const ids = COMMANDS.map((command) => command.id);
  const actions = COMMANDS.map((command) => command.actionFunctionName);

  assert.equal(new Set(names).size, names.length, "duplicate command name");
  assert.equal(new Set(ids).size, ids.length, "duplicate command id");
  assert.equal(new Set(actions).size, actions.length, "duplicate action");
  assert.ok(COMMANDS.length <= 30, "channels allow at most 30 commands");
});

/** Re-registration needs an operator, so every declared action must resolve. */
test("every declared command has an implemented action function", async () => {
  const { CommandActions } = await import("./commands.extension.js");
  const actions = new CommandActions() as unknown as Record<
    string,
    (params: unknown) => { type: string; attributes?: Record<string, unknown> }
  >;

  for (const command of COMMANDS) {
    const handler = actions[command.id];
    assert.equal(
      typeof handler,
      "function",
      `${command.id} has no action handler`,
    );

    const result = handler.call(actions, { input: {}, trigger: null });
    assert.equal(result.type, "wam");
    assert.equal(
      (result.attributes?.wamArgs as { screen: string }).screen,
      command.screen,
    );
  }
});
