import { Fragment, type CSSProperties } from 'react'
import { Text } from '@channel.io/bezier-react/beta'
import { WEEKDAY_LABELS } from '@tutorial/shared'

import { HOURS, cellKey } from './grid'

interface TimetableGridProps {
  selected: Set<string>
  onToggle: (weekday: number, hour: number) => void
  onToggleColumn: (weekday: number) => void
}

function cellStyle(on: boolean): CSSProperties {
  return {
    height: 20,
    border: '1px solid var(--color-border-neutral)',
    borderRadius: 3,
    cursor: 'pointer',
    padding: 0,
    background: on
      ? 'var(--color-fill-accent-blue)'
      : 'var(--color-surface-higher)',
  }
}

const HEADER_BUTTON: CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
}

/** One cell per hour; a header click toggles the whole weekday column. */
function TimetableGrid({
  selected,
  onToggle,
  onToggleColumn,
}: TimetableGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '34px repeat(7, 1fr)',
        gap: 2,
        alignItems: 'center',
      }}
    >
      <span />
      {WEEKDAY_LABELS.map((label, weekday) => (
        <button
          key={label}
          type="button"
          style={HEADER_BUTTON}
          title={`${label}요일 전체 선택/해제`}
          onClick={() => onToggleColumn(weekday)}
        >
          <Text
            typo="13"
            bold
            color={
              weekday === 0 || weekday === 6
                ? 'text-neutral-light'
                : 'text-neutral'
            }
          >
            {label}
          </Text>
        </button>
      ))}

      {HOURS.map((hour) => (
        <Fragment key={hour}>
          <Text
            typo="11"
            color="text-neutral-light"
          >
            {String(hour).padStart(2, '0')}시
          </Text>
          {WEEKDAY_LABELS.map((label, weekday) => {
            const on = selected.has(cellKey(weekday, hour))
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                aria-label={`${label} ${hour}시`}
                style={cellStyle(on)}
                onClick={() => onToggle(weekday, hour)}
              />
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}

export default TimetableGrid
