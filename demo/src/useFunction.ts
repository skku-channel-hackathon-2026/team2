import { useCallback, useEffect, useRef, useState } from 'react'

import { callFunction, FunctionError } from './api'
import type { Session } from './session'

export interface Resource<T> {
  data: T | null
  loading: boolean
  error: string | null
  errorType: string | null
  reload: () => Promise<void>
}

function messageOf(error: unknown): string {
  if (error instanceof FunctionError) return error.message
  return error instanceof Error ? error.message : String(error)
}

function typeOf(error: unknown): string | null {
  return error instanceof FunctionError ? (error.type ?? null) : null
}

/** Loads once per (method, persona) and exposes a manual reload for mutations. */
export function useFunctionData<T>(
  method: string,
  params: unknown,
  persona: Session
): Resource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | null>(null)

  // Kept in a ref so changing params does not re-run the effect on every render.
  const paramsRef = useRef(params)
  paramsRef.current = params

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await callFunction<T>(method, paramsRef.current, persona))
      setError(null)
      setErrorType(null)
    } catch (thrown) {
      setError(messageOf(thrown))
      setErrorType(typeOf(thrown))
    } finally {
      setLoading(false)
    }
  }, [method, persona])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, errorType, reload }
}

export interface Action {
  run: (method: string, params: unknown) => Promise<unknown>
  busy: boolean
  error: string | null
  clearError: () => void
}

/** One in-flight mutation at a time, so double-clicking cannot fire twice. */
export function useAction(persona: Session): Action {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (method: string, params: unknown) => {
      setBusy(true)
      setError(null)
      try {
        return await callFunction<unknown>(method, params, persona)
      } catch (thrown) {
        setError(messageOf(thrown))
        throw thrown
      } finally {
        setBusy(false)
      }
    },
    [persona]
  )

  return { run, busy, error, clearError: () => setError(null) }
}
