import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Divider,
  Text,
  TextInput,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import { FUNCTIONS, WEEKDAY_LABELS, type SeniorStatus } from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'
import TimetableGrid from './TimetableGrid'
import { HOURS, cellKey } from './grid'

interface Slot {
  weekday: number
  startMinute: number
  endMinute: number
}

interface AvailabilityStatus {
  status: SeniorStatus
  pausedUntil: string | null
  statusNote: string | null
  availableNow: boolean
}

interface AvailabilityResult {
  linked: boolean
  registered: boolean
  availability: AvailabilityStatus
  slots: Slot[]
  totalMinutes: number
  weeklyLimitMinutes: number
  updatedAt: string | null
}

interface SlotsResult {
  slots: Slot[]
  totalMinutes: number
  updatedAt: string
}

interface AvailabilityProps {
  appId: string
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

function toTime(minute: number): string {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0')
  const rest = String(minute % 60).padStart(2, '0')
  return `${hour}:${rest}`
}

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

/** The grid is hourly, so each selected cell is one [hh:00, hh+1:00) range;
 *  the server merges contiguous ranges back into whole blocks. */
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

function describe(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hour === 0) return `${rest}분`
  return rest === 0 ? `${hour}시간` : `${hour}시간 ${rest}분`
}

function Availability({ appId }: AvailabilityProps) {
  const load = useAppFunction<AvailabilityResult>(
    appId,
    FUNCTIONS.availabilityGet
  )
  const saveStatus = useAppFunction<AvailabilityStatus>(
    appId,
    FUNCTIONS.availabilitySetStatus
  )
  const saveSlots = useAppFunction<SlotsResult>(
    appId,
    FUNCTIONS.availabilitySetSlots
  )

  const [data, setData] = useState<AvailabilityResult | null>(null)
  const [cells, setCells] = useState<Set<string>>(new Set())
  const [pausedUntil, setPausedUntil] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [dirty, setDirty] = useState(false)
  const [result, setResult] = useState('')

  const refresh = useCallback(async () => {
    const response = await load.run()
    if (!response) return
    setData(response)
    setCells(slotsToCells(response.slots))
    setPausedUntil(response.availability.pausedUntil ?? '')
    setStatusNote(response.availability.statusNote ?? '')
    setDirty(false)
  }, [load])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slots = useMemo(() => cellsToSlots(cells), [cells])
  const minutes = useMemo(
    () =>
      slots.reduce((sum, slot) => sum + slot.endMinute - slot.startMinute, 0),
    [slots]
  )

  const mutate = useCallback((next: (previous: Set<string>) => void) => {
    setResult('')
    setDirty(true)
    setCells((previous) => {
      const copy = new Set(previous)
      next(copy)
      return copy
    })
  }, [])

  const toggleCell = useCallback(
    (weekday: number, hour: number) =>
      mutate((copy) => {
        const key = cellKey(weekday, hour)
        if (copy.has(key)) copy.delete(key)
        else copy.add(key)
      }),
    [mutate]
  )

  const toggleColumn = useCallback(
    (weekday: number) =>
      mutate((copy) => {
        const keys = HOURS.map((hour) => cellKey(weekday, hour))
        const allOn = keys.every((key) => copy.has(key))
        for (const key of keys) {
          if (allOn) copy.delete(key)
          else copy.add(key)
        }
      }),
    [mutate]
  )

  const applyPreset = useCallback(
    (hours: number[]) =>
      mutate((copy) => {
        for (const weekday of [1, 2, 3, 4, 5]) {
          for (const hour of hours) copy.add(cellKey(weekday, hour))
        }
      }),
    [mutate]
  )

  const handleSaveSlots = useCallback(async () => {
    setResult('')
    const response = await saveSlots.run({ slots })
    if (!response) return
    setCells(slotsToCells(response.slots))
    setDirty(false)
    setResult(
      response.slots.length === 0
        ? '가능한 시간을 모두 비웠어요.'
        : `${response.slots.length}개 구간 (주 ${describe(response.totalMinutes)})으로 저장했어요.`
    )
    await refresh()
  }, [refresh, saveSlots, slots])

  const handleStatus = useCallback(
    async (status: SeniorStatus) => {
      setResult('')
      const response = await saveStatus.run({
        status,
        pausedUntil:
          status === 'paused' && pausedUntil.trim() ? pausedUntil.trim() : null,
        statusNote: statusNote.trim() ? statusNote.trim() : null,
      })
      if (!response) return
      setData((previous) =>
        previous ? { ...previous, availability: response } : previous
      )
      setResult(
        status === 'active'
          ? '밥약을 받는 중이에요.'
          : response.pausedUntil
            ? `${response.pausedUntil}까지 일시중지했어요.`
            : '일시중지했어요.'
      )
    },
    [pausedUntil, saveStatus, statusNote]
  )

  const notice = load.message || saveStatus.message || saveSlots.message
  const busy = load.loading || saveStatus.loading || saveSlots.loading

  if (data && !data.linked) {
    return (
      <VStack spacing={12}>
        <Text
          typo="16"
          bold
        >
          선배 연결이 필요해요
        </Text>
        <InlineBanner
          variant="info"
          content="/선배시작 에서 연결 코드를 입력한 뒤 이용할 수 있어요."
        />
      </VStack>
    )
  }

  const status = data?.availability

  return (
    <VStack spacing={12}>
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

      <HStack
        align="center"
        justify="between"
      >
        <VStack spacing={2}>
          <Text
            typo="16"
            bold
          >
            {status?.availableNow ? '밥약 받는 중' : '일시중지 중'}
          </Text>
          <Text
            typo="12"
            color="text-neutral-light"
          >
            {status?.availableNow
              ? '가능 시간표에 맞춰 출현 알림을 받아요.'
              : '출현 알림 대상에서 빠져 있어요.'}
          </Text>
        </VStack>
        <HStack spacing={4}>
          <Button
            variant={status?.status === 'active' ? 'filled' : 'outlined'}
            semantic="primary"
            label="받기"
            disabled={busy}
            onClick={() => void handleStatus('active')}
          />
          <Button
            variant={status?.status === 'paused' ? 'filled' : 'outlined'}
            semantic="secondary"
            label="일시중지"
            disabled={busy}
            onClick={() => void handleStatus('paused')}
          />
        </HStack>
      </HStack>

      <HStack spacing={4}>
        <TextInput
          placeholder="일시중지 종료일 (2026-10-05, 선택)"
          value={pausedUntil}
          maxLength={10}
          onChange={(event) => setPausedUntil(event.target.value)}
        />
        <TextInput
          placeholder="상태 메모 (선택)"
          value={statusNote}
          maxLength={80}
          onChange={(event) => setStatusNote(event.target.value)}
        />
      </HStack>

      <Divider />

      <HStack
        align="center"
        justify="between"
      >
        <Text
          typo="15"
          bold
        >
          가능한 시간
        </Text>
        <Text
          typo="12"
          color="text-neutral-light"
        >
          주 {describe(minutes)} · 상한{' '}
          {describe(data?.weeklyLimitMinutes ?? 0)}
        </Text>
      </HStack>

      <HStack spacing={4}>
        <Button
          size="s"
          variant="outlined"
          semantic="secondary"
          label="평일 점심"
          onClick={() => applyPreset([11, 12])}
        />
        <Button
          size="s"
          variant="outlined"
          semantic="secondary"
          label="평일 저녁"
          onClick={() => applyPreset([17, 18, 19])}
        />
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          label="전체 해제"
          onClick={() => mutate((copy) => copy.clear())}
        />
      </HStack>

      <TimetableGrid
        selected={cells}
        onToggle={toggleCell}
        onToggleColumn={toggleColumn}
      />

      <VStack spacing={2}>
        {slots.map((slot) => (
          <Text
            key={`${slot.weekday}-${slot.startMinute}`}
            typo="12"
            color="text-neutral-light"
          >
            {WEEKDAY_LABELS[slot.weekday]} {toTime(slot.startMinute)}~
            {toTime(slot.endMinute)}
          </Text>
        ))}
      </VStack>

      <HStack
        align="center"
        justify="between"
      >
        <Text
          typo="12"
          color="text-neutral-light"
        >
          {data?.updatedAt
            ? `마지막 저장 ${data.updatedAt.slice(0, 10)}`
            : '아직 저장한 시간표가 없어요'}
        </Text>
        <Button
          variant="filled"
          semantic="primary"
          label={dirty ? '변경사항 저장' : '저장'}
          disabled={busy || !dirty}
          onClick={() => void handleSaveSlots()}
        />
      </HStack>
    </VStack>
  )
}

export default Availability
