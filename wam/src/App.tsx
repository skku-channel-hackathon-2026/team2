import {
  ErrorPage,
  HeightSynchronizer,
  WamHeader,
  WamThemeProvider,
} from '@channel.io/app-sdk-wam-ui'
import { useWamClose } from '@channel.io/app-sdk-wam'
import type { WamData } from '@tutorial/shared'

import { isMobile } from './utils/userAgent'
import { useWamContext } from './hooks/useWamContext'
import Me from './pages/Me'
import Upgrade from './pages/Upgrade'
import Link from './pages/Link'
import Senior from './pages/Senior'
import Availability from './pages/Availability'
import Ops from './pages/Ops'
import OpsConfig from './pages/OpsConfig'
import RunDue from './pages/RunDue'
import Soon from './pages/Soon'

function Screen({ data }: { data: WamData }) {
  switch (data.screen) {
    case 'me':
      return <Me appId={data.appId} />
    case 'upgrade':
      return <Upgrade appId={data.appId} />
    case 'link':
      return <Link appId={data.appId} />
    case 'senior':
      return <Senior appId={data.appId} />
    case 'availability':
      return <Availability appId={data.appId} />
    case 'ops':
      return <Ops appId={data.appId} />
    case 'opsconfig':
      return (
        <OpsConfig
          appId={data.appId}
          chatId={data.chatId}
          chatType={data.chatType}
        />
      )
    case 'rundue':
      return <RunDue appId={data.appId} />
    default:
      return <Soon commandName={data.commandName} />
  }
}

function App() {
  const { close } = useWamClose()
  const { data, error } = useWamContext()

  return (
    <WamThemeProvider>
      <HeightSynchronizer maxHeight={560}>
        <WamHeader
          title={data?.commandName ?? '후배 Go'}
          onClose={close}
        />
        <div style={{ padding: isMobile() ? '0 16px 16px' : '0 24px 24px' }}>
          {data ? (
            <Screen data={data} />
          ) : (
            <ErrorPage
              error={
                error?.message ??
                '화면을 열 수 없어요. 커맨드를 닫고 다시 실행해 주세요.'
              }
            />
          )}
        </div>
      </HeightSynchronizer>
    </WamThemeProvider>
  )
}

export default App
