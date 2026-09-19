import { Button, HStack, Text, VStack } from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
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
import {
  Badge,
  Empty,
  List,
  Portrait,
  Section,
  Stat,
  type BadgeTone,
} from '../ui'
import { fieldTone } from '../fields'
import { formatDayTime, formatWindow } from '../utils/datetime'

const STATUS_TONE: Record<EncounterStatus, BadgeTone> = {
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
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          leadingContent={RefreshIcon}
          label="새로고침"
          disabled={mine.loading}
          onClick={() => void mine.reload()}
        />
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
                <VStack spacing={10}>
                  <HStack
                    spacing={4}
                    align="center"
                    wrap
                  >
                    <Badge tone={STATUS_TONE[card.status]}>
                      {ENCOUNTER_STATUS_LABEL[card.status]}
                    </Badge>
                    <Badge tone={fieldTone(card.fieldId)}>
                      {card.fieldLabel}
                    </Badge>
                    <Badge>{MEET_TYPE_LABEL[card.meetType]}</Badge>
                    <Badge>
                      선배 {card.seniorsJoined}/{card.maxSeniors}명
                    </Badge>
                  </HStack>

                  <Text
                    typo="16"
                    bold
                  >
                    {card.title}
                  </Text>

                  <dl className="kv">
                    <dt>
                      <Text
                        typo="13"
                        color="text-neutral-lighter"
                      >
                        확정 일정
                      </Text>
                    </dt>
                    <dd>
                      <Text typo="13">
                        {card.slotStart && card.slotEnd
                          ? `${formatWindow(card.slotStart, card.slotEnd)}${
                              card.place ? ` · ${card.place}` : ''
                            }`
                          : '아직 미정'}
                      </Text>
                    </dd>

                    <dt>
                      <Text
                        typo="13"
                        color="text-neutral-lighter"
                      >
                        내가 낸 시간
                      </Text>
                    </dt>
                    <dd>
                      <Text typo="13">
                        {card.windows.length === 0
                          ? '없음'
                          : card.windows
                              .map((window) =>
                                formatWindow(window.startAt, window.endAt)
                              )
                              .join(' · ')}
                      </Text>
                    </dd>

                    <dt>
                      <Text
                        typo="13"
                        color="text-neutral-lighter"
                      >
                        수락한 선배
                      </Text>
                    </dt>
                    <dd>
                      {card.seniors.length === 0 ? (
                        <Text typo="13">아직 없음</Text>
                      ) : (
                        <HStack
                          spacing={8}
                          align="center"
                          wrap
                        >
                          {card.seniors.map((senior) => (
                            <HStack
                              key={senior.seniorAlias}
                              spacing={4}
                              align="center"
                            >
                              <Portrait
                                seed={senior.seniorAlias}
                                size="24"
                              />
                              <Text typo="13">
                                {senior.seniorAlias} (
                                {BALL_STATUS_LABEL[senior.ballStatus]})
                              </Text>
                            </HStack>
                          ))}
                        </HStack>
                      )}
                    </dd>

                    <dt>
                      <Text
                        typo="13"
                        color="text-neutral-lighter"
                      >
                        신청
                      </Text>
                    </dt>
                    <dd>
                      <Text typo="13">{formatDayTime(card.createdAt)}</Text>
                    </dd>
                  </dl>

                  {hint(card) && (
                    <Text
                      typo="13"
                      color="text-neutral-light"
                    >
                      {hint(card)}
                    </Text>
                  )}

                  <HStack
                    spacing={6}
                    align="center"
                  >
                    {card.status === 'met' && !card.hasReview && (
                      <Button
                        size="s"
                        label="후기 남기기"
                        onClick={() => onReview(card.encounterId)}
                      />
                    )}
                    {card.hasReview && (
                      <Text
                        typo="13"
                        color="text-accent-green"
                      >
                        후기 제출 완료
                      </Text>
                    )}
                    {card.status === 'expired' && (
                      <Button
                        size="s"
                        variant="outlined"
                        semantic="secondary"
                        label="다시 신청하기"
                        onClick={onAsk}
                      />
                    )}
                  </HStack>
                </VStack>
              </li>
            ))}
          </ul>
        )}
      </List>
    </Section>
  )
}

export default Meetings
