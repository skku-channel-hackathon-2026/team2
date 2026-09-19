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
있다 (SDK 자체 테스트 코드 `channel-app.controller.test.js`에서 요청 형식을
확인함).

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
`PUT /functions/v1`로 보내면, 실제 NestJS 앱·Zod 검증·D1까지 전부 거쳐서
처리된다.

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
| `junior-1` (`u-junior-1`)                             | 새내기 | `encounter-1`(이미 matched), `encounter-3`(matched) 신청자 |
| `junior-2` (`u-junior-2`)                             | 새내기 | `encounter-2`(아직 wild, 미수락) 신청자                    |

## 3. 서버 실행

터미널 1:

```sh
corepack pnpm exec wrangler dev --local --port 8797
```

`Ready on http://127.0.0.1:8797` 같은 로그가 뜨면 준비된 것. 이 터미널은 계속
열어둔다.

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

1. `senior-1`이 `ball.confirmMet` 호출 → `encounter-1.status`가
   `matched`→`met`로 바뀌고, 같은 출현의 다른 볼(`senior-2`)도 같이
   `wobbling`으로 넘어가야 한다.
2. `junior-1`이 `review.submit` 호출 → `caughtBy`에 선배 2명이 다 나와야 한다.
3. `senior-1`로 `dex.list` 호출 → 새내기 `코딩초보`가 도감에 등록돼 있어야 한다.

T5 잡기 파이프라인 전체(상태 전이 + 도감 등록 + 친밀도)와, T3에서 추가한 "후기
요청 알림" enqueue가 같이 확인된다.

### 시나리오 3 — 재촉은 볼당 2번까지 (`encounter-3`)

`ball.confirmMet`으로 `ball-3`를 `wobbling`으로 만든 뒤, 같은 볼에
`ball.remind`를 3번 호출한다. 1·2번째는 성공(`remindersSent: 1`, `2`), 3번째는
`REMINDER_LIMIT` 에러로 거절돼야 한다. 응답의 `delivered` 필드가 `"auto"`면
`writeUserChatMessage` 권한이 실제로 동작한다는 뜻이고, `"manual_copy"`면 권한이
없어 안전하게 폴백한 것이다.

> **로컬에서는 항상 `"manual_copy"`가 나온다.** `.dev.vars`의 앱 자격증명이
> 가짜라 실제 채널톡 API를 호출할 수 없기 때문이다. `delivered: "auto"`를 실제로
> 보려면 **실 Desk 환경**에서 같은 시나리오를 실행해야 한다 — 이 필드가 T3 권한
> 질문(§HUBAE_GO_PLAN.md T3)에 대한 실제 답이 된다.

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

## 8. 데모 웹페이지로 확인하기

`demo/`는 같은 Function들을 **탭 UI**로 보여주는 데모 페이지다. 브라우저는 서명
키를 모르므로, vite dev 서버의 `/demo-api/fn` 미들웨어가 `.dev.vars`의
`SIGNING_KEY`로 서명해 `PUT /functions/v1`로 넘긴다 — §1의 스크립트와 정확히
같은 경로다. 로컬 전용이며(`apply: "serve"`), 업스트림이 루프백이 아니면
프록시가 거부한다.

터미널 두 개:

```sh
corepack pnpm exec wrangler dev --local --port 8797   # 앱 서버 + D1
corepack pnpm dev:demo                                # 데모 페이지
```

- 로그인에서 **새내기 / 선배** 중 하나를 고르고, 로그인 후에도 헤더에서 바꿀 수
  있다. 두 역할은 같은 학번을 쓰므로, 새내기가 업그레이드하면 이력이 한 계정에
  이어진다.
- 새내기 탭: 내 밥약 · 질문하기 · 후기 · 내 정보 (+ 오른쪽에 채널톡 메신저)
- 선배 탭: 출현 · 포켓볼 · 도감 · 답변 · 선배 설정 · 운영
- caller는 학번에서 파생된다 — 새내기 `skku-{학번}`, 선배 `skku-m-{학번}`.
  `scripts/seed-demo.sql`의 `m-senior-1` 같은 시드 계정과는 별개다.
- 선배 계정을 만드는 전체 경로: 새내기 `내 정보` → 업그레이드 신청 → 선배 `운영` →
  승인(연결 코드 발급) → 선배 `선배 설정` → 코드 입력 → 분야·가능 시간 저장. 그
  뒤 새내기 `질문하기`로 밥약을 신청하면 선배 `출현`에 도착한다.
- 업스트림 포트가 다르면 `DEMO_SERVER_ORIGIN`, 채널 ID는 `DEMO_CHANNEL_ID`로
  바꾼다.

## 9. 발표자 계정 (정기용 · 2023310855)

발표 때 업그레이드 플로우를 라이브로 돌리지 않아도 되도록, 발표자 계정은
**마이그레이션에 박아뒀다** — `cloudflare/migrations/0012_presenter_seed.sql`.
따로 시드를 실행할 필요 없이 §2 "로컬 DB 준비"(`pnpm db:migrate:local`)만 하면
들어간다. 원격 D1 에는 운영자가 마이그레이션을 적용할 때 같이 들어간다.

- 로그인: 이름 `정기용`, 학번 `2023310855`. 역할은 헤더에서 바로 바꿀 수 있다.
- 선배로 들어가면 `출현` 1건(수락 가능), `포켓볼` 3건(만남 완료 / 재촉 / 잡음),
  `도감` 3명(1명 진화), `답변` 1건이 이미 차 있다. `is_staff = 1`이라 `운영`
  탭도 열린다.
- 새내기로 들어가면 후기를 기다리는 밥약(`enc-p5`)이 있어 `/후기`를 바로 시연할
  수 있다.
- 분야 5개 전부 + 매일 09:00~22:00(KST)로 열려 있어, 시연 중 즉석에서 만든 밥약
  요청도 발표자 선배에게 매칭된다.
- 새내기 행과 선배 행이 분리돼 있어(`presenter-junior` / `presenter-senior`)
  "새내기로 신청 → 선배로 수락 → 새내기로 후기"를 혼자 끝까지 돌릴 수 있다.
- 리허설로 상태가 더럽혀졌으면 이 파일만 다시 실행해 되돌린다 (맨 위 DELETE 가
  이 시드가 넣은 행만 지운다):

  ```sh
  corepack pnpm exec wrangler d1 execute DB --local \
    --file=cloudflare/migrations/0012_presenter_seed.sql
  ```

- `출현`(`enc-p4`)의 후보 시간대는 **2026-09-21(월)·09-22(화)** 로 고정돼 있다.
  발표일이 이 주를 넘기면 날짜를 미는 마이그레이션을 새로 하나 추가한다
  (적용된 마이그레이션은 고치지 않는다).
