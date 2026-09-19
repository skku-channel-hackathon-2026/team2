import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT_ENV = resolve(REPO_ROOT, '.env')
const DEV_VARS = resolve(REPO_ROOT, '.dev.vars')

type HashEncoding = 'hex' | 'raw'

/** Read on every request so editing .env does not need a dev-server restart. */
function readEnvFile(path: string): Record<string, string> {
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return {}
  }

  const values: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    values[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return values
}

function readRootEnv(): Record<string, string> {
  return readEnvFile(ROOT_ENV)
}

/**
 * The channel's User Data Encryption secret must never reach the browser, so
 * the hash is derived here and only the per-persona digest is sent over.
 * The docs hex-decode the secret before use; `raw` is kept as an escape hatch
 * for channels whose secret is issued as an opaque string.
 */
function memberHash(
  memberId: string,
  secret: string,
  encoding: HashEncoding
): string {
  const key =
    encoding === 'hex' &&
    /^[0-9a-fA-F]+$/.test(secret) &&
    secret.length % 2 === 0
      ? Buffer.from(secret, 'hex')
      : Buffer.from(secret, 'utf8')
  return createHmac('sha256', key).update(memberId).digest('hex')
}

function json(
  response: Parameters<Connect.NextHandleFunction>[1],
  status: number,
  body: unknown
) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(body))
}

/**
 * Demo sign-in, not authentication: anyone who reaches this endpoint can mint a
 * hash for any student number. It is deliberately confined to dev (`apply:
 * "serve"`) and to the `skku-` member namespace so it cannot impersonate a
 * member id issued anywhere else.
 */
const NAME = /^.{1,20}$/
const STUDENT_ID = /^[0-9]{4,12}$/

function identityEndpoint(): Plugin {
  return {
    name: 'hubaego-demo-identity',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/demo-api/identity', (request, response) => {
        const url = new URL(request.url ?? '', 'http://localhost')
        const name = (url.searchParams.get('name') ?? '').trim()
        const studentId = (url.searchParams.get('studentId') ?? '').trim()

        if (!NAME.test(name)) {
          return json(response, 400, { error: '이름을 입력해 주세요.' })
        }
        if (!STUDENT_ID.test(studentId)) {
          return json(response, 400, {
            error: '학번은 숫자 4~12자리로 입력해 주세요.',
          })
        }

        const env = readRootEnv()
        const pluginKey = env.CHANNEL_TALK_PLUGIN_KEY
        if (!pluginKey) {
          return json(response, 500, {
            error: 'CHANNEL_TALK_PLUGIN_KEY 가 루트 .env 에 없어요.',
          })
        }

        const secret = env.CHANNEL_TALK_ACCESS_SECRET
        const encoding: HashEncoding =
          url.searchParams.get('encoding') === 'raw' ||
          env.CHANNEL_TALK_ACCESS_SECRET_ENCODING === 'raw'
            ? 'raw'
            : 'hex'

        // Stable per student number, so signing back in resumes the same chats.
        const memberId = `skku-${studentId}`

        json(response, 200, {
          pluginKey,
          memberId,
          memberHash: secret ? memberHash(memberId, secret, encoding) : null,
          hashEncoding: secret ? encoding : null,
          name,
          studentId,
          profile: { name, 학번: studentId },
        })
      })
    },
  }
}

/**
 * The demo page speaks to the app server the way AppStore does: a signed
 * `PUT /functions/v1`. The signing key never reaches the browser, so the
 * forwarding and the HMAC happen here, exactly as scripts/manual-test.mjs
 * does it for the CLI scenarios.
 *
 * Holding the signing key means being able to name any caller, so this is
 * pinned to a loopback server — the same guard manual-test.mjs uses. Against a
 * hosted deployment the real key is unknown to this repo and the proxy refuses
 * to run at all.
 */
const SERVER_ORIGIN = process.env.DEMO_SERVER_ORIGIN ?? 'http://127.0.0.1:8797'
const CHANNEL_ID = process.env.DEMO_CHANNEL_ID ?? 'test-channel'

function readSigningKey(): Buffer | null {
  const value = readEnvFile(DEV_VARS).SIGNING_KEY
  if (!value) return null
  return Buffer.from(value, 'hex')
}

interface Persona {
  role: 'junior' | 'senior'
  name: string
  studentId: string
}

/** Both roles of one persona resolve to the same student number, so a junior
 *  who upgrades keeps their history under one account. */
