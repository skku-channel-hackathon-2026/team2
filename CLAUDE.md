# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## 1. Context

- Event: SKKU Channel Hackathon 2026 (with Channel Corp). This is **team2**.
- Repo: https://github.com/skku-channel-hackathon-2026/team2
- Starter: official `channel-io/app-tutorial-ts`, Channel App SDK **0.17.2**.
- Stack: NestJS server on **Cloudflare Workers (Free)** + **Cloudflare D1
  (SQLite)** + **React WAM**.
- Node.js 24, pnpm 11.24.0 via Corepack. Always commit `pnpm-lock.yaml`.
- Team resources are in `TEAM.md` (app `SKKU 2026 Team2`, server
  `https://skku-team2.skku-hackathon-2026.workers.dev`, D1 `skku-team2`). All 11
  teams' apps are installed in the same channel; each team has its own
  app/server/DB.
- Judges are likely Channel engineers. The goal is a **working live demo** of a
  real pain point with **meaningful technical depth**, not a CRUD app.

The starter ships a `/tutorial` desk command that opens a React WAM which sends
a group-chat message either as the app bot (server function) or as the current
manager (WAM native function). The Korean operations guide is `HACKATHON.ko.md`.

## 2. How Channel Talk apps work

A Channel app is **my server, which Channel calls when something happens**.
Channel owns the chat UI, login, customer/manager identity, and context; the app
owns the logic. The app never polls Channel for work — AppStore pushes a signed
RPC to the app's Function Endpoint, the app answers, and Channel renders the
answer.

### 2.1 The four pieces

| Piece               | What it is                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Function**        | A typed RPC the app server implements (e.g. `waitlist.cancel`), Zod-validated in/out.       |
| **Extension**       | A named, system-versioned contract that plugs Functions into a standard Channel capability. |
| **WAM**             | The React UI opened inside the Channel client, served from the WAM Endpoint. Not a server.  |
| **Native Function** | The reverse direction — the app asking Channel to do something (e.g. send a group message). |

### 2.2 Request flow

```
User triggers (/command, widget/tab, ALF, workflow button, event hook, schedule)
  → AppStore sends a signed PUT to the Function Endpoint
      { method, params, context, systemVersion }
  → SignatureGuard verifies x-signature, SDK validates params against the input schema
  → Function runs logic (D1, external APIs, algorithms)
  → Function RESPONDS with one of:
      - text result (shown immediately)
      - an operation result
      - "open WAM <name> with wamArgs {...}"  (Channel then loads the WAM)
      - NeedsUserInput (ask follow-up questions, resume via continuationToken)
      - a structured error
  → WAM buttons call Functions (useCallFunction) or Native Functions (useNativeFunction)
```

Key rule: **opening a WAM is the Function's response**, not a separate API call.
The user initiates; the server decides whether to open a WAM and what data it
receives.

### 2.3 Functions

- **Wire envelope**: `method` (full Function name from discovery), `params`
  (untrusted caller input), `context`, `systemVersion`. The reply is either
  `result` or a structured `error`.
- **Two kinds**: _standalone_ (`tutorial.open`, `orders.sync` — app-specific
  business logic) and _extension_ (`extension.command.metadata.getCommands` —
  standard contracts only). Keep business logic standalone.
- **Context** may carry: `caller` (user | manager | system | app), `channel`,
  `user`, `userChat`, `language`, `authToken` (decrypted provider OAuth token),
  `config` (stored credentials/settings), `webhooks` (AppStore-issued callback
  URLs). **Never assume an optional field exists** — validate what the Function
  actually needs. AppStore may send `null` where you expect `undefined` (see
  `CommandActionInputSchema` in `packages/shared`).
- **Errors**: use stable, documented codes — `1` unprocessable input, `2` bad
  request, `3` not found, `4` unauthorized, `-32601` method not found, `-32603`
  internal. Never leak credentials or customer data in an error.
