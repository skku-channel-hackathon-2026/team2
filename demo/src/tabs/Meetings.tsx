import {
  BALL_STATUS_LABEL,
  ENCOUNTER_FUNCTIONS,
  ENCOUNTER_STATUS_LABEL,
  MEET_TYPE_LABEL,
  type EncounterMineOutput,
  type EncounterStatus,
  type MyEncounterCard,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useFunctionData } from '../useFunction'
import { Badge, Empty, List, Section, Stat } from '../ui'
import { formatDayTime, formatWindow } from '../utils/datetime'

const STATUS_TONE: Record<
  EncounterStatus,
  'blue' | 'teal' | 'orange' | 'green' | 'red' | 'default'
> = {
  wild: 'blue',
  matched: 'teal',
  met: 'orange',
  caught: 'green',
  escaped: 'red',
  expired: 'default',
  cancelled: 'default',
}

function hint(card: MyEncounterCard): string | null {
  switch (card.status) {
    case 'wild':
      return '선배가 수락하면 알려드릴게요.'
    case 'matched':
      return '약속 시간에 만나요. 선배가 만남 완료를 누르면 후기를 쓸 수 있어요.'
    case 'met':
      return card.reviewDueAt
        ? `${formatDayTime(card.reviewDueAt)} 까지 후기를 남기면 선배 도감에 등록돼요.`
        : '후기를 남기면 선배 도감에 등록돼요.'
    case 'expired':
      return '맞는 선배를 찾지 못했어요. 다시 신청해 보세요.'
    default:
      return null
  }
}

interface MeetingsProps {
  session: Session
  onAsk: () => void
  onReview: (encounterId: string) => void
}

function Meetings({ session, onAsk, onReview }: MeetingsProps) {
  const mine = useFunctionData<EncounterMineOutput>(
    ENCOUNTER_FUNCTIONS.mine,
    {},
    session
  )
  const items = mine.data?.items ?? []
  const resource = { ...mine, data: mine.data ? items : null }

  const live = items.filter((card) =>
    ['wild', 'matched', 'met'].includes(card.status)
  ).length
  const done = items.filter((card) => card.status === 'caught').length

  return (
    <Section
      title="내 밥약"
      action={
        <button
          className="btn btn--ghost"
          type="button"
          disabled={mine.loading}
          onClick={() => void mine.reload()}
        >
          새로고침
        </button>
      }
    >
      <div className="stats">
        <Stat
          label="전체 신청"
          value={items.length}
        />
        <Stat
          label="진행 중"
          value={live}
        />
        <Stat
          label="잡기 완료"
          value={done}
        />
      </div>

      <List
        resource={resource}
        empty={
          <Empty
            title="아직 신청한 밥약이 없어요"
            hint="‘질문하기’ 탭에서 궁금한 것을 물어보면 시작돼요."
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
                  <Badge tone={STATUS_TONE[card.status]}>
                    {ENCOUNTER_STATUS_LABEL[card.status]}
                  </Badge>
                  <Badge>{card.fieldLabel}</Badge>
                  <Badge>{MEET_TYPE_LABEL[card.meetType]}</Badge>
                  <Badge>
                    선배 {card.seniorsJoined}/{card.maxSeniors}명
                  </Badge>
                </div>

                <h3 className="card__title">{card.title}</h3>

                <dl className="kv">
                  <dt>확정 일정</dt>
                  <dd>
                    {card.slotStart && card.slotEnd
                      ? `${formatWindow(card.slotStart, card.slotEnd)}${
                          card.place ? ` · ${card.place}` : ''
                        }`
                      : '아직 미정'}
                  </dd>

                  <dt>내가 낸 시간</dt>
                  <dd>
                    {card.windows.length === 0
                      ? '없음'
                      : card.windows
                          .map((window) =>
                            formatWindow(window.startAt, window.endAt)
                          )
                          .join(' · ')}
                  </dd>

                  <dt>수락한 선배</dt>
                  <dd>
                    {card.seniors.length === 0
                      ? '아직 없음'
                      : card.seniors
                          .map(
                            (senior) =>
                              `${senior.seniorAlias} (${BALL_STATUS_LABEL[senior.ballStatus]})`
                          )
                          .join(', ')}
                  </dd>

                  <dt>신청</dt>
                  <dd>{formatDayTime(card.createdAt)}</dd>
                </dl>

                {hint(card) && <p className="card__hint">{hint(card)}</p>}

                <div className="card__foot">
                  {card.status === 'met' && !card.hasReview && (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => onReview(card.encounterId)}
                    >
                      후기 남기기
                    </button>
                  )}
                  {card.hasReview && (
                    <span className="card__done">후기 제출 완료</span>
                  )}
                  {card.status === 'expired' && (
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={onAsk}
                    >
                      다시 신청하기
                    </button>
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

export default Meetings
