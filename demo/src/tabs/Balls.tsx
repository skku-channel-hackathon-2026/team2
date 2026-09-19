import { useCallback, useState } from 'react'
import { Button, HStack, Text, VStack } from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
import {
  BALL_FUNCTIONS,
  BALL_STATUS_LABEL,
  type BallCard,
  type BallListOutput,
  type BallStatus,
  type RemindOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import {
  Badge,
  Empty,
  List,
  Notice,
  Portrait,
  Section,
  Stat,
  type BadgeTone,
} from '../ui'
import { formatDayTime, formatWindow } from '../utils/datetime'

const STATUS_TONE: Record<BallStatus, BadgeTone> = {
  thrown: 'blue',
  wobbling: 'orange',
  caught: 'green',
  escaped: 'red',
  cancelled: 'default',
}

interface BallsProps {
  session: Session
  onChanged: () => void
}

function Balls({ session, onChanged }: BallsProps) {
  const balls = useFunctionData<BallListOutput>(
    BALL_FUNCTIONS.list,
    {},
    session
  )
  const action = useAction(session)
  const [result, setResult] = useState<string | null>(null)

  const items = balls.data?.items ?? []
  const resource = { ...balls, data: balls.data ? items : null }

  const confirmMet = useCallback(
    async (card: BallCard) => {
      setResult(null)
      try {
        await action.run(BALL_FUNCTIONS.confirmMet, { ballId: card.ballId })
        setResult('만남 완료로 바꿨어요. 새내기에게 후기 요청이 갔어요.')
        await balls.reload()
        onChanged()
      } catch {
        // action.error already carries the message.
      }
    },
    [action, balls, onChanged]
  )

  const remind = useCallback(
    async (card: BallCard) => {
      setResult(null)
      try {
        const response = (await action.run(BALL_FUNCTIONS.remind, {
          ballId: card.ballId,
        })) as RemindOutput
        setResult(
          response.delivered === 'auto'
            ? `재촉을 보냈어요 (${response.remindersSent}/2회).`
            : `자동 발송이 안 돼 문구만 준비했어요 (${response.remindersSent}/2회): ${response.messageTemplate}`
        )
        await balls.reload()
      } catch {
        // action.error already carries the message.
      }
    },
    [action, balls]
  )

  const upcoming = items.filter((card) => card.status === 'thrown').length
  const waiting = items.filter((card) => card.status === 'wobbling').length
  const caught = items.filter((card) => card.status === 'caught').length

  return (
    <Section
      title="잡은 새내기"
      action={
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          leadingContent={RefreshIcon}
          label="새로고침"
          disabled={balls.loading}
          onClick={() => void balls.reload()}
        />
      }
    >
      <div className="stats">
        <Stat
          label="만남 예정"
          value={upcoming}
        />
        <Stat
          label="후기 대기"
          value={waiting}
        />
        <Stat
          label="잡기 성공"
          value={caught}
        />
      </div>

      {result && <Notice tone="success">{result}</Notice>}
      {action.error && <Notice tone="error">{action.error}</Notice>}

      <List
        resource={resource}
        empty={
          <Empty
            title="아직 잡은 밥약이 없어요"
            hint="‘출현’ 탭에서 새내기의 질문을 수락하면 여기에 추가돼요."
          />
        }
      >
        {(cards) => (
          <ul className="cards">
            {cards.map((card) => (
              <li
                key={card.ballId}
                className="card"
              >
                <div className="card__media">
                  <Portrait
                    seed={card.juniorAlias}
                    size="42"
                  />

                  <VStack spacing={8}>
                    <HStack
                      spacing={4}
                      align="center"
                      wrap
                    >
                      <Badge tone={STATUS_TONE[card.status]}>
                        {BALL_STATUS_LABEL[card.status]}
                      </Badge>
                      <Badge>새내기 {card.juniorAlias}</Badge>
                    </HStack>

                    <Text
                      typo="15"
                      bold
                    >
                      {card.title}
                    </Text>

                    <Text
                      typo="13"
                      color="text-neutral-light"
                    >
                      {card.slotStart && card.slotEnd
                        ? `${formatWindow(card.slotStart, card.slotEnd)}${
                            card.place ? ` · ${card.place}` : ''
                          }`
                        : '일정 미정'}
                    </Text>

                    {card.status === 'wobbling' && (
                      <Text
                        typo="13"
                        color="text-neutral-lighter"
                      >
                        후기 기한{' '}
                        {card.reviewDueAt
                          ? formatDayTime(card.reviewDueAt)
                          : '없음'}{' '}
                        · 남은 재촉 {card.remindersLeft}회
                      </Text>
                    )}

                    <HStack
                      spacing={6}
                      align="center"
                    >
                      {card.status === 'thrown' && (
                        <Button
                          size="s"
                          label="만남 완료"
                          disabled={action.busy}
                          onClick={() => void confirmMet(card)}
                        />
                      )}
                      {card.status === 'wobbling' && (
                        <Button
                          size="s"
                          variant="outlined"
                          semantic="secondary"
                          label="후기 재촉"
                          disabled={action.busy || card.remindersLeft <= 0}
                          onClick={() => void remind(card)}
                        />
                      )}
                      {card.status === 'caught' && (
                        <Text
                          typo="13"
                          color="text-accent-green"
                        >
                          도감에 등록됨
                        </Text>
                      )}
                    </HStack>
                  </VStack>
                </div>
              </li>
            ))}
          </ul>
        )}
      </List>
    </Section>
  )
}

export default Balls