function contextFor(persona: Persona): Record<string, unknown> {
  const channel = { id: CHANNEL_ID }
  if (persona.role === 'senior') {
    return {
      caller: { type: 'manager', id: `skku-m-${persona.studentId}` },
      channel,
      language: 'ko',
    }
  }
  const id = `skku-${persona.studentId}`
  return {
    caller: { type: 'user', id },
    channel,
    user: {
      id,
      channelId: CHANNEL_ID,
      memberId: id,
      member: true,
      profile: { name: persona.name },
    },
    userChat: { id: `demo-chat-${persona.studentId}` },
    language: 'ko',
  }
}

function readBody(request: Parameters<Connect.NextHandleFunction>[0]) {
  return new Promise<string>((done, fail) => {
    let text = ''
    request.on('data', (chunk) => {
      text += chunk
    })
    request.on('end', () => done(text))
    request.on('error', fail)
  })
}

const PERSONA_ROLES = new Set(['junior', 'senior'])

function parseCall(
  text: string
): { method: string; params: unknown; persona: Persona } | string {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(text) as Record<string, unknown>
  } catch {
    return '요청 본문이 JSON이 아니에요.'
  }

  const method = payload.method
  const persona = payload.persona as Partial<Persona> | undefined
  if (typeof method !== 'string' || !method) return 'method 가 필요해요.'
  if (
    !persona ||
    !PERSONA_ROLES.has(String(persona.role)) ||
    !STUDENT_ID.test(String(persona.studentId ?? '')) ||
    !NAME.test(String(persona.name ?? ''))
  ) {
    return 'persona(role·name·studentId) 가 올바르지 않아요.'
  }

  return {
    method,
    params: payload.params ?? {},
    persona: persona as Persona,
  }
}

function functionProxy(): Plugin {
  return {
    name: 'hubaego-demo-functions',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/demo-api/fn', (request, response) => {
        void (async () => {
          if (request.method !== 'POST') {
            return json(response, 405, { error: 'POST 만 지원해요.' })
          }
          if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(SERVER_ORIGIN)) {
            return json(response, 500, {
              error:
                '이 프록시는 로컬 서버에만 붙어요. DEMO_SERVER_ORIGIN 을 확인해 주세요.',
            })
          }

          const signingKey = readSigningKey()
          if (!signingKey) {
            return json(response, 500, {
              error: 'SIGNING_KEY 가 루트 .dev.vars 에 없어요.',
            })
          }

          const parsed = parseCall(await readBody(request))
          if (typeof parsed === 'string') {
            return json(response, 400, { error: parsed })
          }

          const body = JSON.stringify({
            method: parsed.method,
            context: contextFor(parsed.persona),
            params: parsed.params,
          })
          const signature = createHmac('sha256', signingKey)
            .update(body)
            .digest('base64')

          let upstream: Response
          try {
            upstream = await fetch(`${SERVER_ORIGIN}/functions/v1`, {
              method: 'PUT',
              headers: {
                'content-type': 'application/json',
                'x-signature': signature,
              },
              body,
            })
          } catch {
            return json(response, 502, {
              error: `앱 서버(${SERVER_ORIGIN})에 닿지 못했어요. wrangler dev 가 떠 있는지 확인해 주세요.`,
            })
          }

          const text = await upstream.text()
          // A function error is HTTP 200 with an `error` body; schema
          // rejections are a 400 whose body names the offending field. Both
          // are worth showing, so only an unparseable answer is summarised.
          let answer: Record<string, unknown> | null = null
          try {
            answer = JSON.parse(text) as Record<string, unknown>
          } catch {
            answer = null
          }

          if (upstream.status === 200 || (answer && 'error' in answer)) {
            const message = answer?.message
            return json(
              response,
              200,
              upstream.status === 200
                ? answer
                : {
                    error: {
                      message:
                        typeof message === 'string'
                          ? message
                          : `앱 서버가 ${upstream.status} 로 답했어요.`,
                      type: String(answer?.error ?? ''),
                    },
                  }
            )
          }

          return json(response, upstream.status, {
            error: `앱 서버가 ${upstream.status} 로 답했어요.`,
            detail: text.slice(0, 400),
          })
        })()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), identityEndpoint(), functionProxy()],
  server: {
    port: 5174,
    // Vite rejects unknown Host headers, which blocks demo tunnels. A leading
    // dot matches subdomains. Note a tunnel also publishes /demo-api/identity,
    // so anyone with the URL can mint a member hash for any student number.
    allowedHosts: [
      'detoxify-refinance-pointless.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.app',
      '.ngrok.io',
      '.trycloudflare.com',
      '.loca.lt',
    ],
  },
})
