import { useCallback, useEffect, useMemo, useState } from 'react'

import Login from './Login'
import { bootAs, fetchIdentity, shutdown, type BootState } from './channel'
import {
  clearSession,
  readSession,
  writeSession,
  ROLE_LABEL,
  type Role,
  type Session,
} from './session'
import Account from './tabs/Account'
import Answers from './tabs/Answers'
import Ask from './tabs/Ask'
import Balls from './tabs/Balls'
import Dex from './tabs/Dex'
import Meetings from './tabs/Meetings'
import Ops from './tabs/Ops'
import Review from './tabs/Review'
import Setup from './tabs/Setup'
import Wild from './tabs/Wild'

interface TabSpec {
  id: string
  label: string
}

const JUNIOR_TABS: TabSpec[] = [
  { id: 'meetings', label: '내 밥약' },
  { id: 'ask', label: '질문하기' },
  { id: 'review', label: '후기' },
  { id: 'account', label: '내 정보' },
]

const SENIOR_TABS: TabSpec[] = [
  { id: 'wild', label: '출현' },
  { id: 'balls', label: '포켓볼' },
  { id: 'dex', label: '도감' },
  { id: 'answers', label: '답변' },
  { id: 'setup', label: '선배 설정' },
  { id: 'ops', label: '운영' },
]

const TABS: Record<Role, TabSpec[]> = {
  junior: JUNIOR_TABS,
  senior: SENIOR_TABS,
}

function App() {
  const [session, setSession] = useState<Session | null>(readSession)
  const [state, setState] = useState<BootState>({ status: 'idle' })
  // A restored session can be either role, so the first tab follows it.
  const [tab, setTab] = useState(
    () => TABS[readSession()?.role ?? 'junior'][0].id
  )
  const [reviewTarget, setReviewTarget] = useState<string | null>(null)
  // Bumping this remounts the active tab, which is how a cross-tab action
  // (accepting an encounter, submitting a review) refreshes what it changed.
  const [revision, setRevision] = useState(0)

  const role = session?.role ?? 'junior'
  const tabs = TABS[role]

  // Only the 후배 surface is a customer surface; the messenger has no place on
  // the desk-side view.
  useEffect(() => {
    if (!session) return
    if (session.role !== 'junior') {
      shutdown()
      setState({ status: 'idle' })
      return
    }

    let cancelled = false
    setState({ status: 'booting' })
    void (async () => {
      try {
        const identity = await fetchIdentity(session)
        const result = await bootAs(identity)
        if (!cancelled) setState(result)
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  const signIn = useCallback((next: Session) => {
    writeSession(next)
    setSession(next)
    setTab(TABS[next.role][0].id)
  }, [])

  const switchRole = useCallback(
    (next: Role) => {
      if (!session || session.role === next) return
      const updated = { ...session, role: next }
      writeSession(updated)
      setSession(updated)
      setTab(TABS[next][0].id)
      setReviewTarget(null)
    },
    [session]
  )

  const signOut = useCallback(() => {
    shutdown()
    clearSession()
    setSession(null)
    setState({ status: 'idle' })
  }, [])

  const refreshAll = useCallback(() => setRevision((n) => n + 1), [])

  const openReview = useCallback((encounterId: string) => {
    setReviewTarget(encounterId)
    setTab('review')
  }, [])

  const panel = useMemo(() => {
    if (!session) return null
    switch (tab) {
      case 'meetings':
        return (
          <Meetings
            session={session}
            onAsk={() => setTab('ask')}
            onReview={openReview}
          />
        )
      case 'ask':
        return (
          <Ask
            session={session}
            onCreated={refreshAll}
          />
        )
      case 'review':
        return (
          <Review
            session={session}
            selected={reviewTarget}
            onSelect={setReviewTarget}
            onSubmitted={refreshAll}
          />
        )
      case 'account':
        return <Account session={session} />
      case 'wild':
        return (
          <Wild
            session={session}
            onAccepted={refreshAll}
          />
        )
      case 'balls':
        return (
          <Balls
            session={session}
            onChanged={refreshAll}
          />
        )
      case 'dex':
        return <Dex session={session} />
      case 'answers':
        return <Answers session={session} />
      case 'setup':
        return (
          <Setup
            session={session}
            onLinked={refreshAll}
          />
        )
      case 'ops':
        return <Ops session={session} />
      default:
        return null
    }
  }, [openReview, refreshAll, reviewTarget, session, tab])

  if (!session) {
    return (
      <Login
        busy={state.status === 'booting'}
        error={state.status === 'failed' ? state.error : undefined}
        onSubmit={signIn}
      />
    )
  }

  return (
    <div className={`page page--${role}`}>
      <header className="bar">
        <div className="brand">
          <span className="brand__mark">GO</span>
          <span className="brand__name">후배 Go</span>
        </div>

        <div className="who">
          <div className="roles">
            {(['junior', 'senior'] as Role[]).map((value) => (
              <button
                key={value}
                type="button"
                className={role === value ? 'role role--on' : 'role'}
                onClick={() => switchRole(value)}
              >
                {ROLE_LABEL[value]}
              </button>
            ))}
          </div>
          {role === 'junior' && <span className={`dot dot--${state.status}`} />}
          <span className="who__name">
            {session.name} · {session.studentId.slice(0, 4)}학번
          </span>
          <button
            className="who__out"
            type="button"
            onClick={signOut}
          >
            로그아웃
          </button>
        </div>
      </header>

      <nav className="tabs">
        <div className="tabs__inner">
          {tabs.map((spec) => (
            <button
              key={spec.id}
              type="button"
              className={tab === spec.id ? 'tab tab--on' : 'tab'}
              onClick={() => setTab(spec.id)}
            >
              {spec.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="content">
        <main className="workspace">
          <div key={`${role}-${tab}-${revision}`}>{panel}</div>

          {role === 'junior' && state.status === 'failed' && (
            <p className="notice notice--error">
              메신저 연결 실패: {state.error ?? '알 수 없는 오류'}. 탭 기능은
              그대로 쓸 수 있어요.
            </p>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
