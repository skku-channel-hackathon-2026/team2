import "reflect-metadata";
import { TokenManager } from "@channel.io/app-sdk-server";
import type { AutoRegisterResult } from "@channel.io/app-sdk-server";
import { channelAppOptions } from "./config.js";
import { createApplication } from "./application.js";

// The SDK starts registration after listening. AppStore callbacks use the deployed URL.
channelAppOptions.autoRegister = true;
let finish!: (results: AutoRegisterResult[]) => void;
const registered = new Promise<AutoRegisterResult[]>((resolve) => {
  finish = resolve;
});
channelAppOptions.onAutoRegister = finish;

function report(results: AutoRegisterResult[]): boolean {
  if (results.length === 0) {
    console.error("No extensions were discovered, so nothing was registered.");
    return false;
  }
  for (const result of results) {
    const target = `${result.extensionName} (${result.systemVersion})`;
    if (result.success) console.log(`OK   ${target}`);
    else console.error(`FAIL ${target}: ${result.error ?? "unknown error"}`);
  }
  return results.every((result) => result.success);
}
const app = await createApplication();
let timeout: ReturnType<typeof setTimeout> | undefined;
try {
  await app.listen(0, "127.0.0.1");
  const results = await Promise.race([
    registered,
    new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Registration timed out after 90 seconds")),
        90_000,
      );
    }),
  ]);
  if (!report(results))
    throw new Error(
      "Extension registration failed; check deployment and credentials",
    );
} finally {
  clearTimeout(timeout);
  app.get(TokenManager).destroy();
  await app.close();
}
