import { VStack, Text } from '@channel.io/bezier-react/beta'
import { EmptyState } from '@channel.io/app-sdk-wam-ui'

interface SoonProps {
  commandName: string
}

function Soon({ commandName }: SoonProps) {
  return (
    <VStack spacing={12}>
      <EmptyState title={`${commandName} 준비 중이에요`} />
      <Text
        typo="13"
        color="text-neutral-light"
      >
        이 기능은 다음 단계에서 열려요. 지금은 /내정보 와 /선배로-업그레이드 를
        사용할 수 있어요.
      </Text>
    </VStack>
  )
}

export default Soon
