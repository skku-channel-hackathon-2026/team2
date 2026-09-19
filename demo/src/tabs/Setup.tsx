import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  HStack,
  Text,
  TextInput,
  VStack,
} from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
import {
  FUNCTIONS,
  GRID_END_HOUR,
  GRID_START_HOUR,
  WEEKDAY_LABELS,
  type AvailabilityGetOutput,
  type FieldOption,
  type SeniorGetProfileOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Loading, Notice, Section, Stat } from '../ui'

type SeniorProfileResult = SeniorGetProfileOutput
type AvailabilityResult = AvailabilityGetOutput

interface Slot {
  weekday: number
  startMinute: number
  endMinute: number
}

const HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, index) => GRID_START_HOUR + index
)
const WEEKDAYS = WEEKDAY_LABELS.map((_, index) => index)

const cellKey = (weekday: number, hour: number) => `${weekday}-${hour}`

function slotsToCells(slots: Slot[]): Set<string> {
  const cells = new Set<string>()
  for (const slot of slots) {
    for (const hour of HOURS) {
      const start = hour * 60
      if (start >= slot.startMinute && start < slot.endMinute) {
        cells.add(cellKey(slot.weekday, hour))
      }
    }
  }
  return cells
}

/** Adjacent hours collapse into one slot so the 40-slot cap is not wasted. */
function cellsToSlots(cells: Set<string>): Slot[] {
  const slots: Slot[] = []
  for (const weekday of WEEKDAYS) {
    for (const hour of HOURS) {
      if (!cells.has(cellKey(weekday, hour))) continue
      const previous = slots[slots.length - 1]
      if (
        previous &&
        previous.weekday === weekday &&
        previous.endMinute === hour * 60
      ) {
        previous.endMinute = (hour + 1) * 60
        continue
      }
      slots.push({
        weekday,
        startMinute: hour * 60,
        endMinute: (hour + 1) * 60,
      })
    }
  }
  return slots
}

interface SetupProps {
  session: Session
  onLinked: () => void
}

