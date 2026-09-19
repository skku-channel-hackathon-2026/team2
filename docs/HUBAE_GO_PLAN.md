# 후배 Go — 단계별 구현 계획 v2 (역할 모델: 옵션 C)

> SKKU Channel Hackathon 2026 · Team 2
> 이 문서는 `HUBAE_GO_SPEC.md`(기획·게임 규칙)를 전제로, **채널톡이 실제로 허용하는 기능 범위**에 맞춰 구현 순서를 다시 짠 계획서다.
> 각 단계(Tier)는 **혼자서 시연·테스트 가능한 최소 기능(MTF)** 으로 끝난다. 앞 단계가 통과해야 다음 단계로 간다.

---

## 0. 요약

### 0.1 v1 대비 바뀐 점

1. **역할 모델 = 옵션 C.** 모두 고객(후배)으로 시작하고, 밥약을 하고 싶은 사람만 `/선배로-업그레이드`로 신청해 **제한된 '선배' 역할의 팀원**이 된다.
2. **업그레이드 초대 방식 확정.** 채널톡 앱 API에는 **팀원 초대·이메일 발송 기능이 없다**(§1.5). 그래서 "운영진이 만든 초대 링크 + 앱이 발급한 연결 코드" 조합으로 설계했다. 이메일은 선택지로 둔다(§4.4).
3. **알림을 권한 단위로 분리.** 그룹방 알림(이미 권한 있음)과 후배 채팅방 알림(`writeUserChatMessage`, 권한 요청 필요)을 다른 단계로 나눴다.
4. **단계별 MTF.** T0 기반 → T1 계정 → T2 만남 요청 → T3 알림 → T4 AI·매칭 고도화 → T5 게임 고도화(선택).

### 0.2 단계 한눈에 보기

| 단계               | 목표                                    | MTF (이것만 되면 통과)                                                                                      | 새로 필요한 권한                                          |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **T0 기반**        | 커맨드·스키마·토큰·outbox 골격          | 모든 커맨드가 등록되고 "준비 중" 응답, 토큰이 D1에 캐시됨                                                   | 없음                                                      |
| **T1 계정 관리**   | 후배 계정, 선배 업그레이드, 계정 연결   | 고객이 `/선배로-업그레이드` → 운영 승인 → 초대 링크·코드 수령 → 팀원 가입 후 `/선배시작 코드` → 선배로 인식 | (선택) `writeUserChatMessage`                             |
| **T2 만남 요청**   | 질문 → 출현 → 선착순 수락 → 만남 → 잡기 | 두 선배가 동시에 수락해도 M명을 넘지 않고, 후기 제출 시 도감에 등록                                         | 없음 (그룹방 알림만)                                      |
| **T3 알림**        | 후배에게 푸시, 리마인드, 채팅방 연결    | 수락 즉시 후배 메신저에 봇 메시지 도착, 리마인드 중복 0                                                     | `writeUserChatMessage`, `createUserChat`, (선택) Open API |
| **T4 AI·매칭**     | AI 우선 답변, 지식 루프, 매칭 v2        | 같은 질문에 이전 답이 먼저 뜨고, 무수락 시 2차 웨이브가 돈다                                                | (선택) 도큐먼트 검색, LLM 키                              |
| **T5 게임 고도화** | 친밀도·진화·도감 공유·재촉              | 친밀도 레벨업, 진화 표시, 라운지 공유 카드                                                                  | 없음                                                      |

---

## 1. 채널톡이 허용하는 범위 (조사 결과)

### 1.1 권한 구조

- 개발자 포털 **[앱 설정] → [인증 및 권한]** 의 **Channel / User / Manager** 섹션에서 앱이 쓸 Native Function을 체크한다.
  - **User·Manager 섹션** 권한은 **WAM에 전달되는 토큰**에 포함된다 → WAM에서 "지금 사용 중인 고객/팀원"으로서 호출.
  - **Channel 섹션** 권한은 서버가 App Secret으로 **토큰을 교환**해 사용한다 → 서버(봇)로서 호출.
- 해커톤 앱의 현재 권한: Channel `writeGroupMessage`, Manager `writeGroupMessageAsManager`. **그 외는 전부 운영진에게 추가 요청**해야 한다.
- **토큰 발급 제한:** `issueToken`·`refreshToken`은 앱당 **30분에 10회**를 공유한다. 기본 토큰 캐시는 단일 프로세스 메모리용이라, 인스턴스가 자주 바뀌는 Workers에서는 **D1 같은 공유 저장소에 토큰 쌍을 캐시**해야 제한에 걸리지 않는다 (T0에서 처리).

### 1.2 Function 호출 시 받는 context

| 필드                           | 내용                                                    | 우리 용도                                                          |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `caller`                       | `user` / `manager` / `system` / `app` 중 호출 주체와 ID | **후배(고객)인지 선배(팀원)인지 서버에서 판별**                    |
| `channel`                      | 설치된 채널 ID                                          | 모든 Native 호출의 `channelId`                                     |
| `user`, `userChat`, `language` | 해당 흐름에 있을 때만                                   | 후배가 `front` 커맨드를 실행한 **채팅방 ID 저장** → 이후 알림 대상 |
| `config`                       | config 확장으로 저장한 설정·자격 증명                   | 초대 링크, 외부 API 키 보관 후보                                   |

> `context`는 `x-signature` 검증을 통과한 요청에서만 신뢰한다. WAM이 보낸 역할·ID는 믿지 않는다.

### 1.3 Native Function 중 후배 Go가 쓸 것

SDK의 `NativeFunctionTypeMap`(TypeScript) 기준 목록에서 골랐다. 각 함수는 포털에서 해당 섹션 권한이 켜져 있어야 동작한다.

