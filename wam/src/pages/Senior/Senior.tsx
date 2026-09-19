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
import { FUNCTIONS, WEEKDAY_LABELS } from '@tutorial/shared'

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

function toTime(minute: number): string {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0')
  const rest = String(minute % 60).padStart(2, '0')
  return `${hour}:${rest}`
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

  /** `slots` and `status` are omitted on purpose: /가능시간 owns them. */
  const handleSave = useCallback(async () => {
    setSaved(false)
    setLocalError('')
    if (fieldIds.length === 0) {
      setLocalError('분야를 하나 이상 선택해 주세요.')
      return
    }
    const result = await save.run({
      weeklyLimitMinutes: Number(limit) || 0,
      fieldIds,
      ...(headline.trim() ? { headline: headline.trim() } : {}),
    })
    if (result?.ok) {
      setSaved(true)
      await refresh()
    }
  }, [fieldIds, headline, limit, refresh, save])

  const notice = load.message || save.message || localError
  const slots = data?.profile?.slots ?? []

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

      <TextInput
        placeholder="주간 상한 (분)"
        value={limit}
        inputMode="numeric"
        onChange={(event) =>
          setLimit(event.target.value.replace(/[^0-9]/g, ''))
        }
      />

      <Divider />

      <Text typo="13">가능한 시간</Text>
      {slots.length === 0 ? (
        <InlineBanner
          variant="info"
          content="/가능시간 에서 주간 시간표를 등록해 주세요."
        />
      ) : (
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
          <Text
            typo="12"
            color="text-neutral-light"
          >
            수정은 /가능시간 에서 할 수 있어요.
          </Text>
        </VStack>
      )}

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