- **Discovery/dispatch** is the SDK's job via
  `extension.core.function.getFunctions`. Don't hand-roll routing.
- **Versioning**: a breaking change to a standalone Function means a **new
  name** (`orders.getV2`), never a bumped `systemVersion` or a new URL path.
- **Mutating actions must be idempotent** — retries and duplicate triggers
  happen.

### 2.4 Extensions

An extension = a **metadata/discovery Function** (e.g.
`extension.command.metadata.getCommands`) + the runtime Functions it references
by **exact full name**. Metadata pointing at a Function does not create it —
every referenced Function must be implemented and registered.

- `systemVersion` is the AppStore↔server platform contract version (`v1`),
  **not** the app version. Never change it for a release.
- Relative names inside an extension expand to
  `extension.{extensionName}.{relativeName}`; metadata Functions follow
  `extension.{family}.metadata.{operation}`.
- TypeScript: `@Extension` declares family + version, `@Func` declares relative
  names; register the decorated class as a NestJS provider and
  `ChannelAppModule` auto-discovers it.
- **Registration lifecycle**: the Function Endpoint must be deployed and
  reachable _before_ registration, because AppStore may call discovery
  immediately. Auto-registration waits for the server to listen, gets a cached
  app token, calls `registerExtension` per discovered extension, and retries
  transient failures with bounded exponential backoff. Re-register after any
  Function-name or schema change. `unregisterExtension` only when deliberately
  removing a capability.

Extension families:

| Family                       | Purpose                                             |
| ---------------------------- | --------------------------------------------------- |
| `command`                    | Desk/front commands returning text or opening a WAM |
| `hook`                       | Event-driven, **idempotent** handlers               |
| `polling`                    | Scheduled pollers iterating over targets            |
| `widget`                     | Contextual widgets on a surface                     |
| `customtab`                  | App-owned tab with interactive content              |
| `config`                     | Stored API keys, credentials, scoped settings       |
| `oauth`                      | Provider Authorization Code flow → `ctx.authToken`  |
| `calendar`                   | Calendars, availability, bookings                   |
| `commerce` / `wms` / `store` | Orders, buyer info, warehouse/shop metadata         |
| `dataSource`                 | Read-only catalog queries over gRPC                 |
| `messaging`                  | Inbox, prebuilt messaging, integrations             |
| `alfTask` / `notebook`       | Versioned automation tasks / notebook definitions   |
| `mailRelay`                  | Normalized mail events via webhook                  |

