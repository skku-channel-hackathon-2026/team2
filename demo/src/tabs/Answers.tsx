import { ANSWERS_FUNCTIONS, type AnswersListOutput } from '@tutorial/shared'

import type { Session } from '../session'
import { useFunctionData } from '../useFunction'
import { Badge, Empty, List, Section } from '../ui'
import { formatDay } from '../utils/datetime'

interface AnswersProps {
  session: Session
}

function Answers({ session }: AnswersProps) {
  const answers = useFunctionData<AnswersListOutput>(
    ANSWERS_FUNCTIONS.list,
    {},
    session
  )

  const items = answers.data?.items ?? []
  const resource = { ...answers, data: answers.data ? items : null }

  return (
    <Section
      title="내가 도운 질문"
      action={
        <button
          className="btn btn--ghost"
          type="button"
          disabled={answers.loading}
          onClick={() => void answers.reload()}
        >
          새로고침
        </button>
      }
    >
      <List
        resource={resource}
        empty={
          <Empty
            title="아직 받은 후기가 없어요"
            hint="후배가 후기를 제출하면 여기에 쌓여요."
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
                  <Badge tone="orange">{'★'.repeat(card.rating)}</Badge>
                  <Badge>{card.juniorAlias}</Badge>
                </div>

                <h3 className="card__title">{card.title}</h3>
                <p className="card__body">{card.reviewText}</p>

                {card.selfAnswer && (
                  <div className="quote">
                    <span className="quote__label">후배가 찾은 답</span>
                    <p>{card.selfAnswer}</p>
                  </div>
                )}

                <p className="card__hint">{formatDay(card.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </List>
    </Section>
  )
}

export default Answers