| 영역                  | Native Function                                   | 호출 주체     | 후배 Go 용도                                                                       | 단계        |
| --------------------- | ------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------- | ----------- |
| 그룹 메시지           | `writeGroupMessage`                               | 서버(봇)      | 출현 알림방·운영방·라운지 공지, 스레드(`rootMessageId`)                            | T0~ ✅ 보유 |
| 그룹 메시지           | `writeGroupMessageAsManager`                      | WAM(팀원)     | 선배가 본인 명의로 라운지에 도감 공유                                              | T5 ✅ 보유  |
| **고객 채팅 메시지**  | **`writeUserChatMessage`**                        | 서버(봇)      | 후배에게 "선배가 수락했어요", 리마인드, 초대 링크 전달                             | T1(선택)·T3 |
| 고객 채팅 생성        | `createUserChat`                                  | 서버(봇)      | 후배의 열린 채팅방이 없을 때 새로 만들어 알림                                      | T3          |
| 고객 채팅 조회        | `getUserChat`                                     | 서버          | 저장해 둔 채팅방이 유효한지 확인                                                   | T3          |
| 팀원 명의 고객 메시지 | `writeUserChatMessageAsManager`                   | WAM(팀원)     | 선배가 WAM에서 후배 채팅방에 본인 명의 인사 (내부 메모는 `MESSAGE_OPTION_PRIVATE`) | T3(선택)    |
| 고객 정보             | `getUser`                                         | 서버          | 후배 표시 이름 초기값                                                              | T1          |
| 고객 프로필·태그      | `patchUser` (`profile`, `tags`)                   | 서버          | 데스크에서 보이도록 `선배후보`·`선배` 태그 부여                                    | T1(선택)    |
| 고객 연락처           | `findContactsByUser`                              | 서버          | 업그레이드 신청 시 이메일 미리 채우기                                              | T1(선택)    |
| 고객 이벤트           | `createEvent`                                     | 서버          | `hubaego_matched` 등 이벤트 → 운영진이 **채널톡 캠페인**으로 추가 알림 설정        | T3(선택)    |
| 팀원 조회             | `getManager`, `searchManagers`                    | 서버          | 연결된 선배 팀원 정보 확인                                                         | T1          |
| 역할 조회             | `getRole`                                         | 서버          | 연결 시 해당 팀원이 '선배' 역할인지 확인                                           | T1(선택)    |
| 그룹 조회             | `getGroup`, `searchGroups`                        | 서버          | 출현 알림방·라운지 그룹 ID 확인                                                    | T0          |
| 도큐먼트              | `searchArticles`, `getArticle`                    | 서버          | 질문과 비슷한 도큐먼트 문서 검색 (플랫폼이 라우팅하지만 **SDK 타입 미제공**)       | T4(선택)    |
| 앱 데이터             | `createAppDataTable`, `upsertAppDataTableRows` 등 | 서버(앱 토큰) | 운영 지표를 노트북에서 분석                                                        | 범위 밖     |

### 1.4 Open API (앱과 별개의 채널 자격 증명)

채널 소유자가 발급하는 Open API 키로 쓸 수 있는 기능 중 유용한 것:

| 엔드포인트                                                      | 용도                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `PATCH /open/v5/user-chats/{id}/invite?managerIds=…`            | **수락한 선배들을 후배 채팅방에 초대** → 제한 역할 선배도 그 채팅방을 볼 수 있게 됨 |
| `PATCH /open/v5/user-chats/{id}/assign-to/managers/{managerId}` | 첫 수락 선배를 담당자로 지정                                                        |
| `GET /open/v4/managers`                                         | 팀원 목록(이메일 포함) — 계정 자동 연결 보조                                        |
| `POST /open/v5/users/{userId}/user-chats`                       | 고객 채팅 생성 (Native `createUserChat`의 대안)                                     |

> 앱 권한이 아니라 **채널 자격 증명**이므로 운영진이 키를 발급해 Worker secret으로 넣어야 한다. 불가하면 T3의 폴백을 쓴다.

### 1.5 앱으로 할 수 없는 것 (설계 제약)

| 하고 싶은 것                            | 조사 결과                                             | 설계 대응                                                                                           |
| --------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 앱이 사람을 **팀원으로 초대**           | Native Function 목록·확인한 Open API 범위에 없음      | 운영진이 만든 **초대 링크**(유효기간 내 재사용 가능)를 전달, 가입 후 **연결 코드**로 앱 계정과 결합 |
| 앱이 **이메일 발송**                    | 해당 Native Function 없음                             | ① 채팅방으로 전달(기본) ② 외부 메일 API(선택) ③ 운영진 수동 초대                                    |
| 앱이 **도큐먼트 글 작성**               | 검색·조회만 라우팅됨 (`searchArticles`, `getArticle`) | 지식은 마크다운으로 내보내 운영진이 도큐먼트에 붙여넣기                                             |
| 봇 메시지 **버튼으로 앱 Function 실행** | 버튼 `action`이 불투명한 JSON으로만 정의됨            | 수락·확인은 WAM에서, 버튼은 링크 용도로만 가정                                                      |

---

## 2. 역할 모델과 채널톡 설정

### 2.1 역할

| 역할       | 채널톡 신분                          | 쓰는 화면        | 할 수 있는 것                                                                   |
| ---------- | ------------------------------------ | ---------------- | ------------------------------------------------------------------------------- |
| **후배**   | 고객 (user)                          | 채널톡 메신저    | ALF 질문, `/선배-도와줘요`, `/내밥약`, `/후기`, `/내정보`, `/선배로-업그레이드` |
| **선배**   | 팀원 (manager), **'선배' 제한 역할** | 채널톡 앱·데스크 | `/선배시작`, `/선배등록`, `/출현`, `/포켓볼`, `/도감`, `/답변`                  |
| **운영진** | 팀원, 관리 역할                      | 데스크           | `/운영` (업그레이드 승인, 신고, 지식 검수), `/운영설정`, `/알림실행`            |

한 사람이 후배(고객 ID)와 선배(팀원 ID)를 **둘 다** 가질 수 있고, `users` 한 행에 두 ID가 연결된다. 이 연결 덕분에 "도감 속 후배가 선배가 되었다(진화)"를 계산할 수 있다.

