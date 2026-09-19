import { useCallback, useState } from 'react'
import {
  MEET_TYPE_LABEL,
  WILD_FUNCTIONS,
  type WildAcceptOutput,
  type WildCard,
  type WildListOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Badge, Empty, List, Notice, Section } from '../ui'
import { formatWindow } from '../utils/datetime'

interface WildProps {
  session: Session
  onAccepted: () => void
}

function Wild({ session, onAccepted }: WildProps) {
  const wild = useFunctionData<WildListOutput>(WILD_FUNCTIONS.list, {}, session)
  const action = useAction(session)

  const [openId, setOpenId] = useState<string | null>(null)
  const [slotKey, setSlotKey] = useState('')
  const [place, setPlace] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const items = wild.data?.items ?? []
  const resource = { ...wild, data: wild.data ? items : null }

  const accept = useCallback(
    async (card: WildCard) => {
      const slot = card.overlapWindows.find(
        (window) => `${window.startAt}|${window.endAt}` === slotKey
      )

      try {
        const accepted = (await action.run(WILD_FUNCTIONS.accept, {
          encounterId: card.encounterId,
          ...(slot ? { slot } : {}),
          ...(place.trim() ? { place: place.trim() } : {}),
        })) as WildAcceptOutput

        setResult(
          accepted.isFirst
            ? `수락했어요. 내가 첫 번째 선배예요 (${accepted.seniorsJoined}/${accepted.maxSeniors}명).`
            : `수락했어요 (${accepted.seniorsJoined}/${accepted.maxSeniors}명). 일정은 첫 선배가 정한 시간을 따라요.`
        )
        setOpenId(null)
        setSlotKey('')
        setPlace('')
        await wild.reload()
        onAccepted()
      } catch {
        // action.error already carries the message.
      }
    },
    [action, onAccepted, place, slotKey, wild]
  )

  return (
    <Section
      title="야생의 후배"
      action={
        <button
          className="btn btn--ghost"
          type="button"
          disabled={wild.loading}
          onClick={() => void wild.reload()}
        >
          새로고침
        </button>
      }
    >
      {result && <Notice tone="success">{result}</Notice>}
      {action.error && <Notice tone="error">{action.error}</Notice>}

      <List
        resource={resource}
        empty={
          <Empty
            title="지금 나에게 온 출현이 없어요"
            hint="분야와 가능 시간이 겹치는 질문만 도착해요. ‘선배 설정’ 탭을 확인해 보세요."
          />
        }
      >
        {(cards) => (
          <ul className="cards">
            {cards.map((card) => (
              <li
                key={card.encounterId}
                className="card"
              >
                <div className="card__head">
                  <Badge tone="blue">{card.fieldLabel}</Badge>
                  <Badge>{MEET_TYPE_LABEL[card.meetType]}</Badge>
                  <Badge>
                    선배 {card.seniorsJoined}/{card.maxSeniors}명
                  </Badge>
                </div>

                <h3 className="card__title">{card.title}</h3>
                <p className="card__hint">{card.juniorAlias} 후배</p>

                <dl className="kv">
                  <dt>겹치는 시간</dt>
                  <dd>
                    {card.overlapWindows.length === 0
                      ? '겹치는 시간이 없어요'
                      : card.overlapWindows
                          .map((window) =>
                            formatWindow(window.startAt, window.endAt)
                          )
                          .join(' · ')}
                  </dd>
                </dl>

                {openId === card.encounterId ? (
                  <>
                    <div className="field">
                      <span>만날 시간 고르기</span>
                      <div className="chips">
                        {card.overlapWindows.map((window) => {
                          const key = `${window.startAt}|${window.endAt}`
                          return (
                            <button
                              key={key}
                              type="button"
                              className={
                                slotKey === key ? 'chip chip--on' : 'chip'
                              }
                              onClick={() => setSlotKey(key)}
                            >
                              {formatWindow(window.startAt, window.endAt)}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <label className="field">
                      <span>장소 (선택)</span>
                      <input
                        value={place}
                        maxLength={100}
                        placeholder="학생회관 학식"
                        onChange={(event) => setPlace(event.target.value)}
                      />
                    </label>

                    <div className="card__foot">
                      <button
                        className="btn"
                        type="button"
                        disabled={action.busy}
                        onClick={() => void accept(card)}
                      >
                        {action.busy ? '수락 중…' : '수락하기'}
                      </button>
                      <button
                        className="btn btn--ghost"
                        type="button"
                        onClick={() => setOpenId(null)}
                      >
                        닫기
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="card__foot">
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setResult(null)
                        action.clearError()
                        setOpenId(card.encounterId)
                        setSlotKey(
                          card.overlapWindows[0]
                            ? `${card.overlapWindows[0].startAt}|${card.overlapWindows[0].endAt}`
                            : ''
                        )
                      }}
                    >
                      수락하기
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </List>
    </Section>
  )
}

export default Wild
