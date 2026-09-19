import { useCallback, useState } from 'react'
import {
  FUNCTIONS,
  type AccountMeOutput,
  type Role as AccountRole,
  type UpgradeStatusOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Badge, Notice, Section } from '../ui'
import { formatDayTime } from '../utils/datetime'

type AccountMe = AccountMeOutput
type UpgradeStatus = UpgradeStatusOutput

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
  const me = useFunctionData<AccountMe>(FUNCTIONS.accountMe, {}, session)
  const upgrade = useFunctionData<UpgradeStatus>(
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
        <button
          className="btn btn--ghost"
          type="button"
          disabled={me.loading}
          onClick={() => void me.reload()}
        >
          새로고침
        </button>
      }
    >
      {me.error && <Notice tone="error">{me.error}</Notice>}

      {me.data && (
        <dl className="kv">
          <dt>별명</dt>
          <dd>{me.data.user.nickname}</dd>
          <dt>학과</dt>
          <dd>{me.data.user.department ?? '미등록'}</dd>
          <dt>역할</dt>
          <dd>
            {me.data.roles.length === 0
              ? '후배'
              : me.data.roles.map((role: AccountRole) => (
                  <Badge key={role}>{role}</Badge>
                ))}
          </dd>
          <dt>업그레이드</dt>
          <dd>{STATUS_LABEL[status] ?? status}</dd>
        </dl>
      )}

      {upgrade.data?.reason && (
        <Notice tone="error">사유: {upgrade.data.reason}</Notice>
      )}

      {status === 'approved' && upgrade.data?.linkCode && (
        <Notice tone="success">
          연결 코드 <strong>{upgrade.data.linkCode}</strong>
          {upgrade.data.codeExpiresAt &&
            ` · ${formatDayTime(upgrade.data.codeExpiresAt)} 까지`}
          <br />
          선배 화면으로 바꾼 뒤 ‘선배 설정’ 탭에서 입력하면 연결돼요.
        </Notice>
      )}

      {canApply && (
        <>
          <h3 className="sub">선배로 업그레이드</h3>
          <label className="field">
            <span>어떤 후배를 돕고 싶나요? ({MIN_INTRO_LENGTH}자 이상)</span>
            <textarea
              rows={3}
              value={intro}
              maxLength={300}
              onChange={(event) => setIntro(event.target.value)}
            />
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={agree}
              onChange={(event) => setAgree(event.target.checked)}
            />
            <span>약속한 밥약에 성실히 나가겠습니다</span>
          </label>

          {(localError || action.error) && (
            <Notice tone="error">{localError || action.error}</Notice>
          )}

          <div className="card__foot">
            <button
              className="btn"
              type="button"
              disabled={action.busy}
              onClick={() => void apply()}
            >
              {action.busy ? '신청 중…' : '업그레이드 신청'}
            </button>
          </div>
        </>
      )}

      {result && <Notice tone="success">{result}</Notice>}
    </Section>
  )
}

export default Account
