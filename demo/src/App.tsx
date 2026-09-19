import { useCallback, useEffect, useState } from 'react'
import { COMMANDS } from '@tutorial/shared'

import { PERSONAS, type Persona } from './personas'
import { bootAs, fetchIdentity, runCommand, type BootState } from './channel'

const FRONT_COMMANDS = COMMANDS.filter((command) => command.scope === 'front')

/** The one command the whole product exists for; the rest are supporting. */
const PRIMARY_ID = 'helpme'

function App() {
  const [persona, setPersona] = useState<Persona>(PERSONAS[0])
  const [state, setState] = useState<BootState>({ status: 'idle' })

  const connect = useCallback(async (next: Persona, encoding?: 'raw') => {
    setState({ status: 'booting' })
    try {
      const identity = await fetchIdentity(next.id, encoding)
      setState(await bootAs(identity))
    } catch (error) {
      setState({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  useEffect(() => {
    void connect(persona)
  }, [connect, persona])

  const ready = state.status === 'booted'
  const primary = FRONT_COMMANDS.find((command) => command.id === PRIMARY_ID)

  return (
    <div className="page">
      <header className="bar">
        <div className="brand">
          <span className="brand__mark">GO</span>
          <span className="brand__name">후배 Go</span>
        </div>

        <label className="who">
          <span className={`dot dot--${state.status}`} />
          <select
            value={persona.id}
            onChange={(event) => {
              const next = PERSONAS.find(
                (item) => item.id === event.target.value
              )
              if (next) setPersona(next)
            }}
          >
            {PERSONAS.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name} · {item.cohort}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* The messenger is fixed-positioned by the SDK and fills the right slot. */}
      <div className="content">
        <aside className="guide">
          <h1>
            {persona.name.slice(1)}님,
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
                onClick={() => void connect(persona, 'raw')}
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
