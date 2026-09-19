import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const ROOT_ENV = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env')

type HashEncoding = 'hex' | 'raw'

/** Read on every request so editing .env does not need a dev-server restart. */
function readRootEnv(): Record<string, string> {
  let raw = ''
  try {
    raw = readFileSync(ROOT_ENV, 'utf8')
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

export default defineConfig({
  plugins: [react(), identityEndpoint()],
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
