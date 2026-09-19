import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  HStack,
  Text,
  TextArea,
  VStack,
} from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
import {
  ENCOUNTER_FUNCTIONS,
  REVIEW_FUNCTIONS,
  type EncounterMineOutput,
  type MyEncounterCard,
  type ReviewSubmitOutput,
  type SeniorCard,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Badge, Empty, List, Notice, Portrait, Section } from '../ui'
import { formatDayTime } from '../utils/datetime'

const MIN_REVIEW_LENGTH = 20

interface ReviewProps {
  session: Session
  selected: string | null
  onSelect: (encounterId: string | null) => void
  onSubmitted: () => void
}

function Review({ session, selected, onSelect, onSubmitted }: ReviewProps) {
  const mine = useFunctionData<EncounterMineOutput>(
    ENCOUNTER_FUNCTIONS.mine,
    {},
    session
  )
  const action = useAction(session)

  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [selfAnswer, setSelfAnswer] = useState('')
  const [shareConsent, setShareConsent] = useState(true)
  const [caughtBy, setCaughtBy] = useState<SeniorCard[] | null>(null)
  const [localError, setLocalError] = useState('')

  const pending = (mine.data?.items ?? []).filter(
    (card: MyEncounterCard) => card.status === 'met' && !card.hasReview
  )
  const resource = { ...mine, data: mine.data ? pending : null }
  const target = pending.find((card) => card.encounterId === selected) ?? null

  // A submitted or vanished encounter must not leave a dangling selection.
  useEffect(() => {
    if (selected && mine.data && !target && !caughtBy) onSelect(null)
  }, [caughtBy, mine.data, onSelect, selected, target])

  const submit = useCallback(async () => {
    setLocalError('')
    if (!target) return
    if (reviewText.trim().length < MIN_REVIEW_LENGTH) {
      setLocalError(`후기는 ${MIN_REVIEW_LENGTH}자 이상 남겨 주세요.`)
      return
    }

    try {
      const result = (await action.run(REVIEW_FUNCTIONS.submit, {
        encounterId: target.encounterId,
        rating,
        reviewText: reviewText.trim(),
        ...(selfAnswer.trim() ? { selfAnswer: selfAnswer.trim() } : {}),
        shareConsent,
      })) as ReviewSubmitOutput

      setCaughtBy(result.caughtBy)
      setReviewText('')
      setSelfAnswer('')
      await mine.reload()
      onSubmitted()
    } catch {
      // action.error already carries the message.
    }
  }, [
    action,
    mine,
    onSubmitted,
    rating,
    reviewText,
    selfAnswer,
    shareConsent,
    target,
  ])

  if (caughtBy) {
    return (
      <Section title="후기 제출 완료">
        <Notice tone="success">
          후기가 등록됐어요. 선배 도감에 내가 올라갔어요!
        </Notice>
        <ul className="cards">
          {caughtBy.map((senior) => (
            <li
              key={senior.seniorId}
              className="card"
            >
              <HStack
                spacing={10}
                align="center"
              >
                <Portrait
                  seed={senior.seniorAlias}
                  size="42"
                />
                <VStack spacing={2}>
                  <Text
                    typo="15"
                    bold
                  >
                    {senior.seniorAlias} 선배
                  </Text>
                  <HStack>
                    <Badge tone="green">친밀도 Lv.{senior.level}</Badge>
                  </HStack>
                </VStack>
              </HStack>
            </li>
          ))}
        </ul>
        <HStack>
          <Button
            size="m"
            label="돌아가기"
            onClick={() => {
              setCaughtBy(null)
              onSelect(null)
            }}
          />
        </HStack>
      </Section>
    )
  }

  if (target) {
    return (
      <Section title="후기 남기기">
        <Text
          typo="15"
          bold
        >
          {target.title}
        </Text>

        <VStack spacing={6}>
          <Text
            typo="13"
            color="text-neutral-light"
          >
            만족도
          </Text>
          <HStack spacing={4}>
            {[1, 2, 3, 4, 5].map((score) => (
              <Button
                key={score}
                size="s"
                variant={rating === score ? 'filled' : 'outlined'}
                semantic="secondary"
                label={`${score}`}
                onClick={() => setRating(score)}
              />
            ))}
          </HStack>
        </VStack>

        <VStack spacing={6}>
          <Text
            typo="13"
            color="text-neutral-light"
          >
            어떤 만남이었나요? ({MIN_REVIEW_LENGTH}자 이상)
          </Text>
          <TextArea
            value={reviewText}
            maxLength={1000}
            onChange={(event) => setReviewText(event.target.value)}
          />
        </VStack>

        <VStack spacing={6}>
          <Text
            typo="13"
            color="text-neutral-light"
          >
            내가 찾은 답 (선택 · 확인을 거쳐 지식으로 쌓여요)
          </Text>
          <TextArea
            value={selfAnswer}
            maxLength={1000}
            onChange={(event) => setSelfAnswer(event.target.value)}
          />
        </VStack>

        <Checkbox
          checked={shareConsent}
          onCheckedChange={(checked) => setShareConsent(checked === true)}
        >
          내 별명을 선배 도감과 답변에 보여줘도 괜찮아요
        </Checkbox>

        {(localError || action.error) && (
          <Notice tone="error">{localError || action.error}</Notice>
        )}

        <HStack spacing={6}>
          <Button
            size="m"
            label={action.busy ? '제출 중…' : '후기 제출'}
            loading={action.busy}
            onClick={() => void submit()}
          />
          <Button
            size="m"
            variant="ghost"
            semantic="secondary"
            label="취소"
            onClick={() => onSelect(null)}
          />
        </HStack>
      </Section>
    )
  }

  return (
    <Section
      title="후기 대기"
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
      <List
        resource={resource}
        empty={
          <Empty
            title="지금 쓸 후기가 없어요"
            hint="선배가 만남 완료를 누르면 여기에 나타나요."
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
                <VStack spacing={8}>
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
                    {card.reviewDueAt
                      ? `${formatDayTime(card.reviewDueAt)} 까지`
                      : '기한 없음'}
                    {card.seniors.length > 0 &&
                      ` · ${card.seniors.map((senior) => senior.seniorAlias).join(', ')} 선배`}
                  </Text>
                  <HStack>
                    <Button
                      size="s"
                      label="후기 쓰기"
                      onClick={() => onSelect(card.encounterId)}
                    />
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

export default Review
