import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ExtensionDiscoveryService,
  NativeFunctionClient,
  TokenManager,
} from "@channel.io/app-sdk-server";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApplication } from "./application.js";
import { appId } from "./config.js";
import { safeEqual } from "./util.js";

type Handler = (request: IncomingMessage, response: ServerResponse) => void;
type Runtime = { dispatch: Handler; app: NestExpressApplication };

let initialization: Promise<Runtime> | undefined;

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

/**
 * Workers never call `app.listen()`, so the SDK's auto-registration (which
 * waits on the server's "listening" event) never fires. This lets an operator
 * trigger `registerExtension` from the deployed Worker, which already holds
 * APP_SECRET, instead of copying that secret out of the developer portal.
 * Disabled unless REGISTER_TOKEN is set; drop the var once registration is
 * refreshed.
 */
async function registerExtensions(app: NestExpressApplication) {
  const discovery = app.get(ExtensionDiscoveryService);
  const nativeClient = app.get(NativeFunctionClient);
  const { accessToken } = await app.get(TokenManager).getAppToken();
  const extensions = discovery.getExtensions();
  return await Promise.all(
    extensions.map(async (extension) => {
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

async function handleRegister(
  request: IncomingMessage,
  response: ServerResponse,
  app: NestExpressApplication,
) {
  const expected = process.env.REGISTER_TOKEN?.trim();
  if (!expected) {
    sendJson(response, 404, { error: "registration trigger is disabled" });
    return;
  }
  const provided = new URL(
    request.url ?? "",
    "http://localhost",
  ).searchParams.get("token");
  if (!provided || !safeEqual(provided, expected)) {
    sendJson(response, 401, { error: "invalid token" });
    return;
  }
  try {
    sendJson(response, 200, { results: await registerExtensions(app) });
  } catch (error: unknown) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "registration failed",
    });
  }
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

  if (request.method === "POST" && path === "/api/register") {
    await handleRegister(request, response, runtime.app);
    return;
  }

  runtime.dispatch(request, response);
}