### 2.2 운영진이 채널톡에서 미리 할 설정 (코드 아님)

1. **'선배' 커스텀 역할 생성:** 팀챗 단체방과 초대된 그룹만 참여하고, **담당자·팔로워로 배정된 상담만** 보도록 설정 (채널당 역할 최대 20개).
2. **기본 역할을 '선배'로 지정:** 초대 링크로 들어온 사람은 자동으로 제한 역할을 받는다.
3. **초대 링크 생성:** 유효기간을 짧게(예: 7일) 두고 주기적으로 교체하며, 만든 링크는 `/운영설정`에 등록해 앱이 승인 시 전달하게 한다. 링크는 유효기간 안에 누구나 재사용할 수 있으므로, **앱 권한은 연결 코드로 따로 통제**한다 (§4.4).
4. **공개 그룹방 3개:** `#출현-알림`, `#선배-라운지`, `#운영` (봇 발송은 공개 그룹만 가능).
5. **'선배' 팀 구성:** 팀에 공개 그룹을 지정해 두면 새 팀원이 들어올 때 해당 그룹에 자동 초대된다.

---

## 3. T0 — 기반

### 3.1 목표

기능 없이도 **등록·배포·토큰·발송 파이프라인이 끝까지 도는 골격**을 만든다. 운영진 요청(등록 갱신·마이그레이션)을 한 번에 끝내는 것이 핵심이다.

### 3.2 할 일

1. **커맨드 전부 선언:** §11의 커맨드를 첫 배포에 모두 선언하고, 아직 구현 안 된 커맨드는 "준비 중이에요" 텍스트를 반환. → 등록 갱신 요청 1회.
2. **스키마 선제출:** T1~~T3 마이그레이션(0002~~0004)을 첫날 첫 시간에 한꺼번에 원격 적용 요청. T4·T5(0005~0006)는 두 번째 요청으로 묶음.
3. **토큰 캐시를 D1로:** SDK 토큰 캐시 인터페이스를 D1 테이블(`app_tokens`)로 구현해 인스턴스 간 공유. 발급 제한(30분 10회)을 넘지 않는지 로그로 확인.
4. **운영 설정 등록:** `/운영설정` (desk)을 각 그룹방에서 실행하면 그 방의 ID를 `app_settings`에 저장 (`wild_group_id`, `lounge_group_id`, `ops_group_id`). 같은 WAM에서 **현재 초대 링크와 만료일**도 저장한다.
5. **발송 outbox:** `notifications` 테이블 + `jobs.runDue` 러너 + `channel.service.post()` 단일 창구. 실행은 모든 Function 끝의 lazy 실행 + `/알림실행`.

### 3.3 MTF (통과 기준)

- [ ] T0-1: 모든 커맨드가 데스크/메신저 목록에 보이고 응답한다.
- [ ] T0-2: `#운영`에서 `/운영설정` → "이 방을 운영방으로 등록했어요" 봇 메시지.
- [ ] T0-3: `/알림실행`으로 outbox의 테스트 알림 1건이 `#운영`에 **정확히 한 번** 도착 (두 번 실행해도 1건).
- [ ] T0-4: 30분 동안 여러 번 호출해도 토큰 발급 로그 ≤ 2회.

---

## 4. T1 — 계정 관리

### 4.1 목표

후배는 자동으로 계정이 생기고, 선배가 되고 싶은 후배는 `/선배로-업그레이드` → 운영 승인 → 팀원 가입 → 계정 연결까지 끝낼 수 있다.

### 4.2 흐름

```
[후배] /선배로-업그레이드 (front)
   → WAM upgrade: 자격 확인(학번·학년), 선배 수칙 동의, 이메일(선택), 한 줄 소개
   → upgrade.request → upgrade_requests: requested
   → #운영 에 봇 카드 "선배 업그레이드 신청 1건"
[운영진] /운영 → 업그레이드 탭 → 승인
   → upgrade.decide → approved + 연결 코드 발급 (6자리, 해시 저장, 72시간, 1회용)
   → 전달 (§4.4): 초대 링크 + 연결 코드
[신청자] 초대 링크로 채널 팀원 가입 → 기본 역할 '선배' 자동 부여
   → 데스크에서 /선배시작 (desk) → 코드 입력 → account.linkManager
   → users 행에 팀원 ID 연결, is_senior = 1, linked
   → /선배등록 으로 분야·가용 시간·주간 상한 입력 → 출현 대상이 됨
```

### 4.3 업그레이드 상태

```
requested ──승인──▶ approved ──코드 입력──▶ linked
    │                  └──72시간 경과──▶ expired ──재발급──▶ approved
    └──반려──▶ rejected
```

### 4.4 초대 전달 방식

| 방식                      | 동작                                                                                                                                                                 | 필요 조건                                         | 판단                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| **A. 채팅방 전달 (기본)** | 봇이 신청자의 고객 채팅방에 "승인됐어요! 초대 링크 · 연결 코드" 메시지 (`writeUserChatMessage`). 권한이 없으면 신청자가 `/선배로-업그레이드`를 다시 열 때 WAM에 표시 | `writeUserChatMessage` (없어도 WAM 폴백으로 동작) | **MVP 추천** — 메신저 푸시로 도착, 이메일 불필요 |
| B. 외부 메일 API          | Worker에서 메일 발송 서비스 API를 `fetch`로 호출해 이메일 전송                                                                                                       | API 키(운영진이 secret 설정), 발신 도메인         | 이메일이 꼭 필요할 때                            |
| C. 운영진 수동 초대       | 앱은 승인 목록에 이메일을 보여주고, 운영진이 데스크에서 직접 초대                                                                                                    | 없음                                              | 가장 확실하지만 수작업                           |

**보안 설계 (중요)**

