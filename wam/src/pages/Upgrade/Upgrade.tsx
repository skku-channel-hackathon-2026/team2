import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Text,
  TextInput,
  TextArea,
  Checkbox,
  Divider,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import { FUNCTIONS, type UpgradeStatus } from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

interface StatusResult {
  status: UpgradeStatus
  reason?: string
  inviteLink?: string
  inviteExpiresAt?: string
  linkCode?: string
  codeExpiresAt?: string
}

interface UpgradeProps {
  appId: string
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(parsed)
}

function Upgrade({ appId }: UpgradeProps) {
  const status = useAppFunction<StatusResult>(appId, FUNCTIONS.upgradeStatus)
  const submit = useAppFunction<{ requestId: string; status: UpgradeStatus }>(
    appId,
    FUNCTIONS.upgradeRequest
  )

  const [current, setCurrent] = useState<StatusResult | null>(null)
  const [intro, setIntro] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)

  const refresh = useCallback(async () => {
    const result = await status.run()
    if (result) setCurrent(result)
  }, [status])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = useCallback(async () => {
    const result = await submit.run({
      intro: intro.trim(),
      agreeRules: true,
      ...(email.trim() ? { email: email.trim() } : {}),
    })
    if (result) await refresh()
  }, [email, intro, refresh, submit])

  const notice = status.message || submit.message
  const state = current?.status ?? 'none'

  if (state === 'approved') {
    return (
      <VStack spacing={12}>
        <Text
          typo="16"
          bold
        >
          업그레이드가 승인됐어요
        </Text>
        <InlineBanner
          variant="success"
          content="아래 순서로 선배 계정을 연결해 주세요."
        />
        <VStack spacing={6}>
          <Text typo="13">1. 초대 링크로 채널 팀원으로 가입해요.</Text>
          <Text
            typo="13"
            color="text-neutral-light"
          >
            {current?.inviteLink ?? '초대 링크는 운영진에게 요청해 주세요.'}
          </Text>
          <Text typo="13">2. 데스크에서 /선배시작 을 실행해요.</Text>
          <Text typo="13">3. 아래 연결 코드를 입력해요.</Text>
        </VStack>
        <Divider />
        <Text
          typo="24"
          bold
        >
          {current?.linkCode ?? '------'}
        </Text>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          코드 만료: {formatDate(current?.codeExpiresAt) || '72시간 이내'}
        </Text>
      </VStack>
    )
  }

  if (state === 'requested') {
    return (
      <VStack spacing={12}>
        <Text
          typo="16"
          bold
        >
          승인을 기다리고 있어요
        </Text>
        <InlineBanner
          variant="info"
          content="운영진이 확인하면 이 화면에서 초대 링크와 연결 코드를 볼 수 있어요."
        />
      </VStack>
    )
  }

  if (state === 'linked') {
    return (
      <VStack spacing={12}>
        <Text
          typo="16"
          bold
        >
          이미 선배로 연결됐어요
        </Text>
        <Text typo="13">
          데스크에서 /선배등록 으로 분야와 시간을 등록해 주세요.
        </Text>
      </VStack>
    )
  }

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        선배로 업그레이드
      </Text>
      <Text
        typo="13"
        color="text-neutral-light"
      >
        밥약으로 후배를 도와줄 선배를 모집해요. 신청하면 운영진이 확인해요.
      </Text>

      {notice && (
        <InlineBanner
          variant="error"
          content={notice}
        />
      )}
      {state === 'rejected' && current?.reason && (
        <InlineBanner
          variant="info"
          content={`이전 신청 반려 사유: ${current.reason}`}
        />
      )}
      {state === 'expired' && (
        <InlineBanner
          variant="info"
          content="연결 코드가 만료됐어요. 다시 신청해 주세요."
        />
      )}

      <TextArea
        placeholder="한 줄 소개와 도와줄 수 있는 분야를 적어 주세요 (10자 이상)"
        value={intro}
        minRows={3}
        maxRows={6}
        onChange={(event) => setIntro(event.target.value)}
      />
      <TextInput
        placeholder="이메일 (선택)"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <HStack
        align="center"
        spacing={6}
      >
        <Checkbox
          checked={agree}
          onCheckedChange={(checked) => setAgree(checked === true)}
        />
        <Text typo="13">선배 수칙을 읽고 동의해요.</Text>
      </HStack>

      <HStack justify="end">
        <Button
          variant="filled"
          semantic="primary"
          label="신청하기"
          disabled={submit.loading || !agree || intro.trim().length < 10}
          onClick={() => void handleSubmit()}
        />
      </HStack>
    </VStack>
  )
}

export default Upgrade
