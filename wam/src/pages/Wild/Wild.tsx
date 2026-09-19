import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Text,
  TextInput,
  Tag,
  Radio,
  RadioGroup,
  Divider,
} from '@channel.io/bezier-react/beta'
import { EmptyState, InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  MEET_TYPE_LABEL,
  WILD_FUNCTIONS,
  type WildAcceptOutput,
  type WildCard,
  type WildListOutput,
} from '@tutorial/shared'

import Portrait from '../../components/Portrait'
import { useAppFunction } from '../../hooks/useAppFunction'
import { formatWindow } from '../../utils/datetime'

interface WildProps {
  appId: string
}

/**
 * The server decides who is first (encounter still `wild`); `seniorsJoined`
 * only tells the UI whether to ask for a slot up front. A wrong guess surfaces
 * as the server's SLOT_REQUIRED message instead of a silent failure.
 */
function needsSlot(card: WildCard): boolean {
  return card.seniorsJoined === 0
}

function Wild({ appId }: WildProps) {
  const list = useAppFunction<WildListOutput>(appId, WILD_FUNCTIONS.list)
  const accept = useAppFunction<WildAcceptOutput>(appId, WILD_FUNCTIONS.accept)

  const [items, setItems] = useState<WildCard[] | null>(null)
  const [slots, setSlots] = useState<Record<string, string>>({})
  const [places, setPlaces] = useState<Record<string, string>>({})
  const [result, setResult] = useState('')
  const [localError, setLocalError] = useState('')

  const refresh = useCallback(async () => {
    const response = await list.run()
    if (response) setItems(response.items)
  }, [list])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAccept = useCallback(
    async (card: WildCard) => {
      setResult('')
      setLocalError('')

      const chosen = slots[card.encounterId]
      if (needsSlot(card) && !chosen) {
        setLocalError('첫 수락자는 만날 시간을 골라야 해요.')
        return
      }

      const slot = card.overlapWindows.find(
        (window) => `${window.startAt}|${window.endAt}` === chosen
      )
      const place = places[card.encounterId]?.trim()

      const response = await accept.run({
        encounterId: card.encounterId,
        ...(slot ? { slot } : {}),
        ...(place ? { place } : {}),
      })
      if (!response) return

      setResult(
        `수락했어요! (${response.seniorsJoined}/${response.maxSeniors})` +
          (response.slotStart && response.slotEnd
            ? ` · ${formatWindow(response.slotStart, response.slotEnd)}`
            : '')
      )
      await refresh()
    },
    [accept, places, refresh, slots]
  )

  const notice = list.message || accept.message || localError
  const busy = list.loading || accept.loading

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        나에게 온 출현
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

      {items && items.length === 0 && (
        <EmptyState title="지금은 온 출현이 없어요" />
      )}

      {(items ?? []).map((card) => (
        <VStack
          key={card.encounterId}
          spacing={6}
        >
          <Divider />
          <Text
            typo="15"
            bold
          >
            {card.title}
          </Text>
          <HStack
            spacing={4}
            align="center"
          >
            <Tag
              size="xs"
              variant="olive"
            >
              {card.fieldLabel}
            </Tag>
            <Tag
              size="xs"
              variant="teal"
            >
              {MEET_TYPE_LABEL[card.meetType]}
            </Tag>
            <Tag
              size="xs"
              variant="default"
            >
              {card.seniorsJoined}/{card.maxSeniors}명
            </Tag>
          </HStack>
          <HStack
            spacing={6}
            align="center"
          >
            <Portrait
              seed={card.juniorAlias}
              size="24"
            />
            <Text
              typo="13"
              color="text-neutral-light"
            >
              새내기 {card.juniorAlias}
            </Text>
          </HStack>

          {card.overlapWindows.length === 0 ? (
            <InlineBanner
              variant="info"
              content="겹치는 시간이 없어요. /가능시간 에서 가능 시간을 넓혀 보세요."
            />
          ) : (
            <RadioGroup
              value={slots[card.encounterId] ?? ''}
              onValueChange={(value) =>
                setSlots((previous) => ({
                  ...previous,
                  [card.encounterId]: value,
                }))
              }
            >
              {card.overlapWindows.map((window) => {
                const value = `${window.startAt}|${window.endAt}`
                return (
                  <Radio
                    key={value}
                    value={value}
                  >
                    {formatWindow(window.startAt, window.endAt)}
                  </Radio>
                )
              })}
            </RadioGroup>
          )}

          {needsSlot(card) && (
            <TextInput
              placeholder="만날 장소 (선택)"
              value={places[card.encounterId] ?? ''}
              maxLength={100}
              onChange={(event) =>
                setPlaces((previous) => ({
                  ...previous,
                  [card.encounterId]: event.target.value,
                }))
              }
            />
          )}

          <HStack justify="end">
            <Button
              variant="filled"
              semantic="primary"
              label="수락"
              disabled={busy || card.overlapWindows.length === 0}
              onClick={() => void handleAccept(card)}
            />
          </HStack>
        </VStack>
      ))}
    </VStack>
  )
}

export default Wild
