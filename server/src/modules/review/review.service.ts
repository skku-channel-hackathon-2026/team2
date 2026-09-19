import {
  FunctionCallError,
  FunctionCallErrorCode,
} from "@channel.io/app-sdk-server";
import type {
  EncounterStatus,
  ReviewSubmitInput,
  ReviewSubmitOutput,
  SeniorCard,
} from "@tutorial/shared";
import { intimacyLevel } from "@tutorial/shared";
import { getDatabase } from "../../database.js";
import { nowIso } from "../../id.js";
import { registerCatch } from "../dex/dex.service.js";
import { awardIntimacy } from "../intimacy/intimacy.service.js";

interface EncounterRow {
  id: string;
  junior_id: string;
  category_id: string;
  status: EncounterStatus;
}

interface WobblingBallRow {
  id: string;
  senior_id: string;
  senior_nickname: string;
  intimacy: number | null;
}

export async function submitReview(
  juniorId: string,
  input: ReviewSubmitInput,
): Promise<ReviewSubmitOutput> {
  const db = getDatabase();

  const encounter = await db
    .prepare(
      "SELECT id, junior_id, category_id, status FROM encounters WHERE id = ?",
    )
    .bind(input.encounterId)
    .first<EncounterRow>();
  if (!encounter) {
    throw new FunctionCallError(
      "출현을 찾을 수 없어요",
      FunctionCallErrorCode.BadRequest,
      { type: "NOT_FOUND" },
    );
  }
  if (encounter.junior_id !== juniorId) {
    throw new FunctionCallError(
      "내 출현이 아니에요",
      FunctionCallErrorCode.BadRequest,
      { type: "FORBIDDEN" },
    );
  }
  if (encounter.status !== "met") {
    throw new FunctionCallError(
      "만남이 끝난 뒤에 쓸 수 있어요",
      FunctionCallErrorCode.BadRequest,
      { type: "REVIEW_NOT_READY" },
    );
  }

  const existingReview = await db
    .prepare("SELECT encounter_id FROM reviews WHERE encounter_id = ?")
    .bind(input.encounterId)
    .first();
  if (existingReview) {
    throw new FunctionCallError(
      "이미 후기를 남겼어요",
      FunctionCallErrorCode.BadRequest,
      { type: "REVIEW_ALREADY_DONE" },
    );
  }

  const now = nowIso();

  // 아래 각 단계는 이 최소 D1 래퍼(server/src/database.ts)가 배치 트랜잭션을
  // 지원하지 않아 순차 실행이다 — 원자적이지 않다. 해커톤 범위에서는
  // 요청 하나 안에서 순서대로 실패 없이 끝나는 걸로 충분하다고 보고,
  // 나중에 D1 batch()로 묶는 걸 후속 과제로 남긴다.
  await db
    .prepare(
      `INSERT INTO reviews (encounter_id, junior_id, rating, review_text, self_answer, share_consent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.encounterId,
      juniorId,
      input.rating,
      input.reviewText,
      input.selfAnswer ?? null,
      input.shareConsent ? 1 : 0,
      now,
    )
    .run();

  await db
    .prepare("UPDATE encounters SET status = 'caught' WHERE id = ?")
    .bind(input.encounterId)
    .run();

  const { results: wobblingBalls } = await db
    .prepare(
      `SELECT b.id, b.senior_id, u.nickname AS senior_nickname
       FROM balls b
       JOIN users u ON u.id = b.senior_id
       WHERE b.encounter_id = ? AND b.status = 'wobbling'`,
    )
    .bind(input.encounterId)
    .all<WobblingBallRow>();

  const caughtBy: SeniorCard[] = [];

  for (const ball of wobblingBalls) {
    await db
      .prepare("UPDATE balls SET status = 'caught', caught_at = ? WHERE id = ?")
      .bind(now, ball.id)
      .run();

    const { wasFirstCatch } = await registerCatch({
      seniorId: ball.senior_id,
      juniorId,
      typeCategoryId: encounter.category_id,
      caughtAt: now,
      shareConsent: input.shareConsent,
    });

    let totalPoints = await awardIntimacy({
      seniorId: ball.senior_id,
      juniorId,
      kind: wasFirstCatch ? "first_catch" : "repeat_catch",
      dedupeKey: `${wasFirstCatch ? "first_catch" : "repeat_catch"}:${input.encounterId}:${ball.senior_id}`,
    });

    if (input.rating === 5) {
      totalPoints += await awardIntimacy({
        seniorId: ball.senior_id,
        juniorId,
        kind: "five_star",
        dedupeKey: `five_star:${input.encounterId}:${ball.senior_id}`,
      });
    }
    if (input.selfAnswer) {
      totalPoints += await awardIntimacy({
        seniorId: ball.senior_id,
        juniorId,
        kind: "self_answer",
        dedupeKey: `self_answer:${input.encounterId}:${ball.senior_id}`,
      });
    }

    const dexEntry = await db
      .prepare(
        "SELECT intimacy FROM dex_entries WHERE senior_id = ? AND junior_id = ?",
      )
      .bind(ball.senior_id, juniorId)
      .first<{ intimacy: number }>();

    caughtBy.push({
      seniorId: ball.senior_id,
      seniorAlias: ball.senior_nickname,
      level: intimacyLevel(dexEntry?.intimacy ?? totalPoints),
    });
  }

  return { caughtBy };
}
