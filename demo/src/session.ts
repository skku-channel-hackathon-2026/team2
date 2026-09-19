export type Role = 'junior' | 'senior'

export interface Session {
  role: Role
  name: string
  studentId: string
}

export const ROLE_LABEL: Record<Role, string> = {
  junior: '후배',
  senior: '선배',
}

const KEY = 'hubaego.demo.session'

export function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (!parsed.name || !parsed.studentId) return null
    return {
      // Sessions written before the role switch existed are junior sessions.
      role: parsed.role === 'senior' ? 'senior' : 'junior',
      name: parsed.name,
      studentId: parsed.studentId,
    }
  } catch {
    return null
  }
}

export function writeSession(session: Session): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Private windows and blocked site data are fine; the session is per-tab then.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
