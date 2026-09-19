import type { BadgeTone } from './ui'

/**
 * A field maps to one Bezier accent hue. DESIGN.md allows the rainbow accents
 * exactly here — "accent는 상태·카테고리 인코딩에 쓰고" — while the primary
 * action stays blue everywhere else.
 */
const FIELD_TONE: Record<string, BadgeTone> = {
  career: 'blue',
  study: 'green',
  club: 'pink',
  grad: 'purple',
  life: 'orange',
}

export function fieldTone(fieldId: string): BadgeTone {
  return FIELD_TONE[fieldId] ?? 'default'
}
