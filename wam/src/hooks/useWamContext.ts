import { useMemo } from 'react'
import { useTypedWamData } from '@channel.io/app-sdk-wam'
import { WamDataSchema, type WamData } from '@tutorial/shared'

export interface WamContextResult {
  data: WamData | null
  error: Error | null
}

export function useWamContext(): WamContextResult {
  const appId = useTypedWamData('appId')
  const channelId = useTypedWamData('channelId')
  const screen = useTypedWamData('screen')
  const commandId = useTypedWamData('commandId')
  const commandName = useTypedWamData('commandName')
  const chatId = useTypedWamData('chatId')
  const chatType = useTypedWamData('chatType')

  return useMemo(() => {
    const parsed = WamDataSchema.safeParse({
      appId,
      channelId,
      screen,
      commandId,
      commandName,
      chatId,
      chatType,
    })

    if (parsed.success) return { data: parsed.data, error: null }

    return {
      data: null,
      error: new Error('호스트가 전달한 WAM 데이터를 읽을 수 없어요.'),
    }
  }, [appId, channelId, chatId, chatType, commandId, commandName, screen])
}
