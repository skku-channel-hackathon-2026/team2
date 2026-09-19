import { useCallback, useState } from 'react'
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
import { Badge, Empty, List, Notice, Section, Stat } from '../ui'
import { formatDayTime, formatWindow } from '../utils/datetime'

const STATUS_TONE: Record<
  BallStatus,
  'blue' | 'teal' | 'orange' | 'green' | 'red' | 'default'
> = {
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
        setResult('만남 완료로 바꿨어요. 후배에게 후기 요청이 갔어요.')
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
      title="포켓볼"
      action={
        <button
          className="btn btn--ghost"
          type="button"
          disabled={balls.loading}
          onClick={() => void balls.reload()}
        >
          새로고침
        </button>
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
            hint="‘출현’ 탭에서 후배의 질문을 수락하면 볼이 생겨요."
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
                <div className="card__head">
                  <Badge tone={STATUS_TONE[card.status]}>
                    {BALL_STATUS_LABEL[card.status]}
                  </Badge>
                  <Badge>{card.juniorAlias} 후배</Badge>
                </div>

                <h3 className="card__title">{card.title}</h3>

                <dl className="kv">
                  <dt>일정</dt>
                  <dd>
                    {card.slotStart && card.slotEnd
                      ? `${formatWindow(card.slotStart, card.slotEnd)}${
                          card.place ? ` · ${card.place}` : ''
                        }`
                      : '미정'}
                  </dd>
                  {card.status === 'wobbling' && (
                    <>
                      <dt>후기 기한</dt>
                      <dd>
                        {card.reviewDueAt
                          ? formatDayTime(card.reviewDueAt)
                          : '없음'}
                      </dd>
                      <dt>남은 재촉</dt>
                      <dd>{card.remindersLeft}회</dd>
                    </>
                  )}
                </dl>

                <div className="card__foot">
                  {card.status === 'thrown' && (
                    <button
                      className="btn"
                      type="button"
                      disabled={action.busy}
                      onClick={() => void confirmMet(card)}
                    >
                      만남 완료
                    </button>
                  )}
                  {card.status === 'wobbling' && (
                    <button
                      className="btn"
                      type="button"
                      disabled={action.busy || card.remindersLeft <= 0}
                      onClick={() => void remind(card)}
                    >
                      후기 재촉
                    </button>
                  )}
                  {card.status === 'caught' && (
                    <span className="card__done">도감에 등록됨</span>
                  )}
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