- 초대 링크는 유효기간 안에 누구나 재사용할 수 있다. 그래서 **링크만으로는 앱의 선배 기능을 쓸 수 없고**, 승인된 사람에게만 발급한 **연결 코드**가 있어야 한다.
- 링크로 들어온 사람의 채널 권한은 '선배' 제한 역할이라 **배정·초대된 상담만** 볼 수 있다. 앱에 연결되지 않은 팀원은 출현 대상이 되지 않는다.
- 연결 코드: 6자리(혼동 문자 제외), **해시로 저장**, 72시간 만료, 1회용, 5회 오입력 시 잠금.

### 4.5 커맨드 (T1)

| 식별자        | 표시              | scope | 동작                                                    |
| ------------- | ----------------- | ----- | ------------------------------------------------------- |
| `me`          | 내정보            | front | 내 별명·학과·학번, 업그레이드 상태 확인·수정 (WAM `me`) |
| `upgrade`     | 선배로-업그레이드 | front | 신청 WAM. 승인 후엔 초대 링크·코드 표시                 |
| `seniorstart` | 선배시작          | desk  | 연결 코드 입력 (WAM `link`)                             |
| `senior`      | 선배등록          | desk  | 분야·포트폴리오·가용 시간·주간 상한 (WAM `senior`)      |
| `ops`         | 운영              | desk  | 업그레이드 승인 탭 포함 (WAM `ops`)                     |

### 4.6 Functions (T1)

| 메서드                                       | 호출         | params                                   | result                                                                      |
| -------------------------------------------- | ------------ | ---------------------------------------- | --------------------------------------------------------------------------- |
| `account.me`                                 | front·desk   | `{}`                                     | `{ user, roles: ('junior'                                                   | 'senior'      | 'staff')[], upgrade?: UpgradeStatus }` |
| `account.upsertProfile`                      | front        | `{ nickname, department?, cohortYear? }` | `{ ok }`                                                                    |
| `upgrade.open`                               | front 커맨드 | `{}`                                     | WAM `upgrade`                                                               |
| `upgrade.request`                            | front WAM    | `{ email?, intro, agreeRules: true }`    | `{ requestId, status: 'requested' }`                                        |
| `upgrade.status`                             | front WAM    | `{}`                                     | `{ status, inviteLink?, linkCode?, codeExpiresAt? }` (승인된 본인에게만)    |
| `upgrade.list`                               | desk(운영)   | `{ status? }`                            | `{ items: UpgradeRequestCard[] }`                                           |
| `upgrade.decide`                             | desk(운영)   | `{ requestId, approve, reason? }`        | `{ status, delivered: 'user_chat'                                           | 'wam_only' }` |
| `account.linkManager`                        | desk WAM     | `{ code }`                               | `{ linked: true, userId }` 또는 `CODE_INVALID`·`CODE_EXPIRED`·`CODE_LOCKED` |
| `senior.getProfile` / `senior.upsertProfile` | desk         | §HUBAE_GO_SPEC 10.4                      | 동일                                                                        |

**계정 자동 생성 규칙:** `caller.type = user`인 요청이 처음 오면 `users`에 고객 ID로 행을 만들고, `context.userChat`이 있으면 `primary_user_chat_id`로 저장한다(T3 알림 대상).

### 4.7 MTF (통과 기준)

- [ ] T1-1: 새 고객이 `/내정보` 실행 → 계정 자동 생성, 별명 저장.
- [ ] T1-2: `/선배로-업그레이드` 제출 → `#운영`에 신청 카드.
- [ ] T1-3: 운영진 승인 → 신청자가 WAM(또는 채팅방)에서 초대 링크와 코드를 확인.
- [ ] T1-4: 초대 링크로 가입한 팀원이 `/선배시작` + 코드 → `/내정보`에 후배·선배 두 역할 표시.
- [ ] T1-5: 틀린 코드 5회 → 잠금, 만료 코드 → `CODE_EXPIRED`, 이미 쓴 코드 → `CODE_INVALID`.
- [ ] T1-6: 코드 없이 링크로만 들어온 팀원은 `/출현`에서 "선배 연결 후 이용할 수 있어요".

---

## 5. T2 — 만남 요청

### 5.1 목표

질문 → 출현 → 선착순 수락 → 만남 완료 → 후기 → **잡기(도감 등록)** 까지 한 바퀴. 알림은 **이미 가진 그룹방 권한만** 쓰고, 후배는 `/내밥약`에서 상태를 **직접 확인**한다(푸시는 T3).

### 5.2 흐름

```
[후배] /선배-도와줘요 → 질문·카테고리·분야·만남 방식·가능 시간·M 입력 → encounter.create
   → 매칭 v1로 대상 선배 N=5명 선정 → #출현-알림 에 "야생의 후배가 출현했다!" (대상 선배 이름 표시)
[선배] /출현 → 겹치는 시간 중 하나 선택 → wild.accept (원자적, 최대 M명)
   → 첫 수락자가 일정·장소 확정, 이후 수락자는 합류 → #출현-알림 스레드 "볼을 던졌다! (1/2)"
[후배] /내밥약 → "선배 2명 수락 · 9/22(월) 12:00 학생회관" 확인
[선배] 만남 후 /포켓볼 → 만남 완료 → ball.confirmMet
[후배] /후기 → 별점·후기·자기 답 → review.submit → 잡기 성공 → 선배 도감 등록
```

일정·장소가 **수락 시점에 확정**되므로, T2에서는 선배와 후배가 채팅하지 않아도 만남이 성립한다. 채팅 연결은 T3.

### 5.3 매칭 v1 (단순 규칙)

- **후보:** 연결된 선배, `active`, 질문 분야와 1개 이상 겹침, 후배 가능 시간과 30분 이상 겹침, 이번 주 상한 남음, 같은 후배와 진행 중인 볼 없음.
- **정렬:** 분야 겹침 수 ↓ → 최근 7일 출현 알림 받은 횟수 ↑(적은 사람 우선) → 무작위.
- 상위 5명에게 알림. 웨이브·점수 가중치는 T4.

### 5.4 동시성

