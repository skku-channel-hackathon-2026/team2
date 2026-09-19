import { useCallback, useState } from 'react'
import { useCallFunction } from '@channel.io/app-sdk-wam'

export interface AppFunctionResult<T> {
  run: (input?: Record<string, unknown>) => Promise<T | null>
  loading: boolean
  message: string
  clearMessage: () => void
}

/**
 * Server errors carry a Korean message; surface it instead of a generic one.
 */
export function useAppFunction<T>(
  appId: string,
  name: string
): AppFunctionResult<T> {
  const { call, loading } = useCallFunction<T>({ appId, name })
  const [message, setMessage] = useState('')

  const run = useCallback(
    async (input: Record<string, unknown> = {}): Promise<T | null> => {
      setMessage('')
      try {
        return await call(input)
      } catch (error) {
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
        )
        return null
      }
    },
    [call]
  )

  return { run, loading, message, clearMessage: () => setMessage('') }
}
