import { useCallback, useMemo, useState } from 'react'
import {
  ENCOUNTER_FUNCTIONS,
  KNOWLEDGE_FUNCTIONS,
  MEET_TYPE_LABEL,
  type EncounterCreateOutput,
  type EncounterFieldsOutput,
  type KnowledgeCard,
  type MeetType,
  type SearchSimilarOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Badge, Empty, Loading, Notice, Section } from '../ui'
import {
  MAX_WINDOWS,
  buildWindowDays,
  type WindowOption,
} from '../utils/windows'

const MIN_TITLE_LENGTH = 5
const MEET_TYPES: MeetType[] = ['meal', 'cafe', 'online']

type Step = 'ask' | 'similar' | 'request' | 'done'

interface AskProps {
  session: Session
  onCreated: () => void
}

function Ask({ session, onCreated }: AskProps) {
  const fields = useFunctionData<EncounterFieldsOutput>(
    ENCOUNTER_FUNCTIONS.fields,
    {},
    session
  )
  const action = useAction(session)

  const [step, setStep] = useState<Step>('ask')
  const [title, setTitle] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [similar, setSimilar] = useState<KnowledgeCard[]>([])
  const [meetType, setMeetType] = useState<MeetType>('meal')
  const [maxSeniors, setMaxSeniors] = useState(1)
  const [picked, setPicked] = useState<string[]>([])
  const [notified, setNotified] = useState(0)
  const [localError, setLocalError] = useState('')

  const days = useMemo(() => buildWindowDays(new Date()), [])
  const windowByKey = useMemo(() => {
    const map = new Map<string, WindowOption>()
    for (const day of days) {
      for (const option of day.options) map.set(option.key, option)
    }
    return map
  }, [days])

  const options = fields.data?.fields ?? []
  const chosenField = fieldId || options[0]?.id || ''

  const handleAsk = useCallback(async () => {
    setLocalError('')
    if (title.trim().length < MIN_TITLE_LENGTH) {
      setLocalError(`질문은 ${MIN_TITLE_LENGTH}자 이상 써 주세요.`)
      return
    }
    if (!chosenField) {
      setLocalError('분야를 골라 주세요.')
      return
    }

    // 지식이 없거나 검색이 실패해도 밥약 신청은 막지 않는다.
    let items: KnowledgeCard[] = []
    try {
      const response = (await action.run(KNOWLEDGE_FUNCTIONS.searchSimilar, {
        text: title.trim(),
        fieldId: chosenField,
      })) as SearchSimilarOutput
      items = response.items
    } catch {
      items = []
    }
    setSimilar(items)
    setStep(items.length > 0 ? 'similar' : 'request')
  }, [action, chosenField, title])

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

    try {
      const result = (await action.run(ENCOUNTER_FUNCTIONS.create, {
        title: title.trim(),
        fieldId: chosenField,
        meetType,
        maxSeniors,
        windows,
      })) as EncounterCreateOutput
      setNotified(result.notifiedCount)
      setStep('done')
      onCreated()
    } catch {
      // action.error already carries the message.
    }
  }, [
    action,
    chosenField,
    maxSeniors,
    meetType,
    onCreated,
    picked,
    title,
    windowByKey,
  ])

  const reset = () => {
    setStep('ask')
    setTitle('')
    setSimilar([])
    setPicked([])
    setNotified(0)
    setLocalError('')
    action.clearError()
  }

  if (step === 'done') {
    return (
      <Section title="신청 완료">
        <Notice tone="success">
          {notified > 0
            ? `조건이 맞는 선배 ${notified}명에게 출현 알림을 보냈어요.`
            : '지금은 조건이 맞는 선배가 없어요. 잠시 후 다음 웨이브에서 다시 찾아볼게요.'}
        </Notice>
        <p className="card__hint">
          진행 상황은 ‘내 밥약’ 탭에서 확인할 수 있어요.
        </p>
        <div className="card__foot">
          <button
            className="btn"
            type="button"
            onClick={reset}
          >
            다른 질문 하기
          </button>
        </div>
      </Section>
    )
  }

  return (
    <Section title="선배에게 물어보기">
      {fields.loading && <Loading />}
      {fields.error && <Notice tone="error">{fields.error}</Notice>}

      <label className="field">
        <span>무엇이 궁금한가요?</span>
        <textarea
          rows={3}
          value={title}
          maxLength={200}
          placeholder="예: 백엔드 동아리와 학회 중 1학년은 뭐가 나아요?"
          disabled={step !== 'ask'}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="field">
        <span>분야</span>
        <select
          value={chosenField}
          disabled={step !== 'ask'}
          onChange={(event) => setFieldId(event.target.value)}
        >
          {options.map((option) => (
            <option
              key={option.id}
              value={option.id}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {step === 'ask' && (
        <div className="card__foot">
          <button
            className="btn"
            type="button"
            disabled={action.busy || options.length === 0}
            onClick={() => void handleAsk()}
          >
            {action.busy ? '찾는 중…' : '비슷한 답 먼저 찾아보기'}
          </button>
        </div>
      )}

      {step === 'similar' && (
        <>
          <h3 className="sub">이미 나온 답이 있어요</h3>
          <ul className="cards">
            {similar.map((card) => (
              <li
                key={card.knowledgeId}
                className="card"
              >
                <h4 className="card__title">{card.questionTitle}</h4>
                <p className="card__body">{card.answerText}</p>
                {card.confirmedBySeniorAlias && (
                  <Badge tone="green">
                    {card.confirmedBySeniorAlias} 선배 확인
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          <div className="card__foot">
            <button
              className="btn"
              type="button"
              onClick={() => setStep('request')}
            >
              그래도 선배를 만나고 싶어요
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={reset}
            >
              해결됐어요
            </button>
          </div>
        </>
      )}

      {step === 'request' && (
        <>
          <h3 className="sub">어떻게 만날까요?</h3>
          <div className="chips">
            {MEET_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={meetType === type ? 'chip chip--on' : 'chip'}
                onClick={() => setMeetType(type)}
              >
                {MEET_TYPE_LABEL[type]}
              </button>
            ))}
          </div>

          <label className="field">
            <span>만날 선배 수</span>
            <select
              value={maxSeniors}
              onChange={(event) => setMaxSeniors(Number(event.target.value))}
            >
              {[1, 2, 3].map((count) => (
                <option
                  key={count}
                  value={count}
                >
                  {count}명
                </option>
              ))}
            </select>
          </label>

          <h3 className="sub">
            가능한 시간 (최대 {MAX_WINDOWS}개 · {picked.length}개 선택)
          </h3>
          {days.map((day) => (
            <div
              key={day.key}
              className="slots"
            >
              <span className="slots__day">{day.label}</span>
              <div className="chips">
                {day.options.map((option) => {
                  const on = picked.includes(option.key)
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={on ? 'chip chip--on' : 'chip'}
                      onClick={() => toggleWindow(option.key, !on)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="card__foot">
            <button
              className="btn"
              type="button"
              disabled={action.busy}
              onClick={() => void handleCreate()}
            >
              {action.busy ? '신청 중…' : '밥약 신청하기'}
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={reset}
            >
              처음부터
            </button>
          </div>
        </>
      )}

      {(localError || action.error) && (
        <Notice tone="error">{localError || action.error}</Notice>
      )}

      {step === 'ask' && options.length === 0 && !fields.loading && (
        <Empty
          title="분야를 불러오지 못했어요"
          hint="앱 서버(wrangler dev)가 떠 있는지 확인해 주세요."
        />
      )}
    </Section>
  )
}

export default Ask
