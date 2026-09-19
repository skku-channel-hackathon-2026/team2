# 로컬 수동 테스트 가이드

`pnpm typecheck`/`test`/`lint`/`build:cloudflare`는 타입과 단위 로직만 검증한다.
이 문서는 **실제 서버를 띄우고, 실제 서명된 HTTP 요청으로 Function을 직접
호출**해서 T2(매칭·선착순 수락)·T3(알림)·T5(잡기 파이프라인)가 실제로 동작하는지
확인하는 방법이다. 팀원 누구나 그대로 따라 하면 같은 결과를 재현할 수 있다.

## 왜 이 방법인가

`corepack pnpm test:cloudflare`(smoke 테스트)는 서명 검증·커맨드 목록 조회까지만
확인하고, `ball.confirmMet` 같은 업무 로직은 호출하지 않는다. 업무 로직을 실제로
부르려면 Function 호출 요청에 `context.caller`(누가 호출했는지)가 필요한데, 이건
평소엔 채널톡이 서명해서 채워주는 값이다. 로컬에서는 우리가 가짜 `SIGNING_KEY`를
알고 있으므로, **원하는 caller로 직접 서명한 요청**을 만들어 진짜 서버에 보낼 수
있다 (SDK 자체 테스트 코드 `channel-app.controller.test.js`에서 요청 형식을 확인함).

```json
{
  "method": "ball.confirmMet",
  "context": {
    "caller": { "type": "manager", "id": "m-senior-1" },
    "channel": { "id": "test-channel" }
  },
  "params": { "ballId": "ball-1" }
}
```

이 body를 `SIGNING_KEY`로 HMAC-SHA256(base64) 서명해서 `x-signature` 헤더에 넣고
`PUT /functions/v1`로 보내면, 실제 NestJS 앱·Zod 검증·D1까지 전부 거쳐서 처리된다.

## 1. 빌드

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck && corepack pnpm test && corepack pnpm lint && corepack pnpm format:check
corepack pnpm build:cloudflare
```

## 2. 로컬 DB 준비 (처음이거나 초기화하고 싶을 때)

```sh
rm -rf .wrangler/state
corepack pnpm db:migrate:local
corepack pnpm exec wrangler d1 execute DB --local --file=scripts/seed-demo.sql
```

시드 데이터 요약 (`scripts/seed-demo.sql`):

| id                                                    | 역할 | 설명                                                       |
| ----------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `senior-1` (`m-senior-1`) / `senior-2` (`m-senior-2`) | 선배 | `club` 분야, 월 11-15시 / 월 12-13시 가용                  |
| `junior-1` (`u-junior-1`)                             | 후배 | `encounter-1`(이미 matched), `encounter-3`(matched) 신청자 |
| `junior-2` (`u-junior-2`)                             | 후배 | `encounter-2`(아직 wild, 미수락) 신청자                    |

## 3. 서버 실행

터미널 1:

```sh
corepack pnpm exec wrangler dev --local --port 8797
```

`Ready on http://127.0.0.1:8797` 같은 로그가 뜨면 준비된 것. 이 터미널은 계속 열어둔다.

## 4. 기본 스모크 테스트 (선택)

터미널 2:

```sh
corepack pnpm test:cloudflare
```

서명 검증·커맨드 디스커버리·WAM 정적 파일까지 통과하는지 먼저 확인한다.

## 5. 핵심 시나리오 3개 실행

```sh
node scripts/manual-test.mjs all
# 하나씩: node scripts/manual-test.mjs scenario1
```

### 시나리오 1 — 선착순 수락 동시성 (`encounter-2`)

`senior-1`, `senior-2` 둘 다 `wild.accept`를 **동시에** 호출한다.
`encounter-2`는 `max_seniors = 1`이므로 **정확히 한 명만 성공**하고 나머지는
`FULL`로 거절돼야 한다. T2에서 가장 위험한 부분(경쟁 상태)을 실제 D1 쓰기
직렬화로 검증한다.

### 시나리오 2 — 만남 완료 → 후기 → 도감 (`encounter-1`)

1. `senior-1`이 `ball.confirmMet` 호출 → `encounter-1.status`가 `matched`→`met`로
   바뀌고, 같은 출현의 다른 볼(`senior-2`)도 같이 `wobbling`으로 넘어가야 한다.
2. `junior-1`이 `review.submit` 호출 → `caughtBy`에 선배 2명이 다 나와야 한다.
3. `senior-1`로 `dex.list` 호출 → 후배 `코딩초보`가 도감에 등록돼 있어야 한다.

T5 잡기 파이프라인 전체(상태 전이 + 도감 등록 + 친밀도)와, T3에서 추가한
"후기 요청 알림" enqueue가 같이 확인된다.

### 시나리오 3 — 재촉은 볼당 2번까지 (`encounter-3`)

`ball.confirmMet`으로 `ball-3`를 `wobbling`으로 만든 뒤, 같은 볼에
`ball.remind`를 3번 호출한다. 1·2번째는 성공(`remindersSent: 1`, `2`), 3번째는
`REMINDER_LIMIT` 에러로 거절돼야 한다. 응답의 `delivered` 필드가 `"auto"`면
`writeUserChatMessage` 권한이 실제로 동작한다는 뜻이고, `"manual_copy"`면 권한이
없어 안전하게 폴백한 것이다.

> **로컬에서는 항상 `"manual_copy"`가 나온다.** `.dev.vars`의 앱 자격증명이
> 가짜라 실제 채널톡 API를 호출할 수 없기 때문이다. `delivered: "auto"`를
> 실제로 보려면 **실 Desk 환경**에서 같은 시나리오를 실행해야 한다 — 이 필드가
> T3 권한 질문(§HUBAE_GO_PLAN.md T3)에 대한 실제 답이 된다.

## 6. 다시 돌리고 싶을 때

시나리오들은 서로 다른 출현(`encounter-1/2/3`)을 써서 한 번은 순서대로 다시
돌려도 되지만, **한 번 완료된 시나리오(특히 2번)는 상태가 바뀌어 있어서 그대로
재실행하면 에러가 난다**(이미 후기 남겼음 등). 깨끗한 상태로 다시 보려면 2번
"로컬 DB 준비"부터 반복한다.

## 7. SQL로 직접 확인하고 싶을 때

서버를 안 띄우고 데이터만 빠르게 보려면:

```sh
corepack pnpm exec wrangler d1 execute DB --local \
  --command="SELECT id, status, reminders_sent FROM balls WHERE encounter_id = 'encounter-1'"
```
