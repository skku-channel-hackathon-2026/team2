import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

import { findPersona } from './src/personas'

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
 * Dev-only: the built bundle has no such endpoint, so a hosted copy of this
 * page degrades to an anonymous boot instead of exposing anything.
 */
function identityEndpoint(): Plugin {
  return {
    name: 'hubaego-demo-identity',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/demo-api/identity', (request, response) => {
        const url = new URL(request.url ?? '', 'http://localhost')
        const persona = findPersona(url.searchParams.get('persona') ?? '')
        if (!persona) return json(response, 404, { error: 'unknown persona' })

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

        json(response, 200, {
          pluginKey,
          memberId: persona.memberId,
          memberHash: secret
            ? memberHash(persona.memberId, secret, encoding)
            : null,
          hashEncoding: secret ? encoding : null,
          profile: {
            name: persona.name,
            학과: persona.department,
            학번: persona.cohort,
          },
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), identityEndpoint()],
  server: { port: 5174 },
})
