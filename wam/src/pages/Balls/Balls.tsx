import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Text,
  Tag,
  Divider,
} from '@channel.io/bezier-react/beta'
import { EmptyState, InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  BALL_FUNCTIONS,
  BALL_STATUS_LABEL,
  type BallCard,
  type BallListOutput,
  type BallStatus,
  type ConfirmMetOutput,
  type RemindOutput,
} from '@tutorial/shared'

import Portrait from '../../components/Portrait'
import { useAppFunction } from '../../hooks/useAppFunction'
import { formatDay, formatWindow } from '../../utils/datetime'

interface BallsProps {
  appId: string
}

const STATUS_VARIANT: Record<
  BallStatus,
  'blue' | 'orange' | 'green' | 'red' | 'default'
> = {
  thrown: 'blue',
  wobbling: 'orange',
  caught: 'green',
  escaped: 'red',
  cancelled: 'default',
}

function Balls({ appId }: BallsProps) {
  const list = useAppFunction<BallListOutput>(appId, BALL_FUNCTIONS.list)
  const confirmMet = useAppFunction<ConfirmMetOutput>(
    appId,
    BALL_FUNCTIONS.confirmMet
  )
  const remind = useAppFunction<RemindOutput>(appId, BALL_FUNCTIONS.remind)

  const [items, setItems] = useState<BallCard[] | null>(null)
  const [result, setResult] = useState('')
  const [copyText, setCopyText] = useState('')

  const refresh = useCallback(async () => {
    const response = await list.run()
    if (response) setItems(response.items)
  }, [list])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirmMet = useCallback(
    async (card: BallCard) => {
      setResult('')
      setCopyText('')
      const response = await confirmMet.run({ ballId: card.ballId })
      if (!response) return
      setResult(
        response.reviewDueAt
          ? `만남 완료! 새내기 ${card.juniorAlias}님에게 후기를 요청했어요. (마감 ${formatDay(response.reviewDueAt)})`
          : '만남 완료로 기록했어요.'
      )
      await refresh()
    },
    [confirmMet, refresh]
  )

  const handleRemind = useCallback(
    async (card: BallCard) => {
      setResult('')
      setCopyText('')
      const response = await remind.run({ ballId: card.ballId })
      if (!response) return

      if (response.delivered === 'auto') {
        setResult(`재촉했어요. (${response.remindersSent}/2)`)
      } else {
        setResult(
          `자동 발송이 안 됐어요. 아래 문구를 직접 보내 주세요. (${response.remindersSent}/2)`
        )
        setCopyText(response.messageTemplate)
      }
      await refresh()
    },
    [refresh, remind]
  )

  const notice = list.message || confirmMet.message || remind.message
  const busy = list.loading || confirmMet.loading || remind.loading

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        잡은 새내기
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
      {copyText && (
        <InlineBanner
          variant="info"
          content={copyText}
        />
      )}

      {items && items.length === 0 && (
        <VStack spacing={8}>
          <EmptyState title="아직 잡은 새내기가 없어요" />
          <Text
            typo="13"
            color="text-neutral-light"
          >
            /출현 에서 새내기의 밥약을 수락하면 여기에 쌓여요.
          </Text>
        </VStack>
      )}

      {(items ?? []).map((card) => (
        <VStack
          key={card.ballId}
          spacing={6}
        >
          <Divider />
          <HStack
            spacing={4}
            align="center"
          >
            <Portrait
              seed={card.juniorAlias}
              size="30"
            />
            <Text
              typo="15"
              bold
            >
              {card.juniorAlias}
            </Text>
            <Tag
              size="xs"
              variant={STATUS_VARIANT[card.status]}
            >
              {BALL_STATUS_LABEL[card.status]}
            </Tag>
          </HStack>
          <Text typo="13">{card.title}</Text>
          <Text
            typo="13"
            color="text-neutral-light"
          >
            {card.slotStart && card.slotEnd
              ? formatWindow(card.slotStart, card.slotEnd)
              : '일정 미정'}
            {card.place ? ` · ${card.place}` : ''}
          </Text>
          {card.status === 'wobbling' && card.reviewDueAt && (
            <Text
              typo="13"
              color="text-neutral-light"
            >
              후기 마감 {formatDay(card.reviewDueAt)} · 재촉{' '}
              {card.remindersLeft}번 남음
            </Text>
          )}

          {(card.status === 'thrown' || card.status === 'wobbling') && (
            <HStack justify="end">
              {card.status === 'thrown' ? (
                <Button
                  variant="filled"
                  semantic="primary"
                  label="만남 완료"
                  disabled={busy}
                  onClick={() => void handleConfirmMet(card)}
                />
              ) : (
                <Button
                  variant="outlined"
                  semantic="secondary"
                  label="후기 재촉"
                  disabled={busy || card.remindersLeft <= 0}
                  onClick={() => void handleRemind(card)}
                />
              )}
            </HStack>
          )}
        </VStack>
      ))}
    </VStack>
  )
}

export default Balls
