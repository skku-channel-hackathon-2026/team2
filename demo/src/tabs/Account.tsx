import { useCallback, useState } from 'react'
import {
  Button,
  Checkbox,
  HStack,
  Text,
  TextArea,
  VStack,
} from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
import {
  FUNCTIONS,
  type AccountMeOutput,
  type Role as AccountRole,
  type UpgradeStatusOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Badge, Notice, Portrait, Section } from '../ui'
import { formatDayTime } from '../utils/datetime'

const STATUS_LABEL: Record<string, string> = {
  none: '신청 전',
  requested: '승인 대기',
  approved: '승인됨',
  linked: '선배 연결 완료',
  rejected: '반려됨',
  expired: '만료됨',
}

const MIN_INTRO_LENGTH = 10

interface AccountProps {
  session: Session
}

function Account({ session }: AccountProps) {
  const me = useFunctionData<AccountMeOutput>(FUNCTIONS.accountMe, {}, session)
  const upgrade = useFunctionData<UpgradeStatusOutput>(
    FUNCTIONS.upgradeStatus,
    {},
    session
  )
  const action = useAction(session)

  const [intro, setIntro] = useState('')
  const [agree, setAgree] = useState(false)
  const [localError, setLocalError] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const status = upgrade.data?.status ?? 'none'
  const canApply = status === 'none' || status === 'rejected'

  const apply = useCallback(async () => {
    setLocalError('')
    if (intro.trim().length < MIN_INTRO_LENGTH) {
      setLocalError(`소개를 ${MIN_INTRO_LENGTH}자 이상 써 주세요.`)
      return
    }
    if (!agree) {
      setLocalError('운영 규칙에 동의해 주세요.')
      return
    }

    try {
      await action.run(FUNCTIONS.upgradeRequest, {
        intro: intro.trim(),
        agreeRules: true,
      })
      setResult('신청했어요. 운영진이 승인하면 연결 코드를 받을 수 있어요.')
      setIntro('')
      setAgree(false)
      await upgrade.reload()
      await me.reload()
    } catch {
      // action.error already carries the message.
    }
  }, [action, agree, intro, me, upgrade])

  return (
    <Section
      title="내 정보"
      action={
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          leadingContent={RefreshIcon}
          label="새로고침"
          disabled={me.loading}
          onClick={() => void me.reload()}
        />
      }
    >
      {me.error && <Notice tone="error">{me.error}</Notice>}

      {me.data && (
        <div className="card">
          <HStack
            spacing={12}
            align="center"
          >
            <Portrait
              seed={me.data.user.nickname}
              size="48"
            />
            <VStack spacing={4}>
              <Text
                typo="16"
                bold
              >
                {me.data.user.nickname}
              </Text>
              <Text
                typo="13"
                color="text-neutral-light"
              >
                {me.data.user.department ?? '학과 미등록'} ·{' '}
                {STATUS_LABEL[status] ?? status}
              </Text>
              <HStack
                spacing={4}
                wrap
              >
                {me.data.roles.length === 0 ? (
                  <Badge>새내기</Badge>
                ) : (
                  me.data.roles.map((role: AccountRole) => (
                    <Badge
                      key={role}
                      tone={role === 'senior' ? 'green' : 'default'}
                    >
                      {role}
                    </Badge>
                  ))
                )}
              </HStack>
            </VStack>
          </HStack>
        </div>
      )}

      {upgrade.data?.reason && (
        <Notice tone="error">사유: {upgrade.data.reason}</Notice>
      )}

      {status === 'approved' && upgrade.data?.linkCode && (
        <Notice tone="success">
          연결 코드 {upgrade.data.linkCode}
          {upgrade.data.codeExpiresAt &&
            ` · ${formatDayTime(upgrade.data.codeExpiresAt)} 까지`}
          . 선배 화면으로 바꾼 뒤 ‘선배 설정’ 탭에서 입력하면 연결돼요.
        </Notice>
      )}

      {canApply && (
        <>
          <Text
            typo="15"
            bold
          >
            선배로 업그레이드
          </Text>

          <VStack spacing={6}>
            <Text
              typo="13"
              color="text-neutral-light"
            >
              어떤 새내기를 돕고 싶나요? ({MIN_INTRO_LENGTH}자 이상)
            </Text>
            <TextArea
              value={intro}
              maxLength={300}
              onChange={(event) => setIntro(event.target.value)}
            />
          </VStack>

          <Checkbox
            checked={agree}
            onCheckedChange={(checked) => setAgree(checked === true)}
          >
            약속한 밥약에 성실히 나가겠습니다
          </Checkbox>

          {(localError || action.error) && (
            <Notice tone="error">{localError || action.error}</Notice>
          )}

          <HStack>
            <Button
              size="m"
              label={action.busy ? '신청 중…' : '업그레이드 신청'}
              loading={action.busy}
              onClick={() => void apply()}
            />
          </HStack>
        </>
      )}

      {result && <Notice tone="success">{result}</Notice>}
    </Section>
  )
}

export default Account