ALF (Channel's AI agent) can recommend/run commands, and workflows can embed
command buttons in messages. These are _ways a command runs_, not separate
extensions.

### 2.5 Command extension specifics

`extension.command.metadata.getCommands` returns the command definitions. Each
definition references an `actionFunctionName` (required) and optionally an
`autoCompleteFunctionName` for parameter suggestions.

Hard limits from the contract:

- ≤ **30** command definitions per extension.
- `name`: 1–30 chars, and it is the **stable identifier** — renaming breaks
  callers.
- `scope`: `desk` (managers) or `front` (customers).
- `description`: optional, ≤ 100 chars.
- `parameters`: ≤ 10, each typed `string` | `float` | `int` | `bool`, name 1–20
  chars, optional ≤ 10 static choices.
- `alfMode`: `disable` | `recommend` (required); optional `alfDescription` ≤
  1500 chars.

The action Function receives chat context (type + id), validated parameters,
trigger info, and the caller's language. It returns text, an operation result,
or a WAM. Autocomplete Functions must tolerate timeouts and return empty results
gracefully.

### 2.6 WAM specifics

- The client loads `${WAM_ENDPOINT}/${name}`; `appId` is public and `name` is
  the route selector. Register only the **root** in the portal — no `/v1`, no
  WAM name appended.
- Wrap the React root in `WamProvider`. The bundle is a single-page app, so it
  must survive direct URL navigation and a missing host bridge.
- Hooks: `useWamData` / `useTypedWamData` (host context: appId, channelId,
  managerId, chatId, `wamArgs`), `useCallFunction` (app Functions — server-side
  authority), `useNativeFunction` (acts **as the logged-in manager/user**; the
  host authorizes by role), `useWamSize`, `useWamClose`.
- **`wamArgs` is browser-readable.** Put only a minimal public identifier in it
  and re-check business authorization server-side. This repo instead mints an
  HMAC-signed, short-lived group-target token in `tutorial.open` and re-verifies
  it in `sendAsBot` — the WAM never picks its own send target.
- Validate every optional host field against a schema before use.
- When closing after an action, **await the call first** or the user never sees
  the error.

### 2.7 Auth, tokens, endpoints

| Value                | Meaning                                | Where it lives              |
| -------------------- | -------------------------------------- | --------------------------- |
| App ID               | Public identifier                      | Server and WAM              |
| App Secret           | Issues token pairs                     | Server secret manager       |
| Signing Key          | Verifies `x-signature`                 | Server secret manager       |
| App token            | Extension registration, app-scoped ops | Server cache                |
| Channel token        | Channel-scoped ops                     | Server cache, per channel   |
| Provider OAuth token | External service calls                 | Injected as `ctx.authToken` |

- **Inbound**: `SignatureGuard` verifies HMAC-SHA256 `x-signature` over the
  **raw body** using the hex-decoded Signing Key.
- **Outbound**: `TokenManager` issues and caches token pairs (`accessToken`,
  `refreshToken`, `expiresIn`) from the App Secret and refreshes before expiry.
  `issueToken`/`refreshToken` are rate-limited to **10 calls per 30 minutes per
  app** — never issue a token per request. Omitting `channelId` yields an app
  token; including it yields a channel token for that installed channel. Native
  Function calls send it as `x-access-token`.
- Multiple replicas must share the token cache (Redis/DB) via the SDK cache
  interface, or they burn the rate limit.
- **WAM requests**: manager/user authorization belongs to the host runtime; the
  app server's `TokenManager` does not mint it.
- Endpoints registered in the portal are **roots**: Function Endpoint
  `…/functions` (actual call is `PUT …/functions/v1`), WAM Endpoint
  `…/resource/wam` (actual UI is `…/resource/wam/{name}`).
- **Never** put App Secret, Signing Key, tokens, or provider credentials in WAM
  code, Git, logs, issues, or README. Audit the WAM bundle for leaks.
- Never set `SKIP_SIGNATURE_VERIFICATION=true` outside isolated local debugging
  (`config.ts` hard-fails on it in hosted runtimes).

## 3. Commands

pnpm 11.24.0 via Corepack, Node 24+. Prefix with `corepack ` if pnpm is not on
PATH.

```sh
pnpm install --frozen-lockfile
pnpm build           # all workspaces (shared → server/wam)
pnpm typecheck       # builds shared first, then tsc --noEmit everywhere
pnpm test            # builds shared, then node:test via tsx in server
pnpm lint            # eslint, wam only
pnpm format:check    # prettier over the repo
```

Single test file:

```sh
pnpm --filter @tutorial/shared build
pnpm --filter @tutorial/server exec tsx --test src/function-endpoint.test.ts
```

Run locally — Workers runtime is the only mode with D1. It needs a root
`.dev.vars` with **fake** values (cannot call real Channel APIs; never commit
it):

```dotenv
APP_ID=local-test-app
APP_SECRET=local-test-secret
SIGNING_KEY=1111111111111111111111111111111111111111111111111111111111111111
APP_STORE_URL=https://app-store-api.channel.io
```

```sh
pnpm build:cloudflare        # builds everything, copies wam/dist → cloudflare/static
pnpm db:migrate:local
pnpm dev:cloudflare          # wrangler dev --local
pnpm test:cloudflare         # smoke against http://127.0.0.1:8797 (SMOKE_ORIGIN to override)
```

Local runtime test in two terminals:
`pnpm exec wrangler dev --local --port 8797`, then `pnpm test:cloudflare`.

Other runners: `pnpm dev:server` (plain Nest on :3000, **no D1**),
`pnpm dev:wam` (fast UI iteration, no Desk host context), `pnpm register`
(extension registration against AppStore — organizers only).

Required before any merge to `main`:
`pnpm typecheck && pnpm test && pnpm lint && pnpm build:cloudflare`. Rebuild WAM
static files with `build:cloudflare` after UI changes. `pnpm typecheck` /
`pnpm test` fail unless `@tutorial/shared` was built first; the root scripts do
this, per-package invocations must do it themselves. Never commit `.dev.vars`,
`server/.env`, or `.wrangler/`.

## 4. Repo map and architecture

Three workspaces (`pnpm-workspace.yaml`): `server`, `wam`, `packages/*`.

| Path                               | Purpose                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `server/src/tutorial.functions.ts` | Functions and command metadata (main backend work)      |
| `server/src/app.module.ts`         | SDK module, signature guard                             |
| `server/src/function-endpoint.ts`  | Maps bare `PUT /functions` to the verified `v1` handler |
| `server/src/target-token.ts`       | Short-lived signed group target for the bot path        |
| `server/src/database.ts`           | D1 access for the current request (`getDatabase()`)     |
| `packages/shared/src/index.ts`     | Shared Zod contracts used by server AND WAM             |
| `wam/src/pages/Send/Send.tsx`      | WAM screen (React, `@channel.io/app-sdk-wam` hooks)     |
| `wam/src/hooks/`                   | Validates host data with the shared Zod contract        |
| `cloudflare/worker.mjs`            | Workers HTTP entry point                                |
| `cloudflare/migrations/`           | Versioned SQL schema migrations                         |
| `wrangler.jsonc`                   | Local run config and D1 binding                         |

Endpoints: Function Endpoint `…/functions`, WAM Endpoint `…/resource/wam` (do
not append `/v1` or a WAM name). Health checks: `/api/health`, `/api/ready`.

**`packages/shared`** is the wire contract between server and WAM: Zod schemas
for command input, `tutorial.sendAsBot` input, and the WAM args/data payloads,
plus the `TUTORIAL_FUNCTIONS` name constants. Both sides import it; changing a
payload means changing it here first. It is consumed as a built package
(`injectWorkspacePackages: true` + `syncInjectedDepsAfterScripts: [build]`), so
a stale `packages/shared/dist` produces confusing type errors.

**`server`** is NestJS. `AppModule` wires
`ChannelAppModule.forRoot(channelAppOptions)` plus a global `SignatureGuard`.
`createApplication()` in `application.ts` is the single composition root used by
all three entrypoints:

- `main.ts` — local Node server, also serves `wam/dist` at
  `/resource/wam/tutorial`
- `src/serverless.ts` — default-exported Node http handler, initialized once and
  memoized; used by both Vercel and Cloudflare
- `src/register.ts` — boots on an ephemeral port purely to trigger SDK
  auto-registration

`src/tutorial.functions.ts` holds everything Channel-facing: `CommandExtension`
publishes the `command` capability via `metadata.getCommands`, and
`TutorialFunctions` implements `tutorial.open` (returns a `wam` command result
carrying `wamArgs`) and `tutorial.sendAsBot` (channel token →
`NativeFunctionClient` proxy → `writeGroupMessage`). Adding a function = new Zod
schemas in shared, a decorated `@Func` here, and a call site in the WAM.

`src/target-token.ts` is the trust boundary for the bot path: `tutorial.open`
mints an HMAC-signed, 5-minute token binding channel/group/manager, and
`sendAsBot` re-verifies it against the caller's identity before sending. The WAM
never picks its own send target.

`src/function-endpoint.ts` rewrites bare `PUT /functions` to `/functions/v1` in
Express middleware, because command execution can call the configured Function
Endpoint without a system-version suffix. Both paths hit the same guarded SDK
handler.

`src/database.ts` exposes D1 through an `AsyncLocalStorage` context —
`getDatabase()` only works inside a request handled by the Workers entrypoint,
never at module init. It is typed against a minimal local interface so the Node
build does not depend on Workers types.

**`wam`** is React 18 + Vite. Use **Bezier** components
(`@channel.io/bezier-react/beta`, `@channel.io/app-sdk-wam-ui`) so the WAM looks
native to Channel. `useTutorialWamData` reads each host field via
`useTypedWamData` and validates the whole object with the shared schema;
`pages/Send/Send.tsx` calls the server function with `useCallFunction` and the
manager path with `useNativeFunction`. Non-group chats are explicitly refused in
the UI.

## 5. Hard constraints (the environment enforces these)

### Deployment

- **Push to `main` = deploy.** An organizer-run controller polls for new commits
  (~5 min); overlapping pushes deploy only the latest commit. Personal branches
  are not deployed — batch changes and verify locally before merging.
- CI success ≠ deploy success. Deploy SHA and logs come from organizers.
- Changing **Function schemas, extensions, or command metadata** requires asking
  organizers to refresh registration after deploy (`pnpm register` is
  organizer-only; Workers do not auto-register — `config.ts` disables
  auto-registration when `VERCEL=1` or `CLOUDFLARE_WORKER=1`). → **Finalize
  commands/extensions/schemas early and change them rarely.**
- Cloudflare Workers is the live deployment (`wrangler.jsonc`, Worker
  `skku-team2`, D1 binding `DB`). `cloudflare/worker.mjs` wraps the serverless
  handler in a `node:http` server via `cloudflare:node`, enters the D1
  `withDatabase` context per request, and answers `/api/ready` with a D1 ping.
  Vercel (`vercel.json` + `scripts/build-vercel.mjs`) emits a Build Output v3
  dir and is kept working by CI, but is not the team's deployment path.

### Database (D1 = SQLite)

- Schema changes only via **new** files in `cloudflare/migrations/`. **Never
  edit an applied migration.**
- Create: `corepack pnpm exec wrangler d1 migrations create DB <name>`
- Remote migration is applied **by organizers**. Merge code depending on a new
  schema **only after** they confirm.
- Rolling back code does not roll back schema; fix forward with a new migration.
- Call `getDatabase()` **inside** the Function handling the request, never at
  module init.
- Always `.prepare(...).bind(...)`; never concatenate user input into SQL.
- SQLite syntax only (no PostgreSQL/MySQL-specific syntax).
- Memory and local files are not persistent. **All state goes in D1.**

### Workers Free runtime

- Tight per-request CPU/time budgets and daily request/storage limits; no paid
  upgrade. Design heavy work (fan-out, bulk updates) as **small batches**
  processed across requests/schedules.
- **Excluded from the bundle** via `alias` in `wrangler.jsonc`: WebSocket, Nest
  microservices, class-validator, class-transformer. Use **Zod** for validation.
- Secrets (e.g. external API keys) can only be set by organizers.

### Channel behavior quirks

- Test in the public **`앱_개발_검증`** group. Bot `writeGroupMessage` does NOT
  support private groups.
- The tutorial WAM may close even if a bot send failed — verify the actual
  message, not the WAM closing.
- The bot target token is valid for **5 minutes**; long-open WAMs must re-run
  the command.
- Current permissions: Channel `writeGroupMessage`, Manager
  `writeGroupMessageAsManager`. Anything beyond group chat (customer chats,
  reading messages, hooks) must be confirmed with organizers.
- Command/WAM optional fields may arrive as `null` from AppStore; normalize them
  (see `CommandActionInputSchema` in `packages/shared`).

## 6. Project (to be finalized at the event)

Topic will be announced at the event. Current candidates:

1. **Incident Bridge** — `/장애` in team chat opens an incident; matching
   customer chats are linked and receive a consistent "we're aware" reply;
   `/해결` notifies all linked customers. Technical core: event-driven matching,
   incident state machine, reliable batched fan-out with idempotency (no double
   notifications). Depends on: reading customer messages (hook + permission),
   messaging customer chats, polling/scheduling.
2. **Waitlist Autofill** — on cancellation, offer the freed slot to the waitlist
   in priority order; first to accept wins; offers expire and move on. Technical
   core: race-safe slot claiming (atomic conditional UPDATE in D1), offer-expiry
   state machine, fairness rules. Works with Command + WAM + D1 (+ scheduled
   checks).

This section gets updated with the chosen design once the topic is fixed.

## 7. How to work with me

1. **Plan before coding.** For any non-trivial change, first show: D1 schema,
   Function list (names + Zod input/output), extension/command metadata, WAM
   screens, and the request flow. Wait for my OK.
2. **Flag registration-affecting changes loudly.** Command metadata, extension
   declarations, or Function schemas need an organizer refresh — say so
   explicitly.
3. **Flag migrations loudly.** New SQL file + what depends on it + remind me to
   request remote apply before merging dependent code.
4. **Correctness over features.** Handle concurrency (conditional updates,
   unique constraints), idempotency (dedupe keys for events/retries), and clear
   permission-failure messages.
5. **Verify with evidence.** Run typecheck/test/lint/build and show results.
   Don't claim something works in Desk unless it was actually tested there.
6. **Stay in scope.** No unrequested features. Prefer a rock-solid core demo
   flow.
7. **Keep shared contracts in `packages/shared`** so server and WAM stay in
   sync.
8. **Be concise.** Short explanations, clear next steps.
9. **If a platform capability is uncertain** (permissions, customer-chat
   messaging, hooks, polling), don't guess — list it as a question for the
   organizers and propose a fallback design.

## 8. Code conventions

- Prettier defaults at the repo root; `wam/.prettierrc` overrides to no
  semicolons + single quotes. `.prettierignore` exempts `server/src/config.ts`
  and `server/src/function-endpoint*.ts` — do not reformat them.
- Server is ESM + NodeNext: relative imports need the `.js` extension.
- Tests are `node:test` + `node:assert/strict` run through `tsx`, colocated as
  `src/*.test.ts`.

## 9. References

- SDK repo & docs: https://github.com/channel-io/app-sdk
  - Concepts (KO): `docs/guides/ko/concepts.md`
  - Extension guide (KO): `docs/guides/ko/extensions.md` (per-family details
    under `docs/guides/ko/extensions/`)
  - Functions: `docs/guides/ko/functions.md` · WAM: `docs/guides/ko/wam.md`
  - TS reference: `docs/reference/typescript/` (ARCHITECTURE, AUTH-AND-TOKENS,
    WAM, extensions/command)
- In this repo: `HACKATHON.ko.md`, `TEAM.md`, `docs/desk-qa.md` (team1 pilot
  record)
- Channel developer docs (EN), the source for section 2:
  - Build Your First Channel App:
    https://developers.channel.io/en/articles/Build-Your-First-Channel-App-516161ed
  - Concepts: https://developers.channel.io/en/articles/Concepts-e7c2fb6f
  - Function Registration:
    https://developers.channel.io/en/articles/Function-Registration-77250b17
  - Command Guide:
    https://developers.channel.io/en/articles/Command-Guide-b3d200dc
  - WAM Guide: https://developers.channel.io/en/articles/WAM-Guide-059680de
  - Extension Guide:
    https://developers.channel.io/en/articles/Extension-Guide-bbe1a8a9
- Channel developer docs (KO): https://developers.channel.io/ko
