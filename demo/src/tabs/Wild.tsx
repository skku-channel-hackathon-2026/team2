import { useCallback, useState } from 'react'
import {
  Button,
  HStack,
  TextInput,
  Text,
  VStack,
} from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
import {
  MEET_TYPE_LABEL,
  WILD_FUNCTIONS,
  type WildAcceptOutput,
  type WildCard,
  type WildListOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Badge, Empty, List, Notice, Portrait, Section } from '../ui'
import { fieldTone } from '../fields'
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
      title="야생의 새내기"
      action={
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          leadingContent={RefreshIcon}
          label="새로고침"
          disabled={wild.loading}
          onClick={() => void wild.reload()}
        />
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
                      <Badge tone={fieldTone(card.fieldId)}>
                        {card.fieldLabel}
                      </Badge>
                      <Badge>{MEET_TYPE_LABEL[card.meetType]}</Badge>
                      <Badge>
                        선배 {card.seniorsJoined}/{card.maxSeniors}명
                      </Badge>
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
                      새내기 {card.juniorAlias} · 겹치는 시간{' '}
                      {card.overlapWindows.length === 0
                        ? '없음'
                        : card.overlapWindows
                            .map((window) =>
                              formatWindow(window.startAt, window.endAt)
                            )
                            .join(' · ')}
                    </Text>

                    {openId === card.encounterId ? (
                      <VStack spacing={8}>
                        <HStack
                          spacing={4}
                          wrap
                        >
                          {card.overlapWindows.map((window) => {
                            const key = `${window.startAt}|${window.endAt}`
                            return (
                              <Button
                                key={key}
                                size="xs"
                                variant={
                                  slotKey === key ? 'filled' : 'outlined'
                                }
                                semantic="secondary"
                                label={formatWindow(
                                  window.startAt,
                                  window.endAt
                                )}
                                onClick={() => setSlotKey(key)}
                              />
                            )
                          })}
                        </HStack>

                        <TextInput
                          size="m"
                          value={place}
                          maxLength={100}
                          placeholder="장소 (선택) — 학생회관 학식"
                          onChange={(event) => setPlace(event.target.value)}
                        />

                        <HStack spacing={6}>
                          <Button
                            size="s"
                            label={action.busy ? '수락 중…' : '수락하기'}
                            loading={action.busy}
                            onClick={() => void accept(card)}
                          />
                          <Button
                            size="s"
                            variant="ghost"
                            semantic="secondary"
                            label="닫기"
                            onClick={() => setOpenId(null)}
                          />
                        </HStack>
                      </VStack>
                    ) : (
                      <HStack>
                        <Button
                          size="s"
                          label="수락하기"
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
                        />
                      </HStack>
                    )}
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

export default Wild
