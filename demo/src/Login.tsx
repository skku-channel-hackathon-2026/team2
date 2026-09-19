import { useState, type FormEvent } from 'react'

import { ROLE_LABEL, type Role, type Session } from './session'

interface LoginProps {
  busy: boolean
  error?: string
  onSubmit: (session: Session) => void
}

const ROLES: Role[] = ['junior', 'senior']

const ROLE_HINT: Record<Role, string> = {
  junior: '질문하고 밥약을 신청해요',
  senior: '출현을 수락하고 도감을 채워요',
}

function Login({ busy, error, onSubmit }: LoginProps) {
  const [role, setRole] = useState<Role>('junior')
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [localError, setLocalError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setLocalError('')
    if (!name.trim()) return setLocalError('이름을 입력해 주세요.')
    if (!/^[0-9]{4,12}$/.test(studentId.trim())) {
      return setLocalError('학번은 숫자 4~12자리로 입력해 주세요.')
    }
    onSubmit({ role, name: name.trim(), studentId: studentId.trim() })
  }

  const notice = localError || error

  return (
    <div className="login">
      <form
        className="login__card"
        onSubmit={submit}
      >
        <div className="brand brand--lg">
          <span className="brand__mark">GO</span>
          <span className="brand__name">후배 Go</span>
        </div>
        <p className="login__lead">
          학번으로 로그인하면 채널톡 상담 내역이 이어져요. 로그인 후에도 위에서
          역할을 바꿀 수 있어요.
        </p>

        <div className="field">
          <span>어떤 화면으로 들어갈까요?</span>
          <div className="picks">
            {ROLES.map((value) => (
              <button
                key={value}
                type="button"
                className={role === value ? 'pick pick--on' : 'pick'}
                onClick={() => setRole(value)}
              >
                <strong>{ROLE_LABEL[value]}</strong>
                <span>{ROLE_HINT[value]}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>이름</span>
          <input
            value={name}
            maxLength={20}
            placeholder="김민서"
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="field">
          <span>학번</span>
          <input
            value={studentId}
            maxLength={12}
            inputMode="numeric"
            placeholder="2024311234"
            autoComplete="off"
            onChange={(event) =>
              setStudentId(event.target.value.replace(/[^0-9]/g, ''))
            }
          />
        </label>

        {notice && <p className="login__error">{notice}</p>}

        <button
          className="login__submit"
          type="submit"
          disabled={busy}
        >
          {busy ? '연결 중…' : '로그인'}
        </button>

        <p className="login__foot">
          데모용 로그인이에요. 비밀번호는 확인하지 않아요.
        </p>
      </form>
    </div>
  )
}

export default Login