선착순 수락은 `HUBAE_GO_SPEC.md` §9.3의 **조건부 INSERT 한 문장**으로 처리한다(대상자·M명 미만·열린 출현일 때만 볼 생성). 첫 수락이면 같은 요청에서 출현을 `matched`로 바꾸고 슬롯을 확정한다.

### 5.5 커맨드 (T2)

| 식별자   | 표시          | scope | 동작                                |
| -------- | ------------- | ----- | ----------------------------------- |
| `helpme` | 선배-도와줘요 | front | 질문 → (T4부터 유사 답) → 밥약 신청 |
| `mybab`  | 내밥약        | front | 내 출현·일정·후기 상태              |
| `review` | 후기          | front | 후기 + 자기 답 → 잡기               |
| `wild`   | 출현          | desk  | 나에게 온 출현, 수락                |
| `balls`  | 포켓볼        | desk  | 내 일정, 만남 완료                  |
| `dex`    | 도감          | desk  | 잡은 후배 목록 (기본형)             |

### 5.6 Functions (T2)

`helpme.open`, `encounter.create`, `encounter.mine`, `encounter.cancel`, `wild.list`, `wild.accept`, `ball.list`, `ball.confirmMet`, `review.open`, `review.submit`, `dex.list`
→ params·result·에러 코드는 `HUBAE_GO_SPEC.md` §10.3~10.6을 그대로 따른다. T2에서는 `question.searchSimilar`를 호출하지 않는다(T4).

### 5.7 MTF (통과 기준)

- [ ] T2-1: 후배가 신청 → `#출현-알림`에 대상 선배 이름이 포함된 카드.
- [ ] T2-2: **M=1에서 두 선배가 동시에 수락** → 볼 1개만 생성, 다른 선배는 `FULL`.
- [ ] T2-3: 대상이 아닌 선배의 수락 → `NOT_ELIGIBLE`.
- [ ] T2-4: 후배 `/내밥약`에 수락 선배·일정 표시.
- [ ] T2-5: 만남 완료 전 후기 → `REVIEW_NOT_READY`.
- [ ] T2-6: 후기 제출 → 볼 `caught`, 선배 `/도감`에 후배 별명 표시.
- [ ] T2-7: 후배 취소 → 출현 `cancelled`, 볼 `cancelled`, 선배 주간 사용 시간 복구.

---

## 6. T3 — 알림

### 6.1 목표

후배가 앱을 열지 않아도 **메신저 푸시로** 진행 상황을 받고, 수락한 선배가 **후배 채팅방에서 직접 대화**할 수 있게 한다.

### 6.2 알림 목록

| 이벤트                | 받는 사람   | 경로                              | Native / API           | 시점                              |
| --------------------- | ----------- | --------------------------------- | ---------------------- | --------------------------------- |
| 선배 수락             | 후배        | 후배 채팅방                       | `writeUserChatMessage` | 즉시                              |
| M명 모두 수락         | 후배        | 후배 채팅방                       | `writeUserChatMessage` | 즉시                              |
| 새 출현               | 대상 선배   | `#출현-알림`                      | `writeGroupMessage`    | 즉시 (T2부터)                     |
| 만남 하루 전·2시간 전 | 후배 / 선배 | 후배 채팅방 / `#출현-알림` 스레드 | 둘 다                  | 예약                              |
| 후기 요청             | 후배        | 후배 채팅방                       | `writeUserChatMessage` | 만남 종료 +2시간                  |
| 후기 마감 3일·1일 전  | 후배        | 후배 채팅방                       | `writeUserChatMessage` | 예약 (자동 재촉)                  |
| 출현 만료             | 후배        | 후배 채팅방                       | `writeUserChatMessage` | 만료 시 — 정규 멘토링·게시판 안내 |
| 업그레이드 승인       | 신청자      | 신청자 채팅방                     | `writeUserChatMessage` | 승인 즉시 (T1 방식 A)             |
| 잡기 성공             | 선배        | `#선배-라운지`                    | `writeGroupMessage`    | 즉시                              |

### 6.3 후배 채팅방 확보

1. 후배가 `front` 커맨드를 실행할 때 `context.userChat` ID를 `users.primary_user_chat_id`로 저장.
2. 발송 전 `getUserChat`으로 확인. 없거나 쓸 수 없으면 `createUserChat(userId)`로 새로 만든 뒤 발송.
3. 새 채팅을 과도하게 만들지 않도록 **후배당 알림 채팅 1개**를 재사용.

### 6.4 선배를 후배 채팅방에 연결 (3단계 폴백)

| 수준   | 방법                                                                                                                          | 조건                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **L1** | 수락 시 Open API로 **수락 선배들을 후배 채팅방에 초대**(+ 첫 수락자를 담당자로 지정). 제한 역할 선배도 그 채팅방을 볼 수 있다 | 운영진이 Open API 키를 secret으로 설정 |
| L2     | 선배가 `/포켓볼` WAM에 인사말을 쓰면 **봇이 후배 채팅방에 대신 전달** ("김선배의 메시지: …"). 후배 답장은 운영진 수신함으로   | `writeUserChatMessage`만               |
| L3     | 채팅 없이 수락 시 확정된 **일정·장소로 만남**                                                                                 | 없음 (T2와 동일)                       |

### 6.5 Outbox v2

- `target_type` (`group` | `user_chat`)과 `target_id`로 대상 일반화.
- **조용한 시간:** 23:00~08:00에는 급하지 않은 알림을 아침으로 미룸.
- **재시도:** 실패 시 최대 3회, 간격 1분·5분·30분. 3회 실패 → `failed` + `#운영` 보고.
- **처리량 제한:** 한 번에 최대 20건 (Workers Free 요청당 CPU 제한 고려).
- **중복 방지:** `dedupe_key` 예시 — `accepted:{encounterId}:{seniorId}`, `remind_d1:{encounterId}`, `review_req:{encounterId}`.

### 6.6 스케줄 실행

