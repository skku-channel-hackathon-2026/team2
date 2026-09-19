import { useCallback, useState } from 'react'
import {
  FUNCTIONS,
  type UpgradeDecideOutput,
  type UpgradeListOutput,
  type UpgradeRequestCard,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Badge, Empty, List, Notice, Section } from '../ui'
import { formatDayTime } from '../utils/datetime'

type UpgradeList = UpgradeListOutput
type UpgradeDecide = UpgradeDecideOutput

interface OpsProps {
  session: Session
}

function Ops({ session }: OpsProps) {
  const requests = useFunctionData<UpgradeList>(
    FUNCTIONS.upgradeList,
    { status: 'requested' },
    session
  )
  const action = useAction(session)
  const [result, setResult] = useState<string | null>(null)

  const items = requests.data?.items ?? []
  const resource = { ...requests, data: requests.data ? items : null }

  const decide = useCallback(
    async (requestId: string, approve: boolean) => {
      setResult(null)
      try {
        const decided = (await action.run(FUNCTIONS.upgradeDecide, {
          requestId,
          approve,
        })) as UpgradeDecide

        setResult(
          approve
            ? `승인했어요. 연결 코드: ${decided.linkCode ?? '발급 실패'} (후배의 ‘내 정보’ 탭에서도 볼 수 있어요)`
            : '반려했어요.'
        )
        await requests.reload()
      } catch {
        // action.error already carries the message.
      }
    },
    [action, requests]
  )

  return (
    <Section
      title="업그레이드 승인"
      action={
        <button
          className="btn btn--ghost"
          type="button"
          disabled={requests.loading}
          onClick={() => void requests.reload()}
        >
          새로고침
        </button>
      }
    >
      {result && <Notice tone="success">{result}</Notice>}
      {action.error && <Notice tone="error">{action.error}</Notice>}

      <List
        resource={resource}
        empty={
          <Empty
            title="대기 중인 신청이 없어요"
            hint="후배 화면의 ‘내 정보’ 탭에서 업그레이드를 신청하면 여기에 떠요."
          />
        }
      >
        {(cards: UpgradeRequestCard[]) => (
          <ul className="cards">
            {cards.map((card) => (
              <li
                key={card.requestId}
                className="card"
              >
                <div className="card__head">
                  <Badge tone="blue">{card.nickname}</Badge>
                  {card.department && <Badge>{card.department}</Badge>}
                  {card.cohortYear && <Badge>{card.cohortYear}학번</Badge>}
                </div>

                <p className="card__body">{card.intro}</p>
                <p className="card__hint">{formatDayTime(card.createdAt)}</p>

                <div className="card__foot">
                  <button
                    className="btn"
                    type="button"
                    disabled={action.busy}
                    onClick={() => void decide(card.requestId, true)}
                  >
                    승인
                  </button>
                  <button
                    className="btn btn--ghost"
                    type="button"
                    disabled={action.busy}
                    onClick={() => void decide(card.requestId, false)}
                  >
                    반려
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </List>
    </Section>
  )
}

export default Ops
