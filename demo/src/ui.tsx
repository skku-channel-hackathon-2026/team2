import type { ReactNode } from 'react'

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="sec">
      <div className="sec__head">
        <h2 className="sec__title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'success'
  children: ReactNode
}) {
  return <p className={`notice notice--${tone}`}>{children}</p>
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {hint && <p className="empty__hint">{hint}</p>}
    </div>
  )
}

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'blue' | 'teal' | 'orange' | 'green' | 'red'
  children: ReactNode
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Loading() {
  return <p className="loading">불러오는 중…</p>
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}

/** The desk WAM answers NOT_LINKED by naming a slash command; in the demo the
 *  same state is one tab away. */
export function NotLinked() {
  return (
    <Empty
      title="아직 선배로 연결되지 않았어요"
      hint="‘선배 설정’ 탭에서 연결 코드를 입력하면 선배 기능이 열려요."
    />
  )
}

/** Renders whichever of loading / error / empty applies, or the list. */
export function List<T>({
  resource,
  empty,
  children,
}: {
  resource: {
    data: T[] | null
    loading: boolean
    error: string | null
    errorType?: string | null
  }
  empty: ReactNode
  children: (items: T[]) => ReactNode
}) {
  if (resource.errorType === 'NOT_LINKED') return <NotLinked />
  if (resource.error) return <Notice tone="error">{resource.error}</Notice>
  if (!resource.data) return resource.loading ? <Loading /> : <>{empty}</>
  if (resource.data.length === 0) return <>{empty}</>
  return <>{children(resource.data)}</>
}
