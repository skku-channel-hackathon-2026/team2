// 로컬에서 실제 서버(wrangler dev --local)를 통해 T2/T3/T5 핵심 시나리오
// 3개를 재현하는 스크립트. 사람이 직접 따라 하거나(docs/MANUAL_TESTING.md
// 참고), 이 스크립트로 한 번에 돌려볼 수 있다.
//
// 사용법 (두 터미널):
//   1) corepack pnpm exec wrangler dev --local --port 8797
//   2) corepack pnpm exec wrangler d1 execute DB --local --file=scripts/seed-demo.sql
//      (매번 새로 시드하고 싶으면 먼저 .wrangler/state 를 지우고
//       db:migrate:local 을 다시 실행)
//   3) node scripts/manual-test.mjs [scenario1|scenario2|scenario3|all]
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const origin = process.env.SMOKE_ORIGIN ?? "http://127.0.0.1:8797";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
  throw new Error("This manual test is local-only");
}

function readSigningKey() {
  const text = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8");
  const line = text.split("\n").find((l) => l.startsWith("SIGNING_KEY="));
  if (!line) throw new Error("SIGNING_KEY missing from .dev.vars");
  return Buffer.from(line.slice("SIGNING_KEY=".length).trim(), "hex");
}
const signingKey = readSigningKey();

/**
 * 채널톡이 실제로 서명해서 보내는 요청과 같은 모양: 서명 대상 body 안에
 * context.caller가 그대로 들어간다(SDK 자체 테스트 코드에서 확인). 로컬
 * 서명 키를 알고 있으므로 우리가 직접 caller를 지정해 서명할 수 있다.
 */
async function callFunction(method, context, params = {}) {
  const body = JSON.stringify({ method, context, params });
  const signature = createHmac("sha256", signingKey).update(body).digest("base64");
  const response = await fetch(`${origin}/functions/v1`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-signature": signature },
    body,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, body: json };
}

const CHANNEL = { id: "test-channel" };
const asSenior1 = { caller: { type: "manager", id: "m-senior-1" }, channel: CHANNEL };
const asSenior2 = { caller: { type: "manager", id: "m-senior-2" }, channel: CHANNEL };
const asJunior1 = { caller: { type: "user", id: "u-junior-1" }, channel: CHANNEL };

function log(title) {
  console.log(`\n=== ${title} ===`);
}

/** 시나리오 1 — 선착순 수락: 두 선배가 같은 출현(max_seniors=1)을 동시에
 *  수락해도 한 명만 성공해야 한다. seed의 encounter-2를 사용한다. */
async function scenario1() {
  log("시나리오 1: 선착순 수락 동시성 (encounter-2, max_seniors=1)");
  const [a, b] = await Promise.all([
    callFunction("wild.accept", asSenior1, { encounterId: "encounter-2", slot: { startAt: "2026-09-21T03:00:00.000Z", endAt: "2026-09-21T04:00:00.000Z" }, place: "학생회관" }),
    callFunction("wild.accept", asSenior2, { encounterId: "encounter-2", slot: { startAt: "2026-09-21T03:00:00.000Z", endAt: "2026-09-21T04:00:00.000Z" }, place: "학생회관" }),
  ]);
  console.log("senior-1:", a.status, JSON.stringify(a.body));
  console.log("senior-2:", b.status, JSON.stringify(b.body));

  const results = [a, b];
  const succeeded = results.filter((r) => r.status === 200);
  const rejected = results.filter((r) => r.status !== 200);
  assert.equal(succeeded.length, 1, "정확히 한 명만 성공해야 함");
  assert.equal(rejected.length, 1, "나머지 한 명은 거절돼야 함");
  console.log("PASS: max_seniors=1인 출현에 정확히 1명만 수락됨");
}

/** 시나리오 2 — 만남 완료 → 후기 제출 → 도감·친밀도. seed의 encounter-1
 *  (이미 matched, senior-1·senior-2 볼 thrown 상태)을 사용한다. */
async function scenario2() {
  log("시나리오 2: 만남 완료 → 후기 → 도감 (encounter-1)");

  const confirm = await callFunction("ball.confirmMet", asSenior1, { ballId: "ball-1" });
  console.log("ball.confirmMet:", confirm.status, JSON.stringify(confirm.body));
  assert.equal(confirm.status, 200);
  assert.equal(confirm.body.encounterStatus, "met");

  const review = await callFunction("review.submit", asJunior1, {
    encounterId: "encounter-1",
    rating: 5,
    reviewText: "학회는 스터디 중심, 동아리는 프로젝트 중심이라는 설명이 도움됐어요.",
    selfAnswer: "1학년이면 학회로 기초를 다지는 걸 추천.",
    shareConsent: true,
  });
  console.log("review.submit:", review.status, JSON.stringify(review.body));
  assert.equal(review.status, 200);
  assert.equal(review.body.caughtBy.length, 2, "senior-1·senior-2 둘 다 잡아야 함");

  const dex = await callFunction("dex.list", asSenior1);
  console.log("dex.list (senior-1):", dex.status, JSON.stringify(dex.body));
  assert.equal(dex.status, 200);
  assert.ok(dex.body.items.some((item) => item.juniorAlias === "코딩초보"));
  console.log("PASS: 후기 제출 후 두 선배 모두 도감에 후배가 등록됨");
}

/** 시나리오 3 — 재촉 한도. encounter-1/2와 겹치지 않는 encounter-3/ball-3를
 *  쓴다(다른 시나리오가 먼저 도는 순서에 영향받지 않도록 독립시킴). 먼저
 *  confirmMet으로 wobbling까지 보낸 뒤 재촉을 3번 시도한다. */
async function scenario3() {
  log("시나리오 3: 재촉은 볼당 2번까지 (encounter-3, ball-3)");

  const confirm = await callFunction("ball.confirmMet", asSenior1, { ballId: "ball-3" });
  console.log("ball.confirmMet:", confirm.status, JSON.stringify(confirm.body));
  assert.equal(confirm.status, 200);

  for (let i = 1; i <= 2; i += 1) {
    const result = await callFunction("ball.remind", asSenior1, { ballId: "ball-3" });
    console.log(`remind #${i}:`, result.status, JSON.stringify(result.body));
    assert.equal(result.status, 200);
    assert.equal(result.body.remindersSent, i);
  }
  const third = await callFunction("ball.remind", asSenior1, { ballId: "ball-3" });
  console.log("remind #3 (넘음):", third.status, JSON.stringify(third.body));
  assert.equal(third.status, 400);
  console.log("PASS: 3번째 재촉은 거절됨 (delivered 값은 권한 여부에 따라 auto 또는 manual_copy)");
}

const scenarios = { scenario1, scenario2, scenario3 };
const requested = process.argv[2] ?? "all";
const toRun = requested === "all" ? Object.values(scenarios) : [scenarios[requested]];
if (toRun.some((fn) => !fn)) {
  console.error(`Unknown scenario "${requested}". Use one of: ${Object.keys(scenarios).join(", ")}, all`);
  process.exit(1);
}

for (const run of toRun) {
  await run();
}
console.log("\n모든 시나리오 통과.");
