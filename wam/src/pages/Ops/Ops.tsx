import { useState } from 'react'
import {
  VStack,
  SegmentedControl,
  SegmentedControlItem,
} from '@channel.io/bezier-react/beta'

import UpgradeTab from './UpgradeTab'
import KnowledgeTab from './KnowledgeTab'

interface OpsProps {
  appId: string
}

type Tab = 'upgrade' | 'knowledge'

function Ops({ appId }: OpsProps) {
  const [tab, setTab] = useState<Tab>('upgrade')

  return (
    <VStack spacing={12}>
      <SegmentedControl
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
      >
        <SegmentedControlItem value="upgrade">업그레이드</SegmentedControlItem>
        <SegmentedControlItem value="knowledge">지식 검수</SegmentedControlItem>
      </SegmentedControl>

      {tab === 'upgrade' ? (
        <UpgradeTab appId={appId} />
      ) : (
        <KnowledgeTab appId={appId} />
      )}
    </VStack>
  )
}

export default Ops
