import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Text,
  Tag,
  Divider,
} from '@channel.io/bezier-react/beta'
import { EmptyState, InlineBanner } from '@channel.io/app-sdk-wam-ui'
import { DEX_FUNCTIONS, type DexListOutput } from '@tutorial/shared'

import Portrait from '../../components/Portrait'
import { useAppFunction } from '../../hooks/useAppFunction'
import { formatDay } from '../../utils/datetime'

interface DexProps {
  appId: string
}

const LEVEL_VARIANT = {
  1: 'default',
  2: 'teal',
  3: 'blue',
  4: 'purple',
} as const

function Dex({ appId }: DexProps) {
  const list = useAppFunction<DexListOutput>(appId, DEX_FUNCTIONS.list)
  const [data, setData] = useState<DexListOutput | null>(null)

  const refresh = useCallback(async () => {
    const result = await list.run()
    if (result) setData(result)
  }, [list])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (list.message) {
    return (
      <InlineBanner
        variant="error"
        content={list.message}
      />
    )
  }

  const items = data?.items ?? []

  return (
    <VStack spacing={12}>
      <HStack
        spacing={6}
        align="center"
      >
        <Text
          typo="16"
          bold
        >
          새내기 도감
        </Text>
        {data && (
          <>
            <Tag
              size="s"
              variant="blue"
            >
              {data.total}명
            </Tag>
            {data.evolved > 0 && (
              <Tag
                size="s"
                variant="purple"
              >
                진화 {data.evolved}
              </Tag>
            )}
          </>
        )}
      </HStack>

      {data && items.length === 0 && (
        <VStack spacing={8}>
          <EmptyState title="아직 잡은 새내기가 없어요" />
          <Text
            typo="13"
            color="text-neutral-light"
          >
            /출현 에서 밥약을 수락하고 만남을 마치면, 새내기가 후기를 남길 때
            도감에 등록돼요.
          </Text>
        </VStack>
      )}

      {items.map((item) => (
        <VStack
          key={`${item.juniorAlias}-${item.firstCaughtAt}`}
          spacing={6}
        >
          <Divider />
          <HStack
            spacing={6}
            align="center"
          >
            <Portrait
              seed={item.juniorAlias}
              size="30"
            />
            <Text
              typo="15"
              bold
            >
              {item.juniorAlias}
            </Text>
            <Tag
              size="xs"
              variant={LEVEL_VARIANT[item.level as 1 | 2 | 3 | 4]}
            >
              Lv{item.level}
            </Tag>
            <Tag
              size="xs"
              variant="olive"
            >
              {item.typeLabel}
            </Tag>
            {item.evolved && (
              <Tag
                size="xs"
                variant="purple"
              >
                진화
              </Tag>
            )}
          </HStack>
          <Text
            typo="13"
            color="text-neutral-light"
          >
            만남 {item.catchCount}번 · 친밀도 {item.intimacy} · 첫 만남{' '}
            {formatDay(item.firstCaughtAt)}
          </Text>
        </VStack>
      ))}
    </VStack>
  )
}

export default Dex
