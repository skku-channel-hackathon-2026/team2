import { useCallback, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  ButtonGroup,
  Text,
  TextInput,
  TextArea,
  Divider,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  ENCOUNTER_FUNCTIONS,
  KNOWLEDGE_FUNCTIONS,
  FIELD_OPTIONS,
  type KnowledgeCard,
  type MeetType,
} from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

const MEET_TYPE_OPTIONS: { id: MeetType; label: string }[] = [
  { id: 'meal', label: '밥' },
  { id: 'cafe', label: '카페' },
  { id: 'online', label: '온라인' },
]

interface HelpmeProps {
  appId: string
}

function Helpme({ appId }: HelpmeProps) {
  const search = useAppFunction<{ items: KnowledgeCard[] }>(
    appId,
    KNOWLEDGE_FUNCTIONS.searchSimilar
  )
  const create = useAppFunction<{ encounterId: string; notifiedCount: number }>(
    appId,
    ENCOUNTER_FUNCTIONS.create
  )

  const [fieldId, setFieldId] = useState<string>(FIELD_OPTIONS[0].id)
  const [title, setTitle] = useState('')
  const [meetType, setMeetType] = useState<MeetType>('meal')
  const [maxSeniors, setMaxSeniors] = useState(1)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [items, setItems] = useState<KnowledgeCard[] | null>(null)
  const [searched, setSearched] = useState(false)
  const [created, setCreated] = useState<{
    encounterId: string
    notifiedCount: number
  } | null>(null)

  const canSearch = title.trim().length >= 5
  const canCreate =
    canSearch && startAt.trim().length > 0 && endAt.trim().length > 0

  const handleSearch = useCallback(async () => {
    setSearched(false)
    const result = await search.run({ text: title.trim(), fieldId })
    if (!result) return
    setItems(result.items)
    setSearched(true)
  }, [fieldId, search, title])

  const handleCreate = useCallback(async () => {
    const result = await create.run({
      title: title.trim(),
      fieldId,
      meetType,
      maxSeniors,
      windows: [{ startAt: startAt.trim(), endAt: endAt.trim() }],
    })
    if (result) setCreated(result)
  }, [create, endAt, fieldId, maxSeniors, meetType, startAt, title])

  const notice = search.message || create.message

  if (created) {
    return (
      <VStack spacing={12}>
        <Text
          typo="16"
          bold
        >
          신청 완료!
        </Text>
        <InlineBanner
          variant="success"
          content={
            created.notifiedCount > 0
              ? `선배 ${created.notifiedCount}명에게 알림을 보냈어요. /내밥약 에서 진행 상황을 확인하세요.`
              : '지금은 조건에 맞는 선배가 없어요. 잠시 후 다시 시도하거나 /내밥약 에서 확인해 주세요.'
          }
        />
      </VStack>
    )
  }

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        선배-도와줘요
      </Text>

      {notice && (
        <InlineBanner
          variant="error"
          content={notice}
        />
      )}

      <Text typo="13">분야</Text>
      <ButtonGroup>
        {FIELD_OPTIONS.map((field) => (
          <Button
            key={field.id}
            variant={fieldId === field.id ? 'filled' : 'outlined'}
            semantic="primary"
            label={field.label}
            onClick={() => setFieldId(field.id)}
          />
        ))}
      </ButtonGroup>

      <TextArea
        placeholder="궁금한 걸 적어 주세요 (5자 이상)"
        value={title}
        minRows={3}
        maxRows={6}
        onChange={(event) => setTitle(event.target.value)}
      />

      <Text typo="13">만남 방식</Text>
      <ButtonGroup>
        {MEET_TYPE_OPTIONS.map((option) => (
          <Button
            key={option.id}
            variant={meetType === option.id ? 'filled' : 'outlined'}
            semantic="primary"
            label={option.label}
            onClick={() => setMeetType(option.id)}
          />
        ))}
      </ButtonGroup>

      <Text typo="13">같이 만날 선배 수</Text>
      <ButtonGroup>
        {[1, 2, 3].map((n) => (
          <Button
            key={n}
            variant={maxSeniors === n ? 'filled' : 'outlined'}
            semantic="primary"
            label={String(n)}
            onClick={() => setMaxSeniors(n)}
          />
        ))}
      </ButtonGroup>

      <Text typo="13">가능한 시간대 (예: 2026-09-22T12:00)</Text>
      <HStack spacing={8}>
        <TextInput
          placeholder="시작"
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
        />
        <TextInput
          placeholder="끝"
          value={endAt}
          onChange={(event) => setEndAt(event.target.value)}
        />
      </HStack>

      <HStack justify="end">
        <Button
          variant="outlined"
          semantic="primary"
          label="비슷한 답 찾기"
          disabled={search.loading || !canSearch}
          onClick={() => void handleSearch()}
        />
      </HStack>

      {searched && (
        <VStack spacing={8}>
          {items && items.length > 0 ? (
            items.map((item) => (
              <VStack
                key={item.knowledgeId}
                spacing={2}
              >
                <Text
                  typo="13"
                  bold
                >
                  {item.questionTitle}
                </Text>
                <Text
                  typo="13"
                  color="text-neutral-light"
                >
                  {item.answerText}
                </Text>
              </VStack>
            ))
          ) : (
            <Text
              typo="13"
              color="text-neutral-light"
            >
              비슷한 답이 없어요. 선배를 만나볼까요?
            </Text>
          )}

          <Divider />

          <HStack justify="end">
            <Button
              variant="filled"
              semantic="primary"
              label="그래도 선배 만나기"
              disabled={create.loading || !canCreate}
              onClick={() => void handleCreate()}
            />
          </HStack>
        </VStack>
      )}
    </VStack>
  )
}

export default Helpme
