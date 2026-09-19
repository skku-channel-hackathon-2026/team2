import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  ButtonGroup,
  Text,
  TextInput,
  Divider,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  FUNCTIONS,
  GROUP_ROLES,
  GROUP_ROLE_LABEL,
  type GroupRole,
} from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

interface Settings {
  wildGroupId: string | null
  loungeGroupId: string | null
  opsGroupId: string | null
  inviteLink: string | null
  inviteExpiresAt: string | null
}

interface SaveResult {
  settings: Settings
  announced: boolean
}

interface OpsConfigProps {
  appId: string
  chatId: string
  chatType: string
}

function OpsConfig({ appId, chatId, chatType }: OpsConfigProps) {
  const load = useAppFunction<Settings>(appId, FUNCTIONS.opsGetSettings)
  const save = useAppFunction<SaveResult>(appId, FUNCTIONS.opsSaveSettings)

  const [settings, setSettings] = useState<Settings | null>(null)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteExpiresAt, setInviteExpiresAt] = useState('')
  const [done, setDone] = useState('')

  const refresh = useCallback(async () => {
    const result = await load.run()
    if (!result) return
    setSettings(result)
    setInviteLink(result.inviteLink ?? '')
    setInviteExpiresAt(result.inviteExpiresAt ?? '')
  }, [load])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const registerRoom = useCallback(
    async (role: GroupRole) => {
      setDone('')
      const result = await save.run({ groupRole: role, chatId })
      if (!result) return
      setSettings(result.settings)
      setDone(
        result.announced
          ? `이 방을 ${GROUP_ROLE_LABEL[role]}으로 등록하고 안내 메시지를 보냈어요.`
          : `이 방을 ${GROUP_ROLE_LABEL[role]}으로 등록했어요. (안내 메시지 발송 실패)`
      )
    },
    [chatId, save]
  )

  const saveInvite = useCallback(async () => {
    setDone('')
    const result = await save.run({
      ...(inviteLink.trim() ? { inviteLink: inviteLink.trim() } : {}),
      ...(inviteExpiresAt.trim()
        ? { inviteExpiresAt: inviteExpiresAt.trim() }
        : {}),
    })
    if (!result) return
    setSettings(result.settings)
    setDone('초대 링크를 저장했어요.')
  }, [inviteExpiresAt, inviteLink, save])

  const isGroup = chatType === 'group'
  const notice = load.message || save.message

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        운영 설정
      </Text>

      {notice && (
        <InlineBanner
          variant="error"
          content={notice}
        />
      )}
      {done && !notice && (
        <InlineBanner
          variant="success"
          content={done}
        />
      )}
      {!isGroup && (
        <InlineBanner
          variant="info"
          content="그룹방에서 실행해야 이 방을 등록할 수 있어요."
        />
      )}

      <Text typo="13">이 방의 역할을 선택하세요.</Text>
      <ButtonGroup>
        {GROUP_ROLES.map((role) => (
          <Button
            key={role}
            variant="outlined"
            semantic="primary"
            label={GROUP_ROLE_LABEL[role]}
            disabled={!isGroup || save.loading}
            onClick={() => void registerRoom(role)}
          />
        ))}
      </ButtonGroup>

      <VStack spacing={2}>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          출현 알림방: {settings?.wildGroupId ?? '미등록'}
        </Text>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          선배 라운지: {settings?.loungeGroupId ?? '미등록'}
        </Text>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          운영방: {settings?.opsGroupId ?? '미등록'}
        </Text>
      </VStack>

      <Divider />

      <Text typo="13">팀원 초대 링크</Text>
      <TextInput
        placeholder="https://..."
        value={inviteLink}
        onChange={(event) => setInviteLink(event.target.value)}
      />
      <TextInput
        placeholder="링크 만료일 (예: 2026-09-26)"
        value={inviteExpiresAt}
        onChange={(event) => setInviteExpiresAt(event.target.value)}
      />
      <HStack justify="end">
        <Button
          variant="filled"
          semantic="primary"
          label="초대 링크 저장"
          disabled={save.loading || inviteLink.trim().length === 0}
          onClick={() => void saveInvite()}
        />
      </HStack>
    </VStack>
  )
}

export default OpsConfig
