import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { callFunction } from './api'
import type { Role, Session } from './session'

/**
 * A local stand-in for Channel's slash-command palette.
 *
 * It reads the real command list from `extension.command.metadata.getCommands`
 * and runs the real `actionFunctionName`, both through the signed `/demo-api/fn`
 * proxy — so what you see is the app server's actual registered payload and
 * actual action result, with Channel itself taken out of the loop.
 */

interface CommandConfig {
  name: string
  scope: 'desk' | 'front'
  description?: string
  actionFunctionName: string
  alfMode: 'disable' | 'recommend'
  alfDescription?: string
}

interface CommandResult {
  type: string
  attributes?: Record<string, unknown>
}

/** Channel shows front commands to customers and desk commands to managers. */
const SCOPE_OF: Record<Role, 'front' | 'desk'> = {
  junior: 'front',
  senior: 'desk',
}

const ROLE_LABEL: Record<Role, string> = {
  junior: '새내기 (고객 메신저)',
  senior: '선배 (팀챗 데스크)',
}

function personaFor(role: Role): Session {
  return role === 'senior'
    ? { role, name: '데모선배', studentId: '2019123456' }
    : { role, name: '데모후배', studentId: '2026123456' }
}

export function Palette() {
  const [role, setRole] = useState<Role>('senior')
  const [commands, setCommands] = useState<CommandConfig[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('/')
  const [selected, setSelected] = useState(0)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const persona = useMemo(() => personaFor(role), [role])

  useEffect(() => {
    let live = true
    setLoadError(null)
    callFunction<{ commands: CommandConfig[] }>(
      'extension.command.metadata.getCommands',
      {},
      persona
    )
      .then((data) => {
        if (live) setCommands(data.commands)
      })
      .catch((error: unknown) => {
        if (live)
          setLoadError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      live = false
    }
  }, [persona])

  const visible = useMemo(() => {
    const scope = SCOPE_OF[role]
    const typed = query.replace(/^\//, '').trim().toLowerCase()
    return (commands ?? [])
      .filter((command) => command.scope === scope)
      .filter((command) => command.name.toLowerCase().includes(typed))
  }, [commands, query, role])

  useEffect(() => setSelected(0), [query, role])

  async function run(command: CommandConfig) {
    setRunning(true)
    setRunError(null)
    setResult(null)
    try {
      const value = await callFunction<CommandResult>(
        command.actionFunctionName,
        {
          chat: {
            type: role === 'senior' ? 'group' : 'userChat',
            id: 'demo-chat',
          },
          input: {},
        },
        persona
      )
      setResult(value)
    } catch (error: unknown) {
      setRunError(error instanceof Error ? error.message : String(error))
    } finally {
      setRunning(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((n) => Math.min(n + 1, visible.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((n) => Math.max(n - 1, 0))
    } else if (event.key === 'Enter' && visible[selected]) {
      event.preventDefault()
      void run(visible[selected])
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>후배 Go · 슬래시 커맨드</h1>
        <p className="sub">
          앱 서버의 <code>getCommands</code> 응답을 그대로 읽어 실제 action
          Function을 호출해요. Channel 없이 로컬에서 동작합니다.
        </p>
      </header>

      <div className="roles">
        {(['senior', 'junior'] as Role[]).map((value) => (
          <button
            key={value}
            className={value === role ? 'role on' : 'role'}
            onClick={() => setRole(value)}
          >
            {ROLE_LABEL[value]}
            <span className="scope">scope: {SCOPE_OF[value]}</span>
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        className="input"
        value={query}
        autoFocus
        spellCheck={false}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label="슬래시 커맨드"
      />

      {loadError ? (
        <p className="error">
          커맨드 목록을 못 읽었어요: {loadError}
          <br />
          <span className="hint">
            로컬 워커가 떠 있어야 해요 —{' '}
            <code>pnpm exec wrangler dev --local --port 8797</code>
          </span>
        </p>
      ) : null}

      {commands === null && !loadError ? (
        <p className="hint">불러오는 중…</p>
      ) : null}

      <ul className="list">
        {visible.map((command, index) => (
          <li
            key={command.name}
            className={index === selected ? 'item on' : 'item'}
            onMouseEnter={() => setSelected(index)}
            onClick={() => void run(command)}
          >
            <span className="name">/{command.name}</span>
            <span className="desc">{command.description}</span>
            <span className="fn">{command.actionFunctionName}</span>
          </li>
        ))}
        {commands && visible.length === 0 ? (
          <li className="item empty">일치하는 커맨드가 없어요</li>
        ) : null}
      </ul>

      {running ? <p className="hint">실행 중…</p> : null}
      {runError ? <p className="error">실행 실패: {runError}</p> : null}

      {result ? (
        <section className="result">
          <h2>
            결과 <code>{result.type}</code>
          </h2>
          {result.type === 'wam' ? (
            <p className="wam">
              WAM <b>{String(result.attributes?.name)}</b> 열기 · screen{' '}
              <b>
                {String(
                  (
                    result.attributes?.wamArgs as
                      Record<string, unknown> | undefined
                  )?.screen
                )}
              </b>
            </p>
          ) : null}
          {result.type === 'text' ? (
            <pre className="text">{String(result.attributes?.message)}</pre>
          ) : null}
          <pre className="json">{JSON.stringify(result, null, 2)}</pre>
        </section>
      ) : null}

      <footer>
        {commands ? `${commands.length}개 커맨드 등록됨 · ` : ''}
        {SCOPE_OF[role]} scope {visible.length}개 표시
      </footer>

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #17171a; color: #e8e8ea;
         font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .sub { margin: 0 0 24px; color: #9a9aa2; font-size: 13px; }
  code { background: #232329; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .roles { display: flex; gap: 8px; margin-bottom: 16px; }
  .role { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px;
          background: #1e1e23; border: 1px solid #2c2c33; border-radius: 10px;
          color: #c9c9d1; cursor: pointer; text-align: left; font-size: 14px; }
  .role.on { border-color: #6b6bff; background: #23233a; color: #fff; }
  .scope { font-size: 11px; color: #8a8a94; }
  .input { width: 100%; box-sizing: border-box; padding: 14px 16px; font-size: 18px;
           background: #1e1e23; border: 1px solid #34343d; border-radius: 10px;
           color: #fff; outline: none; font-family: inherit; }
  .input:focus { border-color: #6b6bff; }
  .list { list-style: none; margin: 10px 0 0; padding: 0;
          border: 1px solid #2c2c33; border-radius: 10px; overflow: hidden; }
  .item { display: grid; grid-template-columns: 150px 1fr; gap: 2px 12px;
          padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #232329; }
  .item:last-child { border-bottom: none; }
  .item.on { background: #23233a; }
  .item.empty { display: block; color: #8a8a94; cursor: default; }
  .name { font-weight: 600; color: #fff; }
  .desc { color: #b4b4bd; font-size: 13px; }
  .fn { grid-column: 1 / -1; color: #7a7a86; font-size: 11px; font-family: ui-monospace, monospace; }
  .result { margin-top: 24px; }
  .result h2 { font-size: 14px; color: #9a9aa2; margin: 0 0 8px; }
  .wam { margin: 0 0 10px; }
  .text, .json { background: #1a1a1f; border: 1px solid #2c2c33; border-radius: 8px;
                 padding: 12px; font-size: 12px; overflow-x: auto; white-space: pre-wrap; }
  .error { color: #ff8f8f; font-size: 13px; }
  .hint { color: #8a8a94; font-size: 12px; }
  footer { margin-top: 28px; color: #6f6f79; font-size: 12px; }
`

const root = document.getElementById('root')
if (root) createRoot(root).render(<Palette />)
