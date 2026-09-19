import { useCallback, useState } from 'react'
import { Button, HStack, Text, VStack } from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
import {
  FUNCTIONS,
  type UpgradeDecideOutput,
  type UpgradeListOutput,
  type UpgradeRequestCard,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useAction, useFunctionData } from '../useFunction'
import { Badge, Empty, List, Notice, Portrait, Section } from '../ui'
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
            ? `승인했어요. 연결 코드: ${decided.linkCode ?? '발급 실패'} (새내기의 ‘내 정보’ 탭에서도 볼 수 있어요)`
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
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          leadingContent={RefreshIcon}
          label="새로고침"
          disabled={requests.loading}
          onClick={() => void requests.reload()}
        />
      }
    >
      {result && <Notice tone="success">{result}</Notice>}
      {action.error && <Notice tone="error">{action.error}</Notice>}

      <List
        resource={resource}
        empty={
          <Empty
            title="대기 중인 신청이 없어요"
            hint="새내기 화면의 ‘내 정보’ 탭에서 업그레이드를 신청하면 여기에 떠요."
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
                <div className="card__media">
                  <Portrait
                    seed={card.nickname}
                    size="42"
                  />

                  <VStack spacing={8}>
                    <HStack
                      spacing={4}
                      align="center"
                      wrap
                    >
                      <Badge tone="blue">{card.nickname}</Badge>
                      {card.department && <Badge>{card.department}</Badge>}
                      {card.cohortYear && <Badge>{card.cohortYear}학번</Badge>}
                    </HStack>

                    <Text typo="14">{card.intro}</Text>
                    <Text
                      typo="12"
                      color="text-neutral-lighter"
                    >
                      {formatDayTime(card.createdAt)}
                    </Text>

                    <HStack spacing={6}>
                      <Button
                        size="s"
                        label="승인"
                        disabled={action.busy}
                        onClick={() => void decide(card.requestId, true)}
                      />
                      <Button
                        size="s"
                        variant="outlined"
                        semantic="destructive"
                        label="반려"
                        disabled={action.busy}
                        onClick={() => void decide(card.requestId, false)}
                      />
                    </HStack>
                  </VStack>
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
