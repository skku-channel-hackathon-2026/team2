import { useMemo, useState } from 'react'
import { Button, HStack, Text, VStack } from '@channel.io/bezier-react/beta'
import { RefreshIcon } from '@channel.io/bezier-icons'
import {
  DEX_FUNCTIONS,
  INTIMACY_POINTS,
  type DexEntry,
  type DexListOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useFunctionData } from '../useFunction'
import { Badge, Empty, List, Meter, Portrait, Section, Stat } from '../ui'
import { fieldTone } from '../fields'
import { formatDay } from '../utils/datetime'

/** Lv1 0-29 · Lv2 30-79 · Lv3 80-149 · Lv4 150+ (shared `intimacyLevel`). */
const LEVEL_FLOOR = [0, 0, 30, 80, 150]

function progress(entry: DexEntry): { value: number; caption: string } {
  if (entry.level >= 4) return { value: 1, caption: '최고 레벨' }
  const floor = LEVEL_FLOOR[entry.level]
  const ceiling = LEVEL_FLOOR[entry.level + 1]
  return {
    value: Math.min(1, (entry.intimacy - floor) / (ceiling - floor)),
    caption: `다음 레벨까지 ${ceiling - entry.intimacy}점`,
  }
}

interface DexProps {
  session: Session
}

function Dex({ session }: DexProps) {
  const dex = useFunctionData<DexListOutput>(DEX_FUNCTIONS.list, {}, session)
  const [typeFilter, setTypeFilter] = useState('')

  const items = useMemo(() => dex.data?.items ?? [], [dex.data])
  const types = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of items) map.set(entry.typeFieldId, entry.typeLabel)
    return [...map.entries()]
  }, [items])

  const shown = typeFilter
    ? items.filter((entry) => entry.typeFieldId === typeFilter)
    : items
  const resource = { ...dex, data: dex.data ? shown : null }

  return (
    <Section
      title="도감"
      action={
        <Button
          size="s"
          variant="ghost"
          semantic="secondary"
          leadingContent={RefreshIcon}
          label="새로고침"
          disabled={dex.loading}
          onClick={() => void dex.reload()}
        />
      }
    >
      <div className="stats">
        <Stat
          label="등록한 새내기"
          value={dex.data?.total ?? 0}
        />
        <Stat
          label="진화"
          value={dex.data?.evolved ?? 0}
        />
        <Stat
          label="총 친밀도"
          value={items.reduce((sum, entry) => sum + entry.intimacy, 0)}
        />
      </div>

      {types.length > 1 && (
        <HStack
          spacing={4}
          wrap
        >
          <Button
            size="xs"
            variant={typeFilter === '' ? 'filled' : 'outlined'}
            semantic="secondary"
            label="전체"
            onClick={() => setTypeFilter('')}
          />
          {types.map(([id, label]) => (
            <Button
              key={id}
              size="xs"
              variant={typeFilter === id ? 'filled' : 'outlined'}
              semantic="secondary"
              label={label}
              onClick={() => setTypeFilter(id)}
            />
          ))}
        </HStack>
      )}

      <List
        resource={resource}
        empty={
          <Empty
            title="도감이 비어 있어요"
            hint="새내기가 후기를 제출하면 그 새내기가 도감에 등록돼요."
          />
        }
      >
        {(entries) => (
          <ul className="dex">
            {entries.map((entry) => {
              const bar = progress(entry)
              return (
                <li
                  key={`${entry.typeFieldId}-${entry.juniorAlias}-${entry.firstCaughtAt}`}
                  className="dex__card"
                >
                  <VStack spacing={10}>
                    <HStack
                      spacing={10}
                      align="center"
                    >
                      <Portrait
                        seed={entry.juniorAlias}
                        size="48"
                      />
                      <VStack spacing={2}>
                        <Text
                          typo="16"
                          bold
                        >
                          {entry.juniorAlias}
                        </Text>
                        <HStack spacing={4}>
                          <Badge tone={fieldTone(entry.typeFieldId)}>
                            {entry.typeLabel}
                          </Badge>
                          <Badge tone="cobalt">Lv.{entry.level}</Badge>
                          {entry.evolved && <Badge tone="green">진화</Badge>}
                        </HStack>
                      </VStack>
                    </HStack>

                    <VStack spacing={4}>
                      <Meter value={bar.value} />
                      <Text
                        typo="12"
                        color="text-neutral-light"
                      >
                        친밀도 {entry.intimacy} · {bar.caption}
                      </Text>
                      <Text
                        typo="12"
                        color="text-neutral-lighter"
                      >
                        {entry.catchCount}번 만남 · 첫 만남{' '}
                        {formatDay(entry.firstCaughtAt)}
                      </Text>
                    </VStack>
                  </VStack>
                </li>
              )
            })}
          </ul>
        )}
      </List>

      <Text
        typo="12"
        color="text-neutral-lighter"
      >
        친밀도: 첫 잡기 {INTIMACY_POINTS.first_catch} · 다시 잡기{' '}
        {INTIMACY_POINTS.repeat_catch} · 별 5개 {INTIMACY_POINTS.five_star} ·
        새내기의 자기 답 {INTIMACY_POINTS.self_answer} · 진화{' '}
        {INTIMACY_POINTS.evolution}
      </Text>
    </Section>
  )
}

export default Dex
