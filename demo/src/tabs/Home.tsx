import { COMMANDS } from '@tutorial/shared'
import { Text, VStack } from '@channel.io/bezier-react/beta'

import { runCommand } from '../channel'
import type { Session } from '../session'
import { Notice, Section } from '../ui'

const FRONT_COMMANDS = COMMANDS.filter((command) => command.scope === 'front')

/** The one command the whole product exists for; the rest are supporting. */
const PRIMARY_ID = 'helpme'

interface HomeProps {
  session: Session
  ready: boolean
}

function Home({ session, ready }: HomeProps) {
  const primary = FRONT_COMMANDS.find((command) => command.id === PRIMARY_ID)

  return (
    <Section title={`${session.name.slice(1)}님, 무엇이든 물어보세요`}>
      <div className="guide__hero">
        <VStack spacing={12}>
          <Text
            typo="15"
            color="text-neutral-light"
          >
            학교생활·수강·진로 같은 일반적인 궁금증은 오른쪽 채팅에서 바로
            답변받을 수 있어요.
          </Text>

          {primary && (
            <Notice tone="info">
              선배가 필요하신가요? 채팅 입력창에 /{primary.name} 를 입력하면,
              답을 아는 선배에게 밥약을 요청해요.
            </Notice>
          )}
        </VStack>
      </div>

      <VStack spacing={8}>
        <Text
          typo="13"
          bold
          color="text-neutral-light"
        >
          쓸 수 있는 커맨드
        </Text>

        <ul className="cmds">
          {FRONT_COMMANDS.map((command) => (
            <li key={command.id}>
              <button
                type="button"
                className="cmd"
                disabled={!ready}
                onClick={() => runCommand(command.name)}
              >
                <Text
                  typo="14"
                  bold
                  color={
                    command.id === PRIMARY_ID
                      ? 'text-accent-blue'
                      : 'text-neutral'
                  }
                >
                  /{command.name}
                </Text>
                <Text
                  typo="13"
                  color="text-neutral-light"
                >
                  {command.description}
                </Text>
              </button>
            </li>
          ))}
        </ul>

        <Text
          typo="12"
          color="text-neutral-lighter"
        >
          커맨드를 누르면 입력창에 자동으로 채워져요. Enter 를 누르면 실행돼요.
        </Text>
      </VStack>
    </Section>
  )
}

export default Home
