# 솦무위키 지식 한 번에 등록하기

기존 Channel App과 Cloudflare Worker는 건드리지 않는다. 아래 명령은 로컬에서
`data/knowledge/documents.jsonl`을 읽어 `솦무위키` Documents Space에 아티클을
생성하고 바로 퍼블리시한다.

## 1. Channel에서 한 번만 준비

1. `팀 → 도큐먼트`에서 이름이 정확히 `솦무위키`인 Space를 만든다.
2. Space 설정에서 Documents Open API key를 발급한다.
3. 루트의 `channel-documents.env.example`을 `.env.documents.local`로 복사한다.
4. 발급받은 access key와 access secret을 입력한다. 이 파일은 Git에 포함되지
   않는다.

```sh
cp channel-documents.env.example .env.documents.local
```

```dotenv
CHANNEL_DOCUMENT_ACCESS_KEY=발급받은_access_key
CHANNEL_DOCUMENT_ACCESS_SECRET=발급받은_access_secret
CHANNEL_DOCUMENT_EXPECTED_SPACE_NAME=솦무위키
```

## 2. 계획 확인 (선택)

```sh
pnpm knowledge:plan
```

정상 기준:

- 솦무위키 원본 83개
- Documents 아티클 85개
- 이미지 block 제외, 이미지 설명 텍스트 유지
- `학교 근처 맛집 및 놀거리`와 `교내&교외 학습 공간 / 늦게까지 하는 카페` 자동
  분할

## 3. 한 번에 등록·퍼블리시

```sh
pnpm knowledge:publish
```

중간에 실패해도 성공한 문서와 마지막 draft가
`data/knowledge/channel-sync.json`에 저장된다. 같은 명령을 다시 실행하면 이미
같은 내용으로 퍼블리시된 문서는 건너뛰고 이어서 처리한다.

이 명령은 기존 아티클을 자동 삭제하거나 unpublish하지 않는다. API key가 가리키는
Space 이름이 `솦무위키`가 아니면 업로드 전에 중단한다.

## 4. ALF에서 참조 켜기

등록 완료 후 `서포트 → ALF → 설정 → 지식`에서 자동으로 나타난 `솦무위키` Space의
`ALF 참조`를 켠다. 실제 고객 배포 전에는 미리보기에서 대표 질문을 확인한다.
