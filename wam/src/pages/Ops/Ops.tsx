import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Text,
  TextInput,
  Divider,
} from '@channel.io/bezier-react/beta'
import { EmptyState, InlineBanner } from '@channel.io/app-sdk-wam-ui'
import { FUNCTIONS, type UpgradeStatus } from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

interface RequestCard {
  requestId: string
  nickname: string
  department: string | null
  cohortYear: number | null
  email: string | null
  intro: string
  status: UpgradeStatus
  createdAt: string
}

interface DecideResult {
  status: UpgradeStatus
  delivered: 'user_chat' | 'wam_only' | 'manual'
  linkCode?: string
}

interface OpsProps {
  appId: string
}

function Ops({ appId }: OpsProps) {
  const list = useAppFunction<{ items: RequestCard[] }>(
    appId,
    FUNCTIONS.upgradeList
  )
  const decide = useAppFunction<DecideResult>(appId, FUNCTIONS.upgradeDecide)

  const [items, setItems] = useState<RequestCard[]>([])
  const [reason, setReason] = useState('')
  const [result, setResult] = useState('')

  const refresh = useCallback(async () => {
    const response = await list.run({ status: 'requested' })
    if (response) setItems(response.items)
  }, [list])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDecide = useCallback(
    async (requestId: string, approve: boolean) => {
      setResult('')
      const response = await decide.run({
        requestId,
        approve,
        ...(approve || !reason.trim() ? {} : { reason: reason.trim() }),
      })
      if (!response) return

      if (approve) {
        setResult(
          response.delivered === 'user_chat'
            ? `승인했어요. 신청자 채팅방으로 초대 링크와 코드를 보냈어요. (코드 ${response.linkCode})`
            : `승인했어요. 채팅방 발송이 안 돼 신청자가 /선배로-업그레이드 에서 확인해야 해요. (코드 ${response.linkCode})`
        )
      } else {
        setResult('반려했어요.')
      }
      setReason('')
      await refresh()
    },
    [decide, reason, refresh]
  )

  const notice = list.message || decide.message
  const busy = list.loading || decide.loading

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        업그레이드 승인
      </Text>

      {notice && (
        <InlineBanner
          variant="error"
          content={notice}
        />
      )}
      {result && !notice && (
        <InlineBanner
          variant="success"
          content={result}
        />
      )}

      {items.length === 0 && !busy && (
        <EmptyState title="대기 중인 신청이 없어요" />
      )}

      {items.map((item) => (
        <VStack
          key={item.requestId}
          spacing={6}
        >
          <Divider />
          <Text
            typo="15"
            bold
          >
            {item.nickname}
            {item.department ? ` · ${item.department}` : ''}
            {item.cohortYear ? ` · ${item.cohortYear}학번` : ''}
          </Text>
          <Text typo="13">{item.intro}</Text>
          {item.email && (
            <Text
              typo="13"
              color="text-neutral-light"
            >
              {item.email}
            </Text>
          )}
          <HStack
            spacing={6}
            justify="end"
          >
            <Button
              variant="outlined"
              semantic="secondary"
              label="반려"
              disabled={busy}
              onClick={() => void handleDecide(item.requestId, false)}
            />
            <Button
              variant="filled"
              semantic="primary"
              label="승인"
              disabled={busy}
              onClick={() => void handleDecide(item.requestId, true)}
            />
          </HStack>
        </VStack>
      ))}

      {items.length > 0 && (
        <TextInput
          placeholder="반려 사유 (선택)"
          value={reason}
          maxLength={200}
          onChange={(event) => setReason(event.target.value)}
        />
      )}
    </VStack>
  )
}

export default Ops
