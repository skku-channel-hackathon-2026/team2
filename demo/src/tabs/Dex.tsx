import { useMemo, useState } from 'react'
import {
  DEX_FUNCTIONS,
  INTIMACY_POINTS,
  type DexEntry,
  type DexListOutput,
} from '@tutorial/shared'

import type { Session } from '../session'
import { useFunctionData } from '../useFunction'
import { Badge, Empty, List, Section, Stat } from '../ui'
import { formatDay } from '../utils/datetime'

/** Lv1 0-29 · Lv2 30-79 · Lv3 80-149 · Lv4 150+ (shared `intimacyLevel`). */
const LEVEL_FLOOR = [0, 0, 30, 80, 150]
const LEVEL_TONE: Record<number, 'default' | 'blue' | 'teal' | 'green'> = {
  1: 'default',
  2: 'blue',
  3: 'teal',
  4: 'green',
}

function progress(entry: DexEntry): { percent: number; caption: string } {
  if (entry.level >= 4) {
    return { percent: 100, caption: '최고 레벨' }
  }
  const floor = LEVEL_FLOOR[entry.level]
  const ceiling = LEVEL_FLOOR[entry.level + 1]
  const percent = Math.min(
    100,
    Math.round(((entry.intimacy - floor) / (ceiling - floor)) * 100)
  )
  return {
    percent,
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
        <button
          className="btn btn--ghost"
          type="button"
          disabled={dex.loading}
          onClick={() => void dex.reload()}
        >
          새로고침
        </button>
      }
    >
      <div className="stats">
        <Stat
          label="등록한 후배"
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
        <div className="chips">
          <button
            type="button"
            className={typeFilter === '' ? 'chip chip--on' : 'chip'}
            onClick={() => setTypeFilter('')}
          >
            전체
          </button>
          {types.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={typeFilter === id ? 'chip chip--on' : 'chip'}
              onClick={() => setTypeFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <List
        resource={resource}
        empty={
          <Empty
            title="도감이 비어 있어요"
            hint="후배가 후기를 제출하면 그 후배가 도감에 등록돼요."
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
                  <div className="dex__top">
                    <span className="dex__name">{entry.juniorAlias}</span>
                    <Badge tone={LEVEL_TONE[entry.level]}>
                      Lv.{entry.level}
                    </Badge>
                    {entry.evolved && <Badge tone="green">진화</Badge>}
                  </div>

                  <Badge tone="blue">{entry.typeLabel}</Badge>

                  <div className="bar">
                    <div
                      className="bar__fill"
                      style={{ width: `${bar.percent}%` }}
                    />
                  </div>
                  <p className="dex__meta">
                    친밀도 {entry.intimacy} · {bar.caption}
                  </p>
                  <p className="dex__meta">
                    {entry.catchCount}번 만남 · 첫 만남{' '}
                    {formatDay(entry.firstCaughtAt)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </List>

      <p className="foot">
        친밀도: 첫 잡기 {INTIMACY_POINTS.first_catch} · 다시 잡기{' '}
        {INTIMACY_POINTS.repeat_catch} · 별 5개 {INTIMACY_POINTS.five_star} ·
        후배의 자기 답 {INTIMACY_POINTS.self_answer} · 진화{' '}
        {INTIMACY_POINTS.evolution}
      </p>
    </Section>
  )
}

export default Dex
