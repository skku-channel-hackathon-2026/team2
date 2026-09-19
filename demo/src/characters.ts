import { characterFor } from '@tutorial/shared'

/** Vite emits one hashed asset per portrait, so the bundle carries only what
 *  the pages actually render. */
const files = import.meta.glob('./characters/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export function characterUrl(seed: string): string {
  return files[`./characters/${characterFor(seed)}.webp`] ?? ''
}
