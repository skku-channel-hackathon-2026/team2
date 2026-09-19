import type { ReactNode } from 'react'
import {
  Avatar,
  Banner,
  Divider,
  HStack,
  ProgressBar,
  Spinner,
  Tag,
  Text,
  VStack,
} from '@channel.io/bezier-react/beta'
import {
  CheckCircleFilledIcon,
  ErrorTriangleFilledIcon,
  InfoFilledIcon,
} from '@channel.io/bezier-icons'

import { characterUrl } from './characters'

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <VStack spacing={16}>
      <HStack
        justify="between"
        align="center"
        spacing={12}
      >
        <Text
          as="h2"
          typo="24"
          bold
        >
          {title}
        </Text>
        {action}
      </HStack>
      {children}
    </VStack>
  )
}

const BANNER = {
  info: { variant: 'default', icon: InfoFilledIcon },
  error: { variant: 'red', icon: ErrorTriangleFilledIcon },
  success: { variant: 'green', icon: CheckCircleFilledIcon },
} as const

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'success'
  children: ReactNode
}) {
  const { variant, icon } = BANNER[tone]
  return (
    <Banner
      variant={variant}
      leadingIcon={icon}
      content={children}
    />
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <VStack
        spacing={4}
        align="center"
      >
        <Text
          typo="15"
          bold
        >
          {title}
        </Text>
        {hint && (
          <Text
            typo="13"
            color="text-neutral-light"
            align="center"
          >
            {hint}
          </Text>
        )}
      </VStack>
    </div>
  )
}

export type BadgeTone =
  | 'default'
  | 'blue'
  | 'cobalt'
  | 'teal'
  | 'green'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple'
  | 'yellow'
  | 'olive'
  | 'navy'

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <Tag
      size="xs"
      variant={tone}
    >
      {children}
    </Tag>
  )
}

export function Loading() {
  return (
    <div className="loading">
      <Spinner size="24" />
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <VStack spacing={2}>
        <Text
          typo="30"
          bold
        >
          {value}
        </Text>
        <Text
          typo="13"
          color="text-neutral-light"
        >
          {label}
        </Text>
      </VStack>
    </div>
  )
}

/**
 * A person's portrait. `seed` is a stable identity (a nickname), so the same
 * person keeps the same face across every tab and across the WAM.
 */
export function Portrait({
  seed,
  size = '36',
}: {
  seed: string
  size?: '24' | '30' | '36' | '42' | '48' | '72'
}) {
  return (
    <Avatar
      name={seed}
      avatarUrl={characterUrl(seed)}
      size={size}
    />
  )
}

export function Meter({ value }: { value: number }) {
  return (
    <ProgressBar
      width="100%"
      value={value}
      size="s"
    />
  )
}

export { Divider }

/** The desk WAM answers NOT_LINKED by naming a slash command; in the demo the
 *  same state is one tab away. */
export function NotLinked() {
  return (
    <Empty
      title="아직 선배로 연결되지 않았어요"
      hint="‘선배 설정’ 탭에서 연결 코드를 입력하면 선배 기능이 열려요."
    />
  )
}

/** Renders whichever of loading / error / empty applies, or the list. */
export function List<T>({
  resource,
  empty,
  children,
}: {
  resource: {
    data: T[] | null
    loading: boolean
    error: string | null
    errorType?: string | null
  }
  empty: ReactNode
  children: (items: T[]) => ReactNode
}) {
  if (resource.errorType === 'NOT_LINKED') return <NotLinked />
  if (resource.error) return <Notice tone="error">{resource.error}</Notice>
  if (!resource.data) return resource.loading ? <Loading /> : <>{empty}</>
  if (resource.data.length === 0) return <>{empty}</>
  return <>{children(resource.data)}</>
}
