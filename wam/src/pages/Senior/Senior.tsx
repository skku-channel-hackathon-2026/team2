import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Text,
  TextInput,
  Checkbox,
  Divider,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import { FUNCTIONS } from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

interface Slot {
  weekday: number
  startMinute: number
  endMinute: number
}

interface Profile {
  headline: string | null
  portfolio: string | null
  weeklyLimitMinutes: number
  status: 'active' | 'paused'
  fieldIds: string[]
  slots: Slot[]
}

interface ProfileResult {
  linked: boolean
  profile: Profile | null
  fields: { id: string; label: string }[]
}

interface SeniorProps {
  appId: string
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function toTime(minute: number): string {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0')
  const rest = String(minute % 60).padStart(2, '0')
  return `${hour}:${rest}`
}

function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function Senior({ appId }: SeniorProps) {
  const load = useAppFunction<ProfileResult>(appId, FUNCTIONS.seniorGetProfile)
  const save = useAppFunction<{ ok: boolean }>(
    appId,
    FUNCTIONS.seniorUpsertProfile
  )

  const [data, setData] = useState<ProfileResult | null>(null)
  const [headline, setHeadline] = useState('')
  const [limit, setLimit] = useState('120')
  const [fieldIds, setFieldIds] = useState<string[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [weekday, setWeekday] = useState('1')
  const [start, setStart] = useState('12:00')
  const [end, setEnd] = useState('13:00')
  const [saved, setSaved] = useState(false)
  const [localError, setLocalError] = useState('')

  const refresh = useCallback(async () => {
    const result = await load.run()
    if (!result) return
    setData(result)
    if (result.profile) {
      setHeadline(result.profile.headline ?? '')
      setLimit(String(result.profile.weeklyLimitMinutes))
      setFieldIds(result.profile.fieldIds)
      setSlots(result.profile.slots)
    }
  }, [load])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleField = useCallback((id: string, checked: boolean) => {
    setFieldIds((previous) =>
      checked
        ? [...new Set([...previous, id])]
        : previous.filter((value) => value !== id)
    )
  }, [])

  const addSlot = useCallback(() => {
    setLocalError('')
    const startMinute = parseTime(start)
    const endMinute = parseTime(end)
    if (startMinute === null || endMinute === null) {
      setLocalError('시간은 HH:MM 형식으로 입력해 주세요.')
      return
    }
    if (endMinute <= startMinute) {
      setLocalError('종료 시간이 시작 시간보다 늦어야 해요.')
      return
    }
    setSlots((previous) => [
      ...previous,
      { weekday: Number(weekday), startMinute, endMinute },
    ])
  }, [end, start, weekday])

  const handleSave = useCallback(async () => {
    setSaved(false)
    setLocalError('')
    if (fieldIds.length === 0) {
      setLocalError('분야를 하나 이상 선택해 주세요.')
      return
    }
    const result = await save.run({
      weeklyLimitMinutes: Number(limit) || 0,
      status: 'active',
      fieldIds,
      slots,
      ...(headline.trim() ? { headline: headline.trim() } : {}),
    })
    if (result?.ok) {
      setSaved(true)
      await refresh()
    }
  }, [fieldIds, headline, limit, refresh, save, slots])

  const notice = load.message || save.message || localError

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

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        선배 등록
      </Text>

      {notice && (
        <InlineBanner
          variant="error"
          content={notice}
        />
      )}
      {saved && !notice && (
        <InlineBanner
          variant="success"
          content="저장했어요."
        />
      )}

      <TextInput
        placeholder="한 줄 소개 (선택)"
        value={headline}
        maxLength={60}
        onChange={(event) => setHeadline(event.target.value)}
      />

      <Text typo="13">도와줄 수 있는 분야</Text>
      <VStack spacing={4}>
        {(data?.fields ?? []).map((field) => (
          <HStack
            key={field.id}
            align="center"
            spacing={6}
          >
            <Checkbox
              checked={fieldIds.includes(field.id)}
              onCheckedChange={(checked) =>
                toggleField(field.id, checked === true)
              }
            />
            <Text typo="13">{field.label}</Text>
          </HStack>
        ))}
      </VStack>

      <Divider />

      <Text typo="13">가능한 시간</Text>
      <HStack spacing={4}>
        <TextInput
          placeholder="요일 0~6"
          value={weekday}
          maxLength={1}
          onChange={(event) =>
            setWeekday(event.target.value.replace(/[^0-6]/g, ''))
          }
        />
        <TextInput
          placeholder="12:00"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        <TextInput
          placeholder="13:00"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
        <Button
          variant="outlined"
          semantic="primary"
          label="추가"
          onClick={addSlot}
        />
      </HStack>

      <VStack spacing={2}>
        {slots.map((slot, index) => (
          <HStack
            key={`${slot.weekday}-${slot.startMinute}-${index}`}
            align="center"
            justify="between"
          >
            <Text
              typo="13"
              color="text-neutral-light"
            >
              {WEEKDAYS[slot.weekday]} {toTime(slot.startMinute)}~
              {toTime(slot.endMinute)}
            </Text>
            <Button
              variant="ghost"
              semantic="secondary"
              label="삭제"
              onClick={() =>
                setSlots((previous) =>
                  previous.filter((_, position) => position !== index)
                )
              }
            />
          </HStack>
        ))}
      </VStack>

      <Divider />

      <TextInput
        placeholder="주간 상한 (분)"
        value={limit}
        inputMode="numeric"
        onChange={(event) =>
          setLimit(event.target.value.replace(/[^0-9]/g, ''))
        }
      />

      <HStack justify="end">
        <Button
          variant="filled"
          semantic="primary"
          label="저장"
          disabled={save.loading}
          onClick={() => void handleSave()}
        />
      </HStack>
    </VStack>
  )
}

export default Senior
