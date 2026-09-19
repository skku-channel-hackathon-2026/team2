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
  ENCOUNTER_FUNCTIONS,
  ENCOUNTER_STATUS_LABEL,
  type EncounterMineOutput,
  type EncounterStatus,
  type MyEncounterCard,
} from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'
import { formatWindow } from '../../utils/datetime'

interface MyBabProps {
  appId: string
}

const STATUS_VARIANT: Record<
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
      return '약속 시간에 만나요! 선배가 만남 완료를 누르면 후기를 쓸 수 있어요.'
    case 'met':
      return '/후기 에서 후기를 남기면 선배 도감에 등록돼요.'
    case 'expired':
      return '맞는 선배를 찾지 못했어요. 다시 신청해 보세요.'
    default:
      return null
  }
}

function MyBab({ appId }: MyBabProps) {
  const mine = useAppFunction<EncounterMineOutput>(
    appId,
    ENCOUNTER_FUNCTIONS.mine
  )
  const [items, setItems] = useState<MyEncounterCard[] | null>(null)

  const refresh = useCallback(async () => {
    const response = await mine.run()
    if (response) setItems(response.items)
  }, [mine])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (mine.message) {
    return (
      <InlineBanner
        variant="error"
        content={mine.message}
      />
    )
  }

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        내 밥약
      </Text>

      {items && items.length === 0 && (
        <VStack spacing={8}>
          <EmptyState title="아직 신청한 밥약이 없어요" />
          <Text
            typo="13"
            color="text-neutral-light"
          >
            /선배-도와줘요 에서 궁금한 것을 물어보면 시작돼요.
          </Text>
        </VStack>
      )}

      {(items ?? []).map((card) => (
        <VStack
          key={card.encounterId}
          spacing={6}
        >
          <Divider />
          <HStack
            spacing={4}
            align="center"
          >
            <Tag
              size="xs"
              variant={STATUS_VARIANT[card.status]}
            >
              {ENCOUNTER_STATUS_LABEL[card.status]}
            </Tag>
            <Tag
              size="xs"
              variant="default"
            >
              선배 {card.seniorsJoined}/{card.maxSeniors}명
            </Tag>
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
            {card.slotStart && card.slotEnd
              ? formatWindow(card.slotStart, card.slotEnd)
              : '일정 미정'}
            {card.place ? ` · ${card.place}` : ''}
          </Text>
          {hint(card) && <Text typo="13">{hint(card)}</Text>}
        </VStack>
      ))}
    </VStack>
  )
}

export default MyBab
