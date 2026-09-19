const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAYS_AHEAD = 5

const BANDS = [
  { id: 'lunch', label: '점심 12:00–13:30', startMinute: 720, endMinute: 810 },
  {
    id: 'afternoon',
    label: '오후 15:00–16:30',
    startMinute: 900,
    endMinute: 990,
  },
  {
    id: 'evening',
    label: '저녁 18:00–19:30',
    startMinute: 1080,
    endMinute: 1170,
  },
]

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export interface WindowOption {
  key: string
  label: string
  startAt: string
  endAt: string
}

export interface WindowDay {
  key: string
  label: string
  options: WindowOption[]
}

/**
 * Windows are matched against senior slots by KST weekday + minute
 * (`matching.service.ts`), so they are built in KST and must never cross
 * midnight there.
 */
function kstIso(now: Date, dayOffset: number, minute: number): string {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS)
  const midnightUtc = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate() + dayOffset
  )
  return new Date(midnightUtc + minute * 60_000 - KST_OFFSET_MS).toISOString()
}

/** Tomorrow onward: seniors need time to see the encounter and accept. */
export function buildWindowDays(now: Date): WindowDay[] {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS)

  return Array.from({ length: DAYS_AHEAD }, (_, index) => {
    const dayOffset = index + 1
    const day = new Date(
      Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate() + dayOffset
      )
    )
    return {
      key: `d${dayOffset}`,
      label: `${day.getUTCMonth() + 1}/${day.getUTCDate()}(${WEEKDAYS[day.getUTCDay()]})`,
      options: BANDS.map((band) => ({
        key: `d${dayOffset}-${band.id}`,
        label: band.label,
        startAt: kstIso(now, dayOffset, band.startMinute),
        endAt: kstIso(now, dayOffset, band.endMinute),
      })),
    }
  })
}

export const MAX_WINDOWS = 5