- 기본: 모든 Function 끝에서 lazy 실행 + `/알림실행`.
- 운영진이 **Polling 확장**을 등록해 주면 주기 실행으로 전환 (리마인드 정시성 향상).

### 6.7 (선택) 채널톡 캠페인 연동

`createEvent`로 `hubaego_matched`, `hubaego_review_due` 같은 고객 이벤트를 남기면, 운영진이 채널톡 캠페인에서 이 이벤트를 트리거로 추가 알림을 설정할 수 있다. 앱 코드는 이벤트만 남긴다.

### 6.8 MTF (통과 기준)

- [ ] T3-1: 선배 수락 → 후배 메신저에 봇 메시지 도착 (푸시 확인).
- [ ] T3-2: 저장된 채팅방이 닫혀 있어도 새 채팅 생성 후 도착.
- [ ] T3-3: `/알림실행`을 연속 3번 → 하루 전 리마인드는 **한 번만** 발송.
- [ ] T3-4: 23:30에 생긴 비긴급 알림 → `due_at`이 08:00으로 조정.
- [ ] T3-5: (L1) 수락 선배가 제한 역할 계정으로 후배 채팅방을 열람·답장 가능.
- [ ] T3-6: (L2) 선배 인사말이 후배 채팅방에 봇 메시지로 전달.

---

## 7. T4 — AI 통합과 매칭 고도화

### 7.1 목표

간단한 질문은 사람에게 가기 전에 끝나고, 사람에게 가는 질문은 **가장 잘 맞고 여유 있는 선배**에게 공정하게 간다.

### 7.2 AI 우선 답변 (3층)

| 층                 | 담당                     | 내용                                                                                                                                | 필요 조건                                                     |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **L1 ALF**         | 채널톡 설정 (코드 아님)  | 도큐먼트 기반 답변. `helpme`·`mybab`·`upgrade`에 `alfMode: recommend` + `alfDescription`을 달아 **답이 부족하면 ALF가 밥약을 제안** | 테스트 채널의 ALF·도큐먼트 사용 가능 여부                     |
| **L2 앱 유사 답**  | `question.searchSimilar` | 질문 WAM 2단계에서 D1 지식(문자 3-gram 유사도, 같은 카테고리 우선) 상위 3개 + (선택) `searchArticles`로 도큐먼트 검색               | 도큐먼트 검색은 권한 필요, SDK 타입이 없어 작은 어댑터로 격리 |
| L3 LLM 요약 (선택) | `ai.draftAnswer`         | 상위 근거만으로 짧은 답을 만들고 **출처 표시**. 근거가 없으면 답하지 않고 "선배에게 물어볼까요?"                                    | 외부 LLM API 키 (운영진이 secret 설정)                        |

분류(의도·분야)도 같은 순서로 올린다: 폼 직접 선택 → 키워드 사전 보강 → (선택) LLM 추출.

### 7.3 지식 루프

```
후기의 '자기 답' → PII 검사 → 해당 선배 확인 → published (유효 학기 부여)
   → /운영 에서 knowledge.export (마크다운) → 운영진이 도큐먼트에 붙여넣기 → ALF가 다음 질문부터 사용
```

앱은 도큐먼트 글을 **쓸 수 없으므로**(§1.5) 내보내기 + 붙여넣기로 설계한다. L2 유사 답은 D1 지식을 바로 쓰므로 붙여넣기 전에도 효과가 난다.

### 7.4 매칭 v2

- **점수:** `HUBAE_GO_SPEC.md` §6.2 가중치 (분야 0.40 · 카테고리 경험 0.20 · 시간 겹침 0.15 · 응답성 0.15 · 공정성 0.10).
- **웨이브:** 1차 5명 → 6시간 무수락 시 2차 5명 → 추가 42시간 무수락 시 만료.
- **주간 상한:** 만남 방식별 예상 시간(밥 60 · 카페 45 · 온라인 30분)을 차감.
- **응답성:** 최근 30일 수락률, 신규 선배는 0.5로 시작.
- **설명 가능성:** 각 대상에 "분야 2개 일치 · 월 12시 가능 · 이번 주 알림 0회" 같은 사유를 저장해 운영 대시보드에 표시.

**조정값 (app_settings)**

| 키                      | 기본값                                                       | 의미               |
| ----------------------- | ------------------------------------------------------------ | ------------------ |
| `match_wave_size`       | 5                                                            | 웨이브당 알림 인원 |
| `match_wave_interval_h` | 6                                                            | 1차 → 2차 간격     |
| `match_expire_h`        | 48                                                           | 전체 만료          |
| `match_weights`         | `{"field":0.4,"cat":0.2,"time":0.15,"resp":0.15,"fair":0.1}` | 가중치             |

**오프라인 평가 (데모·발표용):** 시드 스크립트로 가상 선배 30명·질문 100개를 만들어 ① 후보가 1명 이상인 비율 ② 선배별 알림 편중도 ③ v1 대비 분야 일치율을 비교한다.

### 7.5 MTF (통과 기준)

- [ ] T4-1: 이미 지식이 있는 질문 → 2단계에서 유사 답 표시, "해결됐어요" → 질문 `ai_resolved`.
- [ ] T4-2: 후기의 자기 답 → 선배 확인 후 `published` → 같은 질문에 유사 답으로 등장.
- [ ] T4-3: `knowledge.export`가 개인정보 없는 마크다운 생성.
- [ ] T4-4: 1차 무수락 → `/알림실행` 시 시각 경과를 흉내 낸 테스트에서 2차 웨이브 발송.
- [ ] T4-5: 점수 함수 단위 테스트 (분야 일치·공정성 보정·상한 초과 제외).
- [ ] T4-6: (ALF 가능 시) 메신저에서 ALF가 `/선배-도와줘요`를 추천.

---

## 8. T5 — 게임 고도화 (선택)

