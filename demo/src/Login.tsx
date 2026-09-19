import { useState, type FormEvent } from 'react'
import {
  Button,
  HStack,
  Text,
  TextInput,
  VStack,
} from '@channel.io/bezier-react/beta'

import type { Session } from './session'

interface LoginProps {
  busy: boolean
  error?: string
  onSubmit: (session: Session) => void
}

function Login({ busy, error, onSubmit }: LoginProps) {
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
    onSubmit({
      role: 'junior',
      name: name.trim(),
      studentId: studentId.trim(),
    })
  }

  const notice = localError || error

  return (
    <div className="login">
      <form
        className="login__card"
        onSubmit={submit}
      >
        <VStack spacing={16}>
          <HStack
            spacing={8}
            align="center"
          >
            <span className="brand__mark">GO</span>
            <Text
              typo="22"
              bold
            >
              새내기 Go
            </Text>
          </HStack>

          <Text
            typo="14"
            color="text-neutral-light"
          >
            학번으로 로그인하면 채널톡 상담 내역이 이어져요. 로그인 후에도
            위에서 역할을 바꿀 수 있어요.
          </Text>

          <VStack spacing={6}>
            <Text
              typo="13"
              color="text-neutral-light"
            >
              이름
            </Text>
            <TextInput
              size="m"
              value={name}
              maxLength={20}
              placeholder="김민서"
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </VStack>

          <VStack spacing={6}>
            <Text
              typo="13"
              color="text-neutral-light"
            >
              학번
            </Text>
            <TextInput
              size="m"
              value={studentId}
              maxLength={12}
              inputMode="numeric"
              placeholder="2024311234"
              autoComplete="off"
              onChange={(event) =>
                setStudentId(event.target.value.replace(/[^0-9]/g, ''))
              }
            />
          </VStack>

          {notice && (
            <Text
              typo="13"
              color="text-accent-red"
            >
              {notice}
            </Text>
          )}

          <Button
            as="button"
            type="submit"
            size="l"
            label={busy ? '연결 중…' : '로그인'}
            loading={busy}
          />

          <Text
            typo="12"
            color="text-neutral-lighter"
            align="center"
          >
            데모용 로그인이에요. 비밀번호는 확인하지 않아요.
          </Text>
        </VStack>
      </form>
    </div>
  )
}

export default Login
