import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Checkbox,
  Text,
  TextArea,
  Radio,
  RadioGroup,
  Divider,
} from '@channel.io/bezier-react/beta'
import { EmptyState, InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  ENCOUNTER_FUNCTIONS,
  REVIEW_FUNCTIONS,
  type EncounterMineOutput,
  type MyEncounterCard,
  type ReviewSubmitOutput,
} from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'
import { formatWindow } from '../../utils/datetime'

interface ReviewProps {
  appId: string
}

const MIN_REVIEW_LENGTH = 20
const RATINGS = [5, 4, 3, 2, 1]

function Review({ appId }: ReviewProps) {
  const mine = useAppFunction<EncounterMineOutput>(
    appId,
    ENCOUNTER_FUNCTIONS.mine
  )
  const submit = useAppFunction<ReviewSubmitOutput>(
    appId,
    REVIEW_FUNCTIONS.submit
  )

  const [encounters, setEncounters] = useState<MyEncounterCard[] | null>(null)
  const [encounterId, setEncounterId] = useState('')
  const [rating, setRating] = useState('5')
  const [reviewText, setReviewText] = useState('')
  const [selfAnswer, setSelfAnswer] = useState('')
  const [shareConsent, setShareConsent] = useState(true)
  const [result, setResult] = useState('')
  const [localError, setLocalError] = useState('')

  const refresh = useCallback(async () => {
    const response = await mine.run()
    if (!response) return
    const pending = response.items.filter((item) => item.status === 'met')
    setEncounters(pending)
    setEncounterId((previous) =>
      pending.some((item) => item.encounterId === previous)
        ? previous
        : (pending[0]?.encounterId ?? '')
    )
  }, [mine])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = useMemo(
    () => encounters?.find((item) => item.encounterId === encounterId) ?? null,
    [encounters, encounterId]
  )

  const handleSubmit = useCallback(async () => {
    setResult('')
    setLocalError('')

    if (!encounterId) {
      setLocalError('후기를 남길 밥약을 골라 주세요.')
      return
    }
    if (reviewText.trim().length < MIN_REVIEW_LENGTH) {
      setLocalError(`후기는 ${MIN_REVIEW_LENGTH}자 이상 써 주세요.`)
      return
    }

    const response = await submit.run({
      encounterId,
      rating: Number(rating),
      reviewText: reviewText.trim(),
      shareConsent,
      ...(selfAnswer.trim() ? { selfAnswer: selfAnswer.trim() } : {}),
    })
    if (!response) return

    const names = response.caughtBy.map((senior) => senior.seniorAlias)
    setResult(
      names.length > 0
        ? `잡기 성공! ${names.join(', ')} 선배의 도감에 등록됐어요 🎉`
        : '후기를 남겼어요. 고마워요!'
    )
    setReviewText('')
    setSelfAnswer('')
    await refresh()
  }, [
    encounterId,
    rating,
    refresh,
    reviewText,
    selfAnswer,
    shareConsent,
    submit,
  ])

  const notice = mine.message || submit.message || localError
  const busy = mine.loading || submit.loading

  if (encounters && encounters.length === 0) {
    return (
      <VStack spacing={12}>
        {result && (
          <InlineBanner
            variant="success"
            content={result}
          />
        )}
        <EmptyState title="후기를 남길 밥약이 없어요" />
        <Text
          typo="13"
          color="text-neutral-light"
        >
          선배가 만남 완료를 누르면 여기에서 후기를 쓸 수 있어요.
        </Text>
      </VStack>
    )
  }

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        만남 후기
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

      {encounters && encounters.length > 1 && (
        <RadioGroup
          value={encounterId}
          onValueChange={setEncounterId}
        >
          {encounters.map((item) => (
            <Radio
              key={item.encounterId}
              value={item.encounterId}
            >
              {item.title}
            </Radio>
          ))}
        </RadioGroup>
      )}

      {selected && (
        <Text
          typo="13"
          color="text-neutral-light"
        >
          {selected.title}
          {selected.slotStart && selected.slotEnd
            ? ` · ${formatWindow(selected.slotStart, selected.slotEnd)}`
            : ''}
          {selected.place ? ` · ${selected.place}` : ''}
        </Text>
      )}

      <Divider />

      <Text
        typo="13"
        bold
      >
        별점
      </Text>
      <RadioGroup
        value={rating}
        direction="horizontal"
        onValueChange={setRating}
      >
        {RATINGS.map((value) => (
          <Radio
            key={value}
            value={String(value)}
          >
            {value}
          </Radio>
        ))}
      </RadioGroup>

      <TextArea
        placeholder={`어떤 도움이 됐는지 ${MIN_REVIEW_LENGTH}자 이상 남겨 주세요`}
        value={reviewText}
        minRows={3}
        maxRows={6}
        maxLength={1000}
        onChange={(event) => setReviewText(event.target.value)}
      />
      <Text
        typo="13"
        color="text-neutral-light"
      >
        {reviewText.trim().length}/{MIN_REVIEW_LENGTH}자
      </Text>

      <TextArea
        placeholder="같은 고민을 하는 새내기에게 남길 내 답 (선택)"
        value={selfAnswer}
        minRows={3}
        maxRows={6}
        maxLength={1000}
        onChange={(event) => setSelfAnswer(event.target.value)}
      />

      <Checkbox
        checked={shareConsent}
        onCheckedChange={(checked) => setShareConsent(checked === true)}
      >
        선배 도감과 라운지에 내 별명이 보여도 괜찮아요
      </Checkbox>

      <HStack justify="end">
        <Button
          variant="filled"
          semantic="primary"
          label="후기 남기기"
          disabled={busy || !encounterId}
          onClick={() => void handleSubmit()}
        />
      </HStack>
    </VStack>
  )
}

export default Review
