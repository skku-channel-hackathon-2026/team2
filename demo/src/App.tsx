import { useCallback, useEffect, useState } from 'react'
import { COMMANDS } from '@tutorial/shared'

import { PERSONAS, type Persona } from './personas'
import { bootAs, fetchIdentity, runCommand, type BootState } from './channel'

const FRONT_COMMANDS = COMMANDS.filter((command) => command.scope === 'front')

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

  return (
    <div className="page">
      <header className="bar">
        <div className="brand">
          <span className="brand__mark">GO</span>
          <span className="brand__name">후배 Go</span>
        </div>

        <nav className="commands">
          {FRONT_COMMANDS.map((command) => (
            <button
              key={command.id}
              className="commands__item"
              type="button"
              title={command.description}
              disabled={!ready}
              onClick={() => runCommand(command.name)}
            >
              /{command.name}
            </button>
          ))}
        </nav>

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

      {/* The messenger is fixed-positioned by the SDK; this reserves its slot. */}
      <main className="stage">
        {!ready && (
          <p className="stage__status">
            {state.status === 'failed'
              ? `연결 실패: ${state.error ?? '알 수 없는 오류'}`
              : '채널톡 메신저를 여는 중…'}
          </p>
        )}
        {state.status === 'failed' && (
          <button
            className="stage__retry"
            type="button"
            onClick={() => void connect(persona, 'raw')}
          >
            raw 시크릿으로 재시도
          </button>
        )}
      </main>
    </div>
  )
}

export default App
