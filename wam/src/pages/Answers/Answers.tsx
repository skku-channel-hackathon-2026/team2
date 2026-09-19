import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Text,
  Tag,
  Divider,
} from '@channel.io/bezier-react/beta'
import { EmptyState, InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  ANSWERS_FUNCTIONS,
  type AnswerCard,
  type AnswersListOutput,
} from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'
import { formatDay } from '../../utils/datetime'

interface AnswersProps {
  appId: string
}

function Answers({ appId }: AnswersProps) {
  const list = useAppFunction<AnswersListOutput>(appId, ANSWERS_FUNCTIONS.list)
  const [items, setItems] = useState<AnswerCard[] | null>(null)

  const refresh = useCallback(async () => {
    const response = await list.run()
    if (response) setItems(response.items)
  }, [list])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (list.message) {
    return (
      <InlineBanner
        variant="error"
        content={list.message}
      />
    )
  }

  const withSelfAnswer = (items ?? []).filter((item) => item.selfAnswer)

  return (
    <VStack spacing={12}>
      <HStack
        spacing={6}
        align="center"
      >
        <Text
          typo="16"
          bold
        >
          내가 도운 질문
        </Text>
        {items && (
          <>
            <Tag
              size="s"
              variant="blue"
            >
              {items.length}건
            </Tag>
            {withSelfAnswer.length > 0 && (
              <Tag
                size="s"
                variant="green"
              >
                후배 답 {withSelfAnswer.length}
              </Tag>
            )}
          </>
        )}
      </HStack>

      {items && items.length === 0 && (
        <VStack spacing={8}>
          <EmptyState title="아직 받은 후기가 없어요" />
          <Text
            typo="13"
            color="text-neutral-light"
          >
            후배가 후기를 남기면 여기에서 볼 수 있어요.
          </Text>
        </VStack>
      )}

      {(items ?? []).map((item) => (
        <VStack
          key={item.encounterId}
          spacing={6}
        >
          <Divider />
          <Text
            typo="15"
            bold
          >
            {item.title}
          </Text>
          <HStack
            spacing={4}
            align="center"
          >
            <Tag
              size="xs"
              variant="olive"
            >
              {item.fieldLabel}
            </Tag>
            <Tag
              size="xs"
              variant="yellow"
            >
              별점 {item.rating}
            </Tag>
          </HStack>
          <Text typo="13">{item.reviewText}</Text>
          {item.selfAnswer && (
            <VStack spacing={2}>
              <Text
                typo="13"
                bold
              >
                후배가 남긴 답
              </Text>
              <Text typo="13">{item.selfAnswer}</Text>
            </VStack>
          )}
          <Text
            typo="13"
            color="text-neutral-light"
          >
            {item.juniorAlias} · {formatDay(item.createdAt)}
          </Text>
        </VStack>
      ))}
    </VStack>
  )
}

export default Answers