- **친밀도:** `intimacy_events` 적립 (첫 잡기 +30, 추가 밥약 +20, 별점 5 +10, 자기 답 +10, 진화 +50), 레벨 Lv1~4.
- **진화:** 도감의 후배(고객 ID)가 T1 연결로 선배(팀원 ID)가 되고 다른 후배를 잡으면 원래 선배 도감에 "진화" 표시 + 라운지 알림. **T1의 계정 연결이 있어야 계산 가능한 기능**이다.
- **도감 공유:** `/도감` → 라운지 공유 (봇 발송 또는 선배 본인 명의 `writeGroupMessageAsManager`). 공유 동의한 후배 별명만 노출.
- **재촉·도망:** 선배 재촉 볼당 2회(봇 문구), 7일 무후기 시 도망 (공개 게시 없음).
- **`/답변`:** 내가 도운 질문과 후배의 자기 답 목록.

**MTF:** 잡기 2회로 Lv2 달성 · 연결된 후배가 다른 후배를 잡으면 진화 표시 · 공유 카드에 비동의 후배 별명이 나오지 않음.

---

## 9. 데이터 스키마 (단계별 마이그레이션)

변경이 없는 테이블은 `HUBAE_GO_SPEC.md` §9.2 DDL을 그대로 쓴다.

| 파일                    | 단계 | 테이블                                                                                                                                    |
| ----------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `0002_t1_accounts.sql`  | T1   | **users(변경)**, **app_settings**, **app_tokens**, **upgrade_requests**, categories, fields, senior_profiles, senior_fields, senior_slots |
| `0003_t2_meetings.sql`  | T2   | questions, question_fields, encounters, encounter_windows, encounter_targets, balls, reviews, dex_entries                                 |
| `0004_t3_notify.sql`    | T3   | **notifications(v2)**, blocks, reports                                                                                                    |
| `0005_t4_knowledge.sql` | T4   | knowledge_entries, knowledge_fields                                                                                                       |
| `0006_t5_game.sql`      | T5   | intimacy_events                                                                                                                           |

> 운영진 요청을 줄이기 위해 **0002~0004는 첫 시간에**, 0005~0006은 두 번째 요청으로 묶어 원격 적용을 받는다. `questions.resolved_by_knowledge_id`는 T2에서 FK 없이 만들어 두고 T4부터 사용한다.

### 9.1 새로 추가·변경된 DDL

```sql
-- users (변경): 알림용 채팅방, 선배는 반드시 팀원 계정이 연결되어 있어야 함
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  channel_user_id      TEXT UNIQUE,
  channel_manager_id   TEXT UNIQUE,
  primary_user_chat_id TEXT,                 -- T3 알림 대상 채팅방
  nickname   TEXT NOT NULL,
  department TEXT,
  cohort_year INTEGER,
  notify_level TEXT NOT NULL DEFAULT 'all' CHECK (notify_level IN ('all','important','none')),
  is_senior INTEGER NOT NULL DEFAULT 0 CHECK (is_senior IN (0,1)),
  is_staff  INTEGER NOT NULL DEFAULT 0 CHECK (is_staff IN (0,1)),
  created_at TEXT NOT NULL,
  CHECK (channel_user_id IS NOT NULL OR channel_manager_id IS NOT NULL),
  CHECK (is_senior = 0 OR channel_manager_id IS NOT NULL)
);

CREATE TABLE app_settings (                  -- 그룹방 ID, 초대 링크, 매칭 조정값
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE app_tokens (                    -- 인스턴스 간 공유 토큰 캐시 (로그 출력 금지)
  cache_key TEXT PRIMARY KEY,                -- 'app' 또는 'channel:{channelId}'
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE upgrade_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  email TEXT,
  intro TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','approved','linked','rejected','expired')),
  code_hash TEXT,                            -- 연결 코드는 해시로만 저장
  code_expires_at TEXT,
  code_attempts INTEGER NOT NULL DEFAULT 0 CHECK (code_attempts BETWEEN 0 AND 5),
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  delivered_via TEXT CHECK (delivered_via IN ('user_chat','wam_only','email','manual')),
  linked_manager_id TEXT,
  created_at TEXT NOT NULL,
  CHECK (status <> 'approved' OR (code_hash IS NOT NULL AND code_expires_at IS NOT NULL)),
  CHECK (status <> 'linked'   OR linked_manager_id IS NOT NULL)
);
CREATE UNIQUE INDEX one_open_upgrade_per_user
  ON upgrade_requests(user_id) WHERE status IN ('requested','approved');

-- notifications (v2): 그룹방·고객 채팅방 모두 대상
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('group','user_chat')),
  target_id TEXT,                            -- user_chat은 발송 직전에 확정 가능
  target_user_id TEXT REFERENCES users(id),
  root_message_id TEXT,
  body_json TEXT NOT NULL,
  urgent INTEGER NOT NULL DEFAULT 0 CHECK (urgent IN (0,1)),
  due_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  run_id TEXT,
  sent_message_id TEXT,
  last_error TEXT,
  CHECK (target_type <> 'group'     OR target_id IS NOT NULL),
  CHECK (target_type <> 'user_chat' OR target_user_id IS NOT NULL)
);
CREATE INDEX idx_noti_due ON notifications(status, due_at);
```

### 9.2 스키마가 막는 잘못된 상태 (추가분)

- 팀원 계정 연결 없이 선배로 표시 → `users` CHECK
- 한 사람이 업그레이드 신청을 동시에 두 개 → 부분 유니크 인덱스
- 코드 없이 승인, 팀원 ID 없이 연결 완료 → `upgrade_requests` CHECK
- 대상 없는 알림 → `notifications` CHECK

---

## 10. 커맨드 최종 목록 (T0에서 전부 선언)

