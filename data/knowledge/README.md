# 통합 RAG 지식 데이터

`data/` 아래의 수집 원본은 각 수집기가 관리하며 Git에서 제외한다. 이 폴더만 모든 출처를 공통 스키마로 정규화한 결과로 추적한다.

## 파일

- `schema.json`: `documents.jsonl` 레코드의 JSON Schema
- `documents.jsonl`: 통합 지식 문서. 공개 가능 여부와 출처 등급을 포함한다.
- `assets.jsonl`: 이미지·PDF 등 자산의 원본 경로, 설명, 공개 URL 준비 상태
- `review-queue.jsonl`: 사람이 확인해야 하는 문서와 사유
- `rejected.jsonl`: 지식으로 사용하지 않는 문서와 제외 사유
- `conflicts.jsonl`: 서로 다른 출처에서 같은 제목으로 충돌한 문서
- `quality-report.json`: 출처별 수량과 품질 문제 집계
- `manifest.json`: 빌드 버전과 파일별 레코드 수

## 출처 등급

우선순위는 아래와 같다. 낮은 등급의 문서가 높은 등급의 공식 사실을 덮어쓰면 안 된다.

1. `official-current`: 학교 공식 홈페이지의 현행 자료
2. `official-archived`: 만료되었거나 과거 시점의 학교 공식 자료
3. `curated-community`: 솦무위키처럼 편집된 학생 자료
4. `community-anecdote`: 에브리타임 등 익명 경험담
5. `social-review`: SNS 맛집·생활 후기

## 검수 상태

- `approved`: 내용상 Channel 지식 후보로 사용할 수 있음
- `needs_review`: 출처·최신성·변환 결과를 사람이 확인해야 함
- `rejected`: 답변 근거로 사용하지 않음

`approved`라도 `channel.publishReady`가 `false`일 수 있다. 이미지에 공개 URL이 없거나 자료가 만료된 경우가 이에 해당한다.

## 다시 생성하기

수집 원본이 로컬에 있어야 한다.

```sh
node scripts/build-knowledge.mjs
```

현재 결과와 원본에서 다시 만든 결과가 같은지 확인만 하려면:

```sh
node scripts/build-knowledge.mjs --check
```

생성기는 다음 원칙을 지킨다.

- 원본을 수정하거나 삭제하지 않는다.
- `추천: No`를 포함한 솦무위키 메타데이터를 보존한다.
- 이미지 파일을 중복 복사하지 않고 `assets.jsonl`에서 원본 경로를 참조한다.
- 에브리타임 자료는 자동 퍼블리시하지 않는다.
- SNS 후기는 현재 영업·가격 정보로 간주하지 않는다.
- 공식 일정은 월 단위로 묶고, 식단은 유효기간을 기록한다.
- 규정 PDF의 텍스트는 검색 가능하도록 추출하되 검수 대상으로 둔다.

## Channel Documents로 보낼 때

`documents.jsonl`에서 아래 조건을 모두 만족하는 문서만 importer 입력으로 사용한다.

```text
review.status == "approved"
channel.publishEligible == true
channel.publishReady == true
```

이미지는 `assets.jsonl`의 `publicUrl`을 채운 뒤 본문 링크가 아니라 직접 이미지 block으로 삽입한다. 긴 문서와 이미지가 40개를 넘는 문서는 `channel.requiresSplit` 및 `channel.splitReasons`를 확인해 의미 있는 제목 경계로 나눈다.
