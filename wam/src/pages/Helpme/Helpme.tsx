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
  Tag,
  Divider,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  ENCOUNTER_FUNCTIONS,
  KNOWLEDGE_FUNCTIONS,
  MEET_TYPE_LABEL,
  type EncounterCreateOutput,
  type EncounterFieldsOutput,
  type FieldOption,
  type KnowledgeCard,
  type MeetType,
  type SearchSimilarOutput,
} from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'
import { MAX_WINDOWS, buildWindowDays, type WindowOption } from './windows'

interface HelpmeProps {
  appId: string
}

const MIN_TITLE_LENGTH = 5
const MEET_TYPES: MeetType[] = ['meal', 'cafe', 'online']

type Step = 'ask' | 'similar' | 'request' | 'done'

function Helpme({ appId }: HelpmeProps) {
  const fields = useAppFunction<EncounterFieldsOutput>(
    appId,
    ENCOUNTER_FUNCTIONS.fields
  )
  const search = useAppFunction<SearchSimilarOutput>(
    appId,
    KNOWLEDGE_FUNCTIONS.searchSimilar
  )
  const create = useAppFunction<EncounterCreateOutput>(
    appId,
    ENCOUNTER_FUNCTIONS.create
  )

  const [step, setStep] = useState<Step>('ask')
  const [options, setOptions] = useState<FieldOption[]>([])
  const [title, setTitle] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [similar, setSimilar] = useState<KnowledgeCard[]>([])
  const [meetType, setMeetType] = useState<MeetType>('meal')
  const [maxSeniors, setMaxSeniors] = useState('1')
  const [picked, setPicked] = useState<string[]>([])
  const [result, setResult] = useState('')
  const [localError, setLocalError] = useState('')

  const days = useMemo(() => buildWindowDays(new Date()), [])
  const windowByKey = useMemo(() => {
    const map = new Map<string, WindowOption>()
    for (const day of days) {
      for (const option of day.options) map.set(option.key, option)
    }
    return map
  }, [days])

  useEffect(() => {
    void (async () => {
      const response = await fields.run()
      if (!response) return
      setOptions(response.fields)
      setFieldId((previous) => previous || (response.fields[0]?.id ?? ''))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAsk = useCallback(async () => {
    setLocalError('')
    if (title.trim().length < MIN_TITLE_LENGTH) {
      setLocalError(`질문은 ${MIN_TITLE_LENGTH}자 이상 써 주세요.`)
      return
    }
    if (!fieldId) {
      setLocalError('분야를 골라 주세요.')
      return
    }

    // 지식이 없거나 검색이 실패해도 밥약 신청은 막지 않는다.
    const response = await search.run({ text: title.trim(), fieldId })
    const items = response?.items ?? []
    setSimilar(items)
    setStep(items.length > 0 ? 'similar' : 'request')
  }, [fieldId, search, title])

  const toggleWindow = useCallback((key: string, checked: boolean) => {
    setLocalError('')
    setPicked((previous) => {
      if (!checked) return previous.filter((value) => value !== key)
      if (previous.length >= MAX_WINDOWS) return previous
      return [...previous, key]
    })
  }, [])

  const handleCreate = useCallback(async () => {
    setLocalError('')
    const windows = picked
      .map((key) => windowByKey.get(key))
      .filter((option): option is WindowOption => option !== undefined)
      .map((option) => ({ startAt: option.startAt, endAt: option.endAt }))

    if (windows.length === 0) {
      setLocalError('가능한 시간을 하나 이상 골라 주세요.')
      return
    }

    const response = await create.run({
      title: title.trim(),
      fieldId,
      meetType,
      maxSeniors: Number(maxSeniors),
      windows,
    })
    if (!response) return

    setResult(
      response.notifiedCount > 0
        ? `선배 ${response.notifiedCount}명에게 출현을 알렸어요! /내밥약 에서 진행 상황을 볼 수 있어요.`
        : '신청했어요. 지금은 맞는 선배가 없지만, 6시간 뒤 2차로 다시 찾아볼게요.'
    )
    setStep('done')
  }, [create, fieldId, maxSeniors, meetType, picked, title, windowByKey])

  const notice =
    fields.message || search.message || create.message || localError
  const busy = fields.loading || search.loading || create.loading

  if (step === 'done') {
    return (
      <VStack spacing={12}>
        <InlineBanner
          variant="success"
          content={result}
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
        선배에게 물어보기
      </Text>

      {notice && (
        <InlineBanner
          variant="error"
          content={notice}
        />
      )}

      {step === 'ask' && (
        <>
          <TextArea
            placeholder="무엇이 궁금한가요? (예: 백엔드 인턴 지원 시기가 궁금해요)"
            value={title}
            minRows={3}
            maxRows={6}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Text
            typo="13"
            bold
          >
            분야
          </Text>
          <RadioGroup
            value={fieldId}
            onValueChange={setFieldId}
          >
            {options.map((option) => (
              <Radio
                key={option.id}
                value={option.id}
              >
                {option.label}
              </Radio>
            ))}
          </RadioGroup>
          <HStack justify="end">
            <Button
              variant="filled"
              semantic="primary"
              label="다음"
              disabled={busy}
              onClick={() => void handleAsk()}
            />
          </HStack>
        </>
      )}

      {step === 'similar' && (
        <>
          <Text typo="13">비슷한 질문에 선배들이 남긴 답이에요.</Text>
          {similar.map((card) => (
            <VStack
              key={card.knowledgeId}
              spacing={4}
            >
              <Divider />
              <Text
                typo="15"
                bold
              >
                {card.questionTitle}
              </Text>
              <Text typo="13">{card.answerText}</Text>
              {card.confirmedBySeniorAlias && (
                <Text
                  typo="13"
                  color="text-neutral-light"
                >
                  {card.confirmedBySeniorAlias} 선배 확인
                </Text>
              )}
            </VStack>
          ))}
          <Divider />
          <HStack
            spacing={6}
            justify="end"
          >
            <Button
              variant="outlined"
              semantic="secondary"
              label="해결됐어요"
              disabled={busy}
              onClick={() => {
                setResult('도움이 됐다니 다행이에요! 또 궁금하면 불러 주세요.')
                setStep('done')
              }}
            />
            <Button
              variant="filled"
              semantic="primary"
              label="선배를 만날래요"
              disabled={busy}
              onClick={() => setStep('request')}
            />
          </HStack>
        </>
      )}

      {step === 'request' && (
        <>
          <Text
            typo="13"
            color="text-neutral-light"
          >
            {title.trim()}
          </Text>

          <Text
            typo="13"
            bold
          >
            만남 방식
          </Text>
          <RadioGroup
            value={meetType}
            direction="horizontal"
            onValueChange={(value) => setMeetType(value as MeetType)}
          >
            {MEET_TYPES.map((value) => (
              <Radio
                key={value}
                value={value}
              >
                {MEET_TYPE_LABEL[value]}
              </Radio>
            ))}
          </RadioGroup>

          <Text
            typo="13"
            bold
          >
            만나고 싶은 선배 수
          </Text>
          <RadioGroup
            value={maxSeniors}
            direction="horizontal"
            onValueChange={setMaxSeniors}
          >
            {['1', '2', '3'].map((value) => (
              <Radio
                key={value}
                value={value}
              >
                {value}명
              </Radio>
            ))}
          </RadioGroup>

          <HStack
            spacing={4}
            align="center"
          >
            <Text
              typo="13"
              bold
            >
              가능한 시간
            </Text>
            <Tag
              size="xs"
              variant={picked.length > 0 ? 'blue' : 'default'}
            >
              {picked.length}/{MAX_WINDOWS}
            </Tag>
          </HStack>

          {days.map((day) => (
            <VStack
              key={day.key}
              spacing={4}
            >
              <Text
                typo="13"
                color="text-neutral-light"
              >
                {day.label}
              </Text>
              {day.options.map((option) => (
                <HStack
                  key={option.key}
                  spacing={6}
                  align="center"
                >
                  <Checkbox
                    checked={picked.includes(option.key)}
                    onCheckedChange={(checked) =>
                      toggleWindow(option.key, checked === true)
                    }
                  />
                  <Text typo="13">{option.label}</Text>
                </HStack>
              ))}
            </VStack>
          ))}

          <HStack justify="end">
            <Button
              variant="filled"
              semantic="primary"
              label="밥약 신청"
              disabled={busy}
              onClick={() => void handleCreate()}
            />
          </HStack>
        </>
      )}
    </VStack>
  )
}

export default Helpme
