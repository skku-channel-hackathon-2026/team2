import { Button, HStack, Text, VStack } from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
import { ANSWERS_FUNCTIONS, type AnswersListOutput } from '@tutorial/shared'

import type { Session } from '../session'
import { useFunctionData } from '../useFunction'
import { Badge, Empty, List, Portrait, Section } from '../ui'
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
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          leadingContent={RefreshIcon}
          label="새로고침"
          disabled={answers.loading}
          onClick={() => void answers.reload()}
        />
      }
    >
      <List
        resource={resource}
        empty={
          <Empty
            title="아직 받은 후기가 없어요"
            hint="새내기가 후기를 제출하면 여기에 쌓여요."
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
                      <Badge tone="cobalt">{card.fieldLabel}</Badge>
                      <Badge tone="yellow">만족도 {card.rating}/5</Badge>
                      <Badge>{card.juniorAlias}</Badge>
                    </HStack>

                    <Text
                      typo="15"
                      bold
                    >
                      {card.title}
                    </Text>
                    <Text typo="14">{card.reviewText}</Text>

                    {card.selfAnswer && (
                      <div className="quote">
                        <VStack spacing={4}>
                          <Text
                            typo="12"
                            bold
                            color="text-neutral-lighter"
                          >
                            새내기가 찾은 답
                          </Text>
                          <Text typo="13">{card.selfAnswer}</Text>
                        </VStack>
                      </div>
                    )}

                    <Text
                      typo="12"
                      color="text-neutral-lighter"
                    >
                      {formatDay(card.createdAt)}
                    </Text>
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

export default Answers
