import * as ChannelService from '@channel.io/channel-web-sdk-loader'

export interface Identity {
  pluginKey: string
  memberId: string
  memberHash: string | null
  hashEncoding: 'hex' | 'raw' | null
  name: string
  studentId: string
  profile: Record<string, string>
}

export interface BootState {
  status: 'idle' | 'booting' | 'booted' | 'failed'
  memberId?: string
  hashEncoding?: 'hex' | 'raw' | null
  error?: string
}

let scriptLoaded = false

export async function fetchIdentity(
  session: { name: string; studentId: string },
  encoding?: 'raw'
): Promise<Identity> {
  const query = new URLSearchParams(session)
  if (encoding) query.set('encoding', encoding)

  const response = await fetch(`/demo-api/identity?${query}`)
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error ?? '신원 정보를 받지 못했어요.')
  return body as Identity
}

export function bootAs(identity: Identity): Promise<BootState> {
  if (!scriptLoaded) {
    ChannelService.loadScript()
    scriptLoaded = true
  }

  // A previous persona's session would otherwise stay attached to the messenger.
  ChannelService.shutdown()

  return new Promise((resolve) => {
    ChannelService.boot(
      {
        pluginKey: identity.pluginKey,
        memberId: identity.memberId,
        ...(identity.memberHash ? { memberHash: identity.memberHash } : {}),
        profile: identity.profile,
        language: 'ko',
        hideChannelButtonOnBoot: true,
        hidePopup: true,
      },
      (error, user) => {
        if (error) {
          resolve({
            status: 'failed',
            error: error.message || String(error),
            hashEncoding: identity.hashEncoding,
          })
          return
        }
        // Land straight in a chat: the messenger's home/"Start a chat" screen
        // is Channel's CS shell, not this product's UI.
        ChannelService.openChat()
        resolve({
          status: 'booted',
          memberId: user?.memberId ?? identity.memberId,
          hashEncoding: identity.hashEncoding,
        })
      }
    )
  })
}

export function shutdown(): void {
  ChannelService.shutdown()
}

/** `openChat` with no chat id starts a new chat and prefills the composer. */
export function runCommand(command: string): void {
  ChannelService.openChat(undefined, `/${command} `)
}
