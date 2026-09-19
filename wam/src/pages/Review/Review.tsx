import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  ButtonGroup,
  Text,
  TextArea,
  Checkbox,
  Divider,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  ENCOUNTER_FUNCTIONS,
  REVIEW_FUNCTIONS,
  type EncounterMineOutput,
  type MyEncounterCard,
  type SeniorCard,
} from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

interface ReviewProps {
  appId: string
}

function Review({ appId }: ReviewProps) {
  const mine = useAppFunction<EncounterMineOutput>(
    appId,
    ENCOUNTER_FUNCTIONS.mine
  )
  const submit = useAppFunction<{ caughtBy: SeniorCard[] }>(
    appId,
    REVIEW_FUNCTIONS.submit
  )

  const [pending, setPending] = useState<MyEncounterCard[] | null>(null)
  const [selected, setSelected] = useState<MyEncounterCard | null>(null)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [selfAnswer, setSelfAnswer] = useState('')
  const [shareConsent, setShareConsent] = useState(false)
  const [caughtBy, setCaughtBy] = useState<SeniorCard[] | null>(null)

  const refresh = useCallback(async () => {
    const result = await mine.run()
    if (!result) return
    setPending(result.items.filter((item) => item.status === 'met'))
  }, [mine])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!selected) return
    const result = await submit.run({
      encounterId: selected.encounterId,
      rating,
      reviewText: reviewText.trim(),
      ...(selfAnswer.trim() ? { selfAnswer: selfAnswer.trim() } : {}),
      shareConsent,
    })
    if (result) setCaughtBy(result.caughtBy)
  }, [rating, reviewText, selected, selfAnswer, shareConsent, submit])

  const notice = mine.message || submit.message

  if (caughtBy) {
    return (
      <VStack spacing={12}>
        <Text
          typo="16"
          bold
        >
          잡혔다! 🍚
        </Text>
        <InlineBanner
          variant="success"
          content={`${caughtBy.map((senior) => senior.seniorAlias).join(', ')} 선배의 도감에 등록됐어요.`}
        />
      </VStack>
    )
  }

  if (selected) {
    return (
      <VStack spacing={12}>
        <Text
          typo="16"
          bold
        >
          {selected.title}
        </Text>

        {notice && (
          <InlineBanner
            variant="error"
            content={notice}
          />
        )}

        <Text typo="13">별점</Text>
        <ButtonGroup>
          {[1, 2, 3, 4, 5].map((n) => (
            <Button
              key={n}
              variant={rating === n ? 'filled' : 'outlined'}
              semantic="primary"
              label={String(n)}
              onClick={() => setRating(n)}
            />
          ))}
        </ButtonGroup>

        <TextArea
          placeholder="후기를 남겨 주세요 (20자 이상)"
          value={reviewText}
          minRows={3}
          maxRows={6}
          onChange={(event) => setReviewText(event.target.value)}
        />
        <TextArea
          placeholder="처음 질문에 대한 내 답 (선택, 다음 후배를 위한 지식이 돼요)"
          value={selfAnswer}
          minRows={3}
          maxRows={6}
          onChange={(event) => setSelfAnswer(event.target.value)}
        />

        <HStack
          align="center"
          spacing={6}
        >
          <Checkbox
            checked={shareConsent}
            onCheckedChange={(checked) => setShareConsent(checked === true)}
          />
          <Text typo="13">
            선배 도감 공유 시 이 후기가 같이 보여도 괜찮아요.
          </Text>
        </HStack>

        <Divider />

        <HStack justify="end">
          <Button
            variant="filled"
            semantic="primary"
            label="제출하고 잡혀주기"
            disabled={submit.loading || reviewText.trim().length < 20}
            onClick={() => void handleSubmit()}
          />
        </HStack>
      </VStack>
    )
  }

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        후기
      </Text>

      {notice && (
        <InlineBanner
          variant="error"
          content={notice}
        />
      )}

      {pending && pending.length === 0 && (
        <InlineBanner
          variant="info"
          content="후기 남길 밥약이 없어요. 만남이 끝나면 여기 나타나요."
        />
      )}

      <VStack spacing={8}>
        {pending?.map((encounter) => (
          <HStack
            key={encounter.encounterId}
            justify="between"
            align="center"
          >
            <Text typo="13">{encounter.title}</Text>
            <Button
              variant="outlined"
              semantic="primary"
              label="후기 쓰기"
              onClick={() => setSelected(encounter)}
            />
          </HStack>
        ))}
      </VStack>
    </VStack>
  )
}

export default Review
