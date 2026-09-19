import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Text,
  TextInput,
  Divider,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import { FUNCTIONS, type Role, type UpgradeStatus } from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

interface MeResult {
  user: {
    id: string
    nickname: string
    department: string | null
    cohortYear: number | null
  }
  roles: Role[]
  upgrade: { status: UpgradeStatus; reason?: string }
}

const ROLE_LABEL: Record<Role, string> = {
  junior: '새내기',
  senior: '선배',
  staff: '운영진',
}

const STATUS_LABEL: Record<UpgradeStatus, string> = {
  none: '신청 없음',
  requested: '승인 대기 중',
  approved: '승인됨 — 연결 코드를 확인하세요',
  linked: '선배 연결 완료',
  rejected: '반려됨',
  expired: '코드 만료 — 재발급이 필요해요',
}

interface MeProps {
  appId: string
}

function Me({ appId }: MeProps) {
  const load = useAppFunction<MeResult>(appId, FUNCTIONS.accountMe)
  const save = useAppFunction<{ ok: boolean }>(
    appId,
    FUNCTIONS.accountUpsertProfile
  )

  const [me, setMe] = useState<MeResult | null>(null)
  const [nickname, setNickname] = useState('')
  const [department, setDepartment] = useState('')
  const [cohortYear, setCohortYear] = useState('')
  const [saved, setSaved] = useState(false)

  const refresh = useCallback(async () => {
    const result = await load.run()
    if (!result) return
    setMe(result)
    setNickname(result.user.nickname)
    setDepartment(result.user.department ?? '')
    setCohortYear(result.user.cohortYear ? String(result.user.cohortYear) : '')
  }, [load])

  useEffect(() => {
    void refresh()
    // The profile is loaded once when the WAM opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = useCallback(async () => {
    setSaved(false)
    const parsedYear = Number.parseInt(cohortYear, 10)
    const result = await save.run({
      nickname: nickname.trim(),
      ...(department.trim() ? { department: department.trim() } : {}),
      ...(Number.isFinite(parsedYear) ? { cohortYear: parsedYear } : {}),
    })
    if (result?.ok) {
      setSaved(true)
      await refresh()
    }
  }, [cohortYear, department, nickname, refresh, save])

  const busy = load.loading || save.loading
  const notice = load.message || save.message

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        내 정보
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
        placeholder="별명"
        value={nickname}
        maxLength={20}
        onChange={(event) => setNickname(event.target.value)}
      />
      <TextInput
        placeholder="학과 (선택)"
        value={department}
        maxLength={40}
        onChange={(event) => setDepartment(event.target.value)}
      />
      <TextInput
        placeholder="학번 연도 (선택, 예: 2023)"
        value={cohortYear}
        inputMode="numeric"
        maxLength={4}
        onChange={(event) =>
          setCohortYear(event.target.value.replace(/[^0-9]/g, ''))
        }
      />

      <HStack justify="end">
        <Button
          variant="filled"
          semantic="primary"
          label="저장"
          disabled={busy || nickname.trim().length === 0}
          onClick={() => void handleSave()}
        />
      </HStack>

      <Divider />

      <VStack spacing={4}>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          역할:{' '}
          {me?.roles.length
            ? me.roles.map((role) => ROLE_LABEL[role]).join(', ')
            : '새내기'}
        </Text>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          업그레이드: {me ? STATUS_LABEL[me.upgrade.status] : '불러오는 중'}
        </Text>
        {me?.upgrade.reason && (
          <Text
            typo="13"
            color="text-neutral-light"
          >
            사유: {me.upgrade.reason}
          </Text>
        )}
      </VStack>
    </VStack>
  )
}

export default Me