| 식별자        | 표시              | scope | alfMode       | 구현 단계       |
| ------------- | ----------------- | ----- | ------------- | --------------- |
| `me`          | 내정보            | front | disable       | T1              |
| `upgrade`     | 선배로-업그레이드 | front | **recommend** | T1              |
| `helpme`      | 선배-도와줘요     | front | **recommend** | T2              |
| `mybab`       | 내밥약            | front | **recommend** | T2              |
| `review`      | 후기              | front | disable       | T2              |
| `seniorstart` | 선배시작          | desk  | disable       | T1              |
| `senior`      | 선배등록          | desk  | disable       | T1              |
| `wild`        | 출현              | desk  | disable       | T2              |
| `balls`       | 포켓볼            | desk  | disable       | T2              |
| `dex`         | 도감              | desk  | disable       | T2 (고도화 T5)  |
| `answers`     | 답변              | desk  | disable       | T5              |
| `ops`         | 운영              | desk  | disable       | T1 (탭 확장 T4) |
| `opsconfig`   | 운영설정          | desk  | disable       | T0              |
| `rundue`      | 알림실행          | desk  | disable       | T0              |

총 14개 (상한 30개). 미구현 커맨드는 "준비 중이에요"를 반환한다.

---

## 11. 운영진 요청 목록 (단계별)

| 단계 | Channel 섹션 (서버·봇)                                                                                    | Manager 섹션 (WAM)                     | 그 외                                                        |
| ---- | --------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| T0   | `writeGroupMessage` ✅ 보유, (선택) `getGroup`                                                            | `writeGroupMessageAsManager` ✅ 보유   | 커맨드 14개 등록 갱신, 마이그레이션 0002~0004 원격 적용      |
| T1   | `writeUserChatMessage` (권장), `getUser`, `getManager`, (선택) `patchUser`·`findContactsByUser`·`getRole` | —                                      | 채널 설정: '선배' 역할·기본 역할·초대 링크                   |
| T2   | —                                                                                                         | —                                      | —                                                            |
| T3   | `writeUserChatMessage`, `getUserChat`, `createUserChat`, (선택) `createEvent`                             | (선택) `writeUserChatMessageAsManager` | (선택) Open API 키, Polling 확장 등록                        |
| T4   | (선택) 도큐먼트 `searchArticles`·`getArticle`                                                             | —                                      | (선택) LLM API 키, ALF·도큐먼트 설정, 마이그레이션 0005~0006 |
| T5   | —                                                                                                         | —                                      | —                                                            |

> **해커톤 시작 30분 안에 T1·T3 권한을 한꺼번에 요청**한다. 안 되면 각 단계의 폴백으로 진행한다: T1은 WAM 표시, T3은 L3(채팅 없는 만남).

---

## 12. 해커톤 일정 매핑 (약 9시간 기준)

| 시간      | 단계                                                       | 담당        |
| --------- | ---------------------------------------------------------- | ----------- |
| 0:00–1:00 | T0 + 권한·마이그레이션·등록 요청                           | 전원        |
| 1:00–3:30 | T1 계정 관리 / (병렬) T2 도메인 로직(매칭 v1, 선착순 쿼리) | A·B / C·D   |
| 3:30–5:30 | T2 WAM·통합 → **T2 MTF 통과 = 최소 시연 가능**             | 전원        |
| 5:30–7:00 | T3 알림 (권한 있을 때) / 없으면 T4 L2 유사 답              | A·B / C·D   |
| 7:00–7:45 | T4 일부 또는 T5 친밀도                                     | 여유에 따라 |
| 7:45–9:00 | 기능 동결, 시드 초기화, 데모 리허설 3회                    | 전원        |

**우선순위 규칙:** T2 MTF가 통과하기 전에는 T3~T5에 손대지 않는다. 데모는 "T1 업그레이드 → T2 한 바퀴 → (가능하면) T3 푸시"를 보여준다.

---

## 13. 미확인 사항과 리스크

| 항목                               | 영향                                 | 대응                                                               |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `writeUserChatMessage` 권한 미부여 | 후배 푸시 불가                       | T1: WAM 표시, T3: `/내밥약` 확인 + L3 만남                         |
| Open API 키 없음                   | 제한 역할 선배가 후배 채팅방을 못 봄 | L2 봇 중계 또는 L3                                                 |
| 초대 링크 유출                     | 제3자 팀원 가입                      | 제한 역할 + 앱 연결 코드 없으면 선배 기능 없음, 링크 짧은 유효기간 |
| 토큰 발급 제한 초과                | 봇 발송 실패                         | D1 공유 캐시, 발급 로그 모니터링                                   |
| 알림 과다                          | 후배 이탈                            | 조용한 시간, `notify_level`, 알림 채팅방 1개 재사용                |
| 봇 버튼 동작 불명                  | 알림방에서 바로 수락 불가            | 수락은 WAM에서만                                                   |
| 게임 IP                            | 외부 공개 시 문제                    | `HUBAE_GO_SPEC.md` §15 권고 유지                                   |

---

## 참고 문서

- 앱 인증·권한 (Channel/User/Manager 섹션): https://developers.channel.io/reference/app-authentication-kr
- 핵심 개념 (context, 토큰 종류·발급 제한): https://developers.channel.io/ko/articles/e7c2fb6f
- Function 등록: https://developers.channel.io/ko/articles/77250b17
- Native Functions (TypeScript): https://github.com/channel-io/app-sdk/blob/main/docs/reference/typescript/NATIVE.md
- WAM (`writeUserChatMessageAsManager` 예시): https://developers.channel.io/reference/app-wam-kr
- Command: https://developers.channel.io/ko/articles/Command-b3d200dc
- 역할과 권한: https://docs.channel.io/help/ko/articles/0cdd2005
- 팀원 초대 및 관리: https://docs.channel.io/help/ko/articles/%ED%8C%80%EC%9B%90-%EC%B4%88%EB%8C%80-%EB%B0%8F-%EA%B4%80%EB%A6%AC-4de540d2
- 팀원 및 봇 설정 (팀 공개 그룹 자동 초대): https://docs.channel.io/help/ko/articles/a215cda0
- Open API — UserChat 초대: https://developers.channel.io/docs/invite-to-a-userchat
- Open API 엔드포인트 목록 (n8n 노드): https://github.com/channel-io/n8n-nodes-channel-talk
