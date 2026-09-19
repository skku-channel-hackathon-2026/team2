// 스펙(HUBAE_GO_SPEC.md §9.1)은 ULID를 지정하지만, 새 의존성을 늘리지 않기 위해
// T5에서는 런타임 내장 crypto.randomUUID()를 쓴다. 정렬 가능한 ID가 필요해지면
// (예: 커서 페이지네이션) ulid 패키지로 교체한다.
export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
