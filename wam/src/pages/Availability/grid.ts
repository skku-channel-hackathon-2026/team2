import { GRID_END_HOUR, GRID_START_HOUR } from '@tutorial/shared'

export const HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, index) => GRID_START_HOUR + index
)

export function cellKey(weekday: number, hour: number): string {
  return `${weekday}-${hour}`
}
