import { useCallback, useEffect, useState } from 'react'
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
import { Badge, Empty, List, Notice, Section } from '../ui'
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
              <h3 className="card__title">{senior.seniorAlias} 선배</h3>
              <Badge tone="green">친밀도 Lv.{senior.level}</Badge>
            </li>
          ))}
        </ul>
        <div className="card__foot">
          <button
            className="btn"
            type="button"
            onClick={() => {
              setCaughtBy(null)
              onSelect(null)
            }}
          >
            돌아가기
          </button>
        </div>
      </Section>
    )
  }

  if (target) {
    return (
      <Section title="후기 남기기">
        <p className="card__hint">{target.title}</p>

        <div className="field">
          <span>만족도</span>
          <div className="chips">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                className={rating === score ? 'chip chip--on' : 'chip'}
                onClick={() => setRating(score)}
              >
                {'★'.repeat(score)}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>어떤 만남이었나요? ({MIN_REVIEW_LENGTH}자 이상)</span>
          <textarea
            rows={4}
            value={reviewText}
            maxLength={1000}
            onChange={(event) => setReviewText(event.target.value)}
          />
        </label>

        <label className="field">
          <span>내가 찾은 답 (선택 · 확인을 거쳐 지식으로 쌓여요)</span>
          <textarea
            rows={3}
            value={selfAnswer}
            maxLength={1000}
            onChange={(event) => setSelfAnswer(event.target.value)}
          />
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={shareConsent}
            onChange={(event) => setShareConsent(event.target.checked)}
          />
          <span>내 별명을 선배 도감과 답변에 보여줘도 괜찮아요</span>
        </label>

        {(localError || action.error) && (
          <Notice tone="error">{localError || action.error}</Notice>
        )}

        <div className="card__foot">
          <button
            className="btn"
            type="button"
            disabled={action.busy}
            onClick={() => void submit()}
          >
            {action.busy ? '제출 중…' : '후기 제출'}
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => onSelect(null)}
          >
            취소
          </button>
        </div>
      </Section>
    )
  }

  return (
    <Section
      title="후기 대기"
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
                <h3 className="card__title">{card.title}</h3>
                <p className="card__hint">
                  {card.reviewDueAt
                    ? `${formatDayTime(card.reviewDueAt)} 까지`
                    : '기한 없음'}
                  {card.seniors.length > 0 &&
                    ` · ${card.seniors.map((senior) => senior.seniorAlias).join(', ')} 선배`}
                </p>
                <div className="card__foot">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => onSelect(card.encounterId)}
                  >
                    후기 쓰기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </List>
    </Section>
  )
}

export default Review
