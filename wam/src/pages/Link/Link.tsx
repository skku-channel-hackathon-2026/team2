import { useCallback, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Text,
  TextInput,
} from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'
import { FUNCTIONS } from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'

interface LinkProps {
  appId: string
}

function Link({ appId }: LinkProps) {
  const link = useAppFunction<{ linked: boolean; userId: string }>(
    appId,
    FUNCTIONS.accountLinkManager
  )
  const [code, setCode] = useState('')
  const [linked, setLinked] = useState(false)

  const handleLink = useCallback(async () => {
    const result = await link.run({ code: code.trim().toUpperCase() })
    if (result?.linked) setLinked(true)
  }, [code, link])

  if (linked) {
    return (
      <VStack spacing={12}>
        <Text
          typo="16"
          bold
        >
          선배 계정이 연결됐어요
        </Text>
        <InlineBanner
          variant="success"
          content="이제 /선배등록 에서 분야와 가용 시간을 등록해 주세요."
        />
      </VStack>
    )
  }

  return (
    <VStack spacing={12}>
      <Text
        typo="16"
        bold
      >
        선배 시작하기
      </Text>
      <Text
        typo="13"
        color="text-neutral-light"
      >
        업그레이드 승인 시 받은 6자리 연결 코드를 입력해 주세요.
      </Text>

      {link.message && (
        <InlineBanner
          variant="error"
          content={link.message}
        />
      )}

      <TextInput
        placeholder="연결 코드"
        value={code}
        maxLength={12}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
      />

      <HStack justify="end">
        <Button
          variant="filled"
          semantic="primary"
          label="연결하기"
          disabled={link.loading || code.trim().length < 4}
          onClick={() => void handleLink()}
        />
      </HStack>
    </VStack>
  )
}

export default Link
