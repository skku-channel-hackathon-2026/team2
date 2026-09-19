import { useCallback, useEffect, useState } from 'react'
import { COMMANDS } from '@tutorial/shared'

import Login from './Login'
import {
  bootAs,
  fetchIdentity,
  runCommand,
  signOut,
  type BootState,
} from './channel'
import {
  clearSession,
  readSession,
  writeSession,
  type Session,
} from './session'

const FRONT_COMMANDS = COMMANDS.filter((command) => command.scope === 'front')

/** The one command the whole product exists for; the rest are supporting. */
const PRIMARY_ID = 'helpme'

function App() {
  const [session, setSession] = useState<Session | null>(readSession)
  const [state, setState] = useState<BootState>({ status: 'idle' })

  const connect = useCallback(async (next: Session, encoding?: 'raw') => {
    setState({ status: 'booting' })
    try {
      const identity = await fetchIdentity(next, encoding)
      const result = await bootAs(identity)
      setState(result)
      if (result.status === 'booted') writeSession(next)
    } catch (error) {
      setState({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  useEffect(() => {
    if (session) void connect(session)
  }, [connect, session])

  const handleSignOut = useCallback(() => {
    signOut()
    clearSession()
    setSession(null)
    setState({ status: 'idle' })
  }, [])

  if (!session) {
    return (
      <Login
        busy={state.status === 'booting'}
        error={state.status === 'failed' ? state.error : undefined}
        onSubmit={setSession}
      />
    )
  }

  const ready = state.status === 'booted'
  const primary = FRONT_COMMANDS.find((command) => command.id === PRIMARY_ID)

  return (
    <div className="page">
      <header className="bar">
        <div className="brand">
          <span className="brand__mark">GO</span>
          <span className="brand__name">후배 Go</span>
        </div>

        <div className="who">
          <span className={`dot dot--${state.status}`} />
          <span className="who__name">
            {session.name} · {session.studentId.slice(0, 4)}학번
          </span>
          <button
            className="who__out"
            type="button"
            onClick={handleSignOut}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* The messenger is fixed-positioned by the SDK and fills the right slot. */}
      <div className="content">
        <aside className="guide">
          <h1>
            {session.name.slice(1)}님,
            <br />
            무엇이든 물어보세요
          </h1>
          <p className="guide__lead">
            학교생활·수강·진로 같은 일반적인 궁금증은 오른쪽 채팅에서 바로
            답변받을 수 있어요.
          </p>

          {primary && (
            <div className="callout">
              <span className="callout__badge">선배가 필요하신가요?</span>
              <p>
                채팅 입력창에 <code>/{primary.name}</code> 를 입력하면, 답을
                아는 선배에게 <strong>밥약을 요청</strong>해요.
              </p>
            </div>
          )}

          <p className="guide__label">쓸 수 있는 커맨드</p>
          <ul className="cmds">
            {FRONT_COMMANDS.map((command) => (
              <li key={command.id}>
                <button
                  type="button"
                  className={
                    command.id === PRIMARY_ID ? 'cmd cmd--primary' : 'cmd'
                  }
                  disabled={!ready}
                  onClick={() => runCommand(command.name)}
                >
                  <code>/{command.name}</code>
                  <span>{command.description}</span>
                </button>
              </li>
            ))}
          </ul>

          <p className="guide__foot">
            커맨드를 누르면 입력창에 자동으로 채워져요. Enter 를 누르면
            실행돼요.
          </p>

          {state.status === 'failed' && (
            <div className="error">
              <p>연결 실패: {state.error ?? '알 수 없는 오류'}</p>
              <button
                type="button"
                onClick={() => void connect(session, 'raw')}
              >
                raw 시크릿으로 재시도
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default App
