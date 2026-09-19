import type { Session } from './session'

export interface FunctionErrorBody {
  code?: number
  message?: string
  type?: string
}

/** Function errors arrive as HTTP 200 with an `error` body, so failure has to
 *  be raised here rather than read off the status code. */
export class FunctionError extends Error {
  readonly type: string | undefined

  constructor(message: string, type?: string) {
    super(message)
    this.name = 'FunctionError'
    this.type = type
  }
}

export async function callFunction<T>(
  method: string,
  params: unknown,
  persona: Session
): Promise<T> {
  const response = await fetch('/demo-api/fn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params, persona }),
  })

  const body = (await response.json()) as {
    result?: T
    error?: FunctionErrorBody | string
  }

  if (!response.ok || body.error !== undefined) {
    const error = body.error
    if (typeof error === 'string') throw new FunctionError(error)
    throw new FunctionError(
      error?.message ?? `${method} 호출이 실패했어요.`,
      error?.type
    )
  }

  return body.result as T
}
