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
import Helpme from './pages/Helpme'
import MyBab from './pages/MyBab'
import Wild from './pages/Wild'
import Balls from './pages/Balls'
import Dex from './pages/Dex'
import Review from './pages/Review'
import Answers from './pages/Answers'
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
    case 'helpme':
      return <Helpme appId={data.appId} />
    case 'mybab':
      return <MyBab appId={data.appId} />
    case 'wild':
      return <Wild appId={data.appId} />
    case 'balls':
      return <Balls appId={data.appId} />
    case 'dex':
      return <Dex appId={data.appId} />
    case 'review':
      return <Review appId={data.appId} />
    case 'answers':
      return <Answers appId={data.appId} />
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
          title={data?.commandName ?? '새내기 Go'}
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