function Setup({ session, onLinked }: SetupProps) {
  const profile = useFunctionData<SeniorProfileResult>(
    FUNCTIONS.seniorGetProfile,
    {},
    session
  )
  const action = useAction(session)

  const [code, setCode] = useState('')
  const [headline, setHeadline] = useState('')
  const [weeklyLimit, setWeeklyLimit] = useState(120)
  const [fieldIds, setFieldIds] = useState<string[]>([])
  const [cells, setCells] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<string | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const linked = profile.data?.linked === true

  // Seeds the form once per load; later edits stay under the user's control.
  useEffect(() => {
    const data = profile.data
    if (!data?.profile || loadedFor === session.studentId) return
    setHeadline(data.profile.headline ?? '')
    setWeeklyLimit(data.profile.weeklyLimitMinutes)
    setFieldIds(data.profile.fieldIds)
    setCells(slotsToCells(data.profile.slots))
    setLoadedFor(session.studentId)
  }, [loadedFor, profile.data, session.studentId])

  const slots = useMemo(() => cellsToSlots(cells), [cells])
  const minutes = slots.reduce(
    (sum, slot) => sum + slot.endMinute - slot.startMinute,
    0
  )

  const toggleCell = useCallback((weekday: number, hour: number) => {
    setResult(null)
    setCells((previous) => {
      const copy = new Set(previous)
      const key = cellKey(weekday, hour)
      if (copy.has(key)) copy.delete(key)
      else copy.add(key)
      return copy
    })
  }, [])

  const link = useCallback(async () => {
    setResult(null)
    try {
      await action.run(FUNCTIONS.accountLinkManager, { code: code.trim() })
      setResult('선배 계정이 연결됐어요.')
      setCode('')
      await profile.reload()
      onLinked()
    } catch {
      // action.error already carries the message.
    }
  }, [action, code, onLinked, profile])

  const save = useCallback(async () => {
    setResult(null)
    if (fieldIds.length === 0) {
      setResult(null)
      action.clearError()
      return setResult('분야를 하나 이상 골라 주세요.')
    }
    try {
      await action.run(FUNCTIONS.seniorUpsertProfile, {
        ...(headline.trim() ? { headline: headline.trim() } : {}),
        weeklyLimitMinutes: weeklyLimit,
        fieldIds,
        slots,
      })
      setResult('저장했어요. 이제 조건이 맞는 출현이 도착해요.')
      await profile.reload()
    } catch {
      // action.error already carries the message.
    }
  }, [action, fieldIds, headline, profile, slots, weeklyLimit])

  const availability = useFunctionData<AvailabilityResult>(
    FUNCTIONS.availabilityGet,
    {},
    session
  )

  if (profile.loading && !profile.data) {
    return (
      <Section title="선배 설정">
        <Loading />
      </Section>
    )
  }

  if (!linked) {
    return (
      <Section title="선배 계정 연결">
        <Notice>
          이 데모 계정은 아직 선배로 연결되지 않았어요. 새내기 화면에서 선배
          업그레이드를 신청하고 운영진이 승인하면 받는 연결 코드를 여기에 입력해
          주세요.
        </Notice>

        <VStack spacing={6}>
          <Text
            typo="13"
            color="text-neutral-light"
          >
            연결 코드
          </Text>
          <TextInput
            size="m"
            value={code}
            maxLength={12}
            placeholder="ABCD1234"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </VStack>

        {action.error && <Notice tone="error">{action.error}</Notice>}
        {result && <Notice tone="success">{result}</Notice>}

        <HStack>
          <Button
            size="m"
            label={action.busy ? '연결 중…' : '연결하기'}
            loading={action.busy}
            disabled={code.trim().length < 4}
            onClick={() => void link()}
          />
        </HStack>
      </Section>
    )
  }

  return (
    <Section
      title="선배 설정"
      action={
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          leadingContent={RefreshIcon}
          label="새로고침"
          disabled={profile.loading}
          onClick={() => void profile.reload()}
        />
      }
    >
      <div className="stats">
        <Stat
          label="주간 가능 시간"
          value={`${Math.round(minutes / 60)}시간`}
        />
        <Stat
          label="주간 상한"
          value={`${Math.round(weeklyLimit / 60)}시간`}
        />
        <Stat
          label="상태"
          value={
            availability.data?.availability.availableNow === false
              ? '일시 중지'
              : '가능'
          }
        />
      </div>

      <VStack spacing={6}>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          한 줄 소개
        </Text>
        <TextInput
          size="m"
          value={headline}
          maxLength={60}
          placeholder="백엔드 3년차, 동아리 회장 출신"
          onChange={(event) => setHeadline(event.target.value)}
        />
      </VStack>

      <VStack spacing={6}>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          도와줄 수 있는 분야
        </Text>
        <HStack
          spacing={4}
          wrap
        >
          {(profile.data?.fields ?? []).map((field: FieldOption) => {
            const on = fieldIds.includes(field.id)
            return (
              <Button
                key={field.id}
                size="s"
                variant={on ? 'filled' : 'outlined'}
                semantic="secondary"
                label={field.label}
                onClick={() =>
                  setFieldIds((previous) =>
                    on
                      ? previous.filter((id) => id !== field.id)
                      : [...previous, field.id]
                  )
                }
              />
            )
          })}
        </HStack>
      </VStack>

      <VStack spacing={6}>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          주간 상한
        </Text>
        <HStack
          spacing={4}
          wrap
        >
          {[60, 120, 180, 300, 600].map((value) => (
            <Button
              key={value}
              size="s"
              variant={weeklyLimit === value ? 'filled' : 'outlined'}
              semantic="secondary"
              label={`${value / 60}시간`}
              onClick={() => setWeeklyLimit(value)}
            />
          ))}
        </HStack>
      </VStack>

      <VStack spacing={6}>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          주간 가능 시간표 (월요일부터)
        </Text>
        <div className="grid">
          <div className="grid__row grid__row--head">
            <span className="grid__hour" />
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="grid__day"
              >
                {label}
              </span>
            ))}
          </div>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid__row"
            >
              <span className="grid__hour">{hour}</span>
              {WEEKDAYS.map((weekday) => (
                <button
                  key={weekday}
                  type="button"
                  aria-label={`${WEEKDAY_LABELS[weekday]} ${hour}시`}
                  className={
                    cells.has(cellKey(weekday, hour))
                      ? 'grid__cell grid__cell--on'
                      : 'grid__cell'
                  }
                  onClick={() => toggleCell(weekday, hour)}
                />
              ))}
            </div>
          ))}
        </div>
      </VStack>

      {action.error && <Notice tone="error">{action.error}</Notice>}
      {result && <Notice tone="success">{result}</Notice>}

      <HStack>
        <Button
          size="m"
          label={action.busy ? '저장 중…' : '저장'}
          loading={action.busy}
          onClick={() => void save()}
        />
      </HStack>
    </Section>
  )
}

export default Setup
