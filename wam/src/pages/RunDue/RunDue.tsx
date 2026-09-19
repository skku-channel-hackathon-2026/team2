import { useCallback, useState } from 'react'
import { VStack, HStack, Button, Text } from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import { FUNCTIONS } from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

interface RunSummary {
  processed: number
  sent: number
  failed: number
  skipped: number
}

interface RunDueProps {
  appId: string
}

function RunDue({ appId }: RunDueProps) {
  const run = useAppFunction<RunSummary>(appId, FUNCTIONS.jobsRunDue)
  const [summary, setSummary] = useState<RunSummary | null>(null)

  const handleRun = useCallback(async () => {
    const result = await run.run()
    if (result) setSummary(result)
  }, [run])

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        알림 실행
      </Text>
      <Text
        typo="13"
        color="text-neutral-light"
      >
        예약 시각이 지난 알림을 최대 20건 발송해요. 여러 번 눌러도 같은 알림이
        두 번 가지 않아요.
      </Text>

      {run.message && (
        <InlineBanner
          variant="error"
          content={run.message}
        />
      )}
      {summary && !run.message && (
        <InlineBanner
          variant="info"
          content={`처리 ${summary.processed}건 · 발송 ${summary.sent}건 · 실패 ${summary.failed}건 · 건너뜀 ${summary.skipped}건`}
        />
      )}

      <HStack justify="end">
        <Button
          variant="filled"
          semantic="primary"
          label="지금 실행"
          disabled={run.loading}
          onClick={() => void handleRun()}
        />
      </HStack>
    </VStack>
  )
}

export default RunDue
