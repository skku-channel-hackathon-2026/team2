import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ExtensionDiscoveryService,
  NativeFunctionClient,
  TokenManager,
} from "@channel.io/app-sdk-server";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApplication } from "./application.js";
import { appId } from "./config.js";

type Handler = (request: IncomingMessage, response: ServerResponse) => void;
type Runtime = { dispatch: Handler; app: NestExpressApplication };
type RegistrationResult = {
  extension: string;
  systemVersion: string;
  success: boolean;
  errorMessage?: string;
  validationErrors?: string[];
};
type RegistrationReport =
  | { ok: true; results: RegistrationResult[] }
  | { ok: false; error: string };

let initialization: Promise<Runtime> | undefined;
let registration: Promise<RegistrationReport> | undefined;

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

/**
 * Workers never call `app.listen()`, so the SDK's auto-registration — which
 * waits on the HTTP server's "listening" event — never fires, and the command
 * metadata AppStore serves stays frozen at whatever it last pulled. Deploying
 * new code does not refresh it; only `registerExtension` does.
 *
 * The deploy pipeline applies this repo's code but not its `vars`, so a shared
 * secret cannot be placed in the production env to gate this. Instead
 * POST /api/register runs it once per isolate, using the APP_SECRET the Worker
 * already holds, and reports AppStore's raw validation errors. Remove this
 * route once the command list is registered.
 */
async function registerExtensions(
  app: NestExpressApplication,
): Promise<RegistrationResult[]> {
  const discovery = app.get(ExtensionDiscoveryService);
  const nativeClient = app.get(NativeFunctionClient);
  const { accessToken } = await app.get(TokenManager).getAppToken();
  return await Promise.all(
    discovery.getExtensions().map(async (extension) => {
      const result = await nativeClient.registerExtension(
        appId,
        extension.name,
        extension.systemVersion,
        accessToken,
      );
      return {
        extension: extension.name,
        systemVersion: extension.systemVersion,
        success: result.success,
        errorMessage: result.errorMessage,
        validationErrors: result.validationErrors,
      };
    }),
  );
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const path = request.url?.split("?")[0];
  if (request.method === "GET" && path === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }
  initialization ??= createApplication()
    .then(async (app) => {
      await app.init();
      return {
        dispatch: app.getHttpAdapter().getInstance() as Handler,
        app,
      };
    })
    .catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
  const runtime = await initialization;

  // Started and awaited inside this one request. Work left pending when a
  // request ends is frozen by the Workers runtime, so a promise kicked off by
  // some other request can never be awaited here — it just hangs. Safe to
  // start now because `initialization` has resolved: AppStore calls straight
  // back into this Worker during registration, and those requests must not
  // block on a promise that is itself waiting for them.
  if (request.method === "POST" && path === "/api/register") {
    registration ??= registerExtensions(runtime.app).then(
      (results): RegistrationReport => ({ ok: true, results }),
      (error: unknown): RegistrationReport => ({
        ok: false,
        error: error instanceof Error ? error.message : "registration failed",
      }),
    );
    const report = await registration;
    if (!report.ok) registration = undefined;
    sendJson(response, report.ok ? 200 : 500, report);
    return;
  }

  runtime.dispatch(request, response);
}
