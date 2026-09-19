const DAY = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeZone: 'Asia/Seoul',
})

const DAY_TIME = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
})

const TIME = new Intl.DateTimeFormat('ko-KR', {
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
})

function parse(iso: string): Date | null {
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDay(iso: string): string {
  const parsed = parse(iso)
  return parsed ? DAY.format(parsed) : iso
}

export function formatDayTime(iso: string): string {
  const parsed = parse(iso)
  return parsed ? DAY_TIME.format(parsed) : iso
}

/** `9월 22일 12:00–13:00`, collapsing the end date when it is the same day. */
export function formatWindow(startAt: string, endAt: string): string {
  const start = parse(startAt)
  const end = parse(endAt)
  if (!start || !end) return `${startAt} – ${endAt}`
  return DAY.format(start) === DAY.format(end)
    ? `${DAY_TIME.format(start)}–${TIME.format(end)}`
    : `${DAY_TIME.format(start)} – ${DAY_TIME.format(end)}`
}
