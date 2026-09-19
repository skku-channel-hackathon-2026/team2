import { ERROR_CODES, intimacyLevel } from "@tutorial/shared";
import type {
  EncounterStatus,
  ReviewSubmitInput,
  ReviewSubmitOutput,
  SeniorCard,
} from "@tutorial/shared";
import { execute, queryAll, queryOne } from "../../database.js";
import { badRequest } from "../../errors.js";
import { nowIso } from "../../util.js";
import { registerCatch } from "../dex/dex.service.js";
import { awardIntimacy } from "../intimacy/intimacy.service.js";

interface EncounterRow {
  id: string;
  junior_id: string;
  field_id: string;
  status: EncounterStatus;
}

interface WobblingBallRow {
  id: string;
  senior_id: string;
  senior_nickname: string;
}

export async function submitReview(
  juniorId: string,
  input: ReviewSubmitInput,
): Promise<ReviewSubmitOutput> {
  const encounter = await queryOne<EncounterRow>(
    "SELECT id, junior_id, field_id, status FROM encounters WHERE id = ?",
    input.encounterId,
  );
  if (!encounter) {
    throw badRequest("출현을 찾을 수 없어요", ERROR_CODES.notFound);
  }
  if (encounter.junior_id !== juniorId) {
    throw badRequest("내 출현이 아니에요", ERROR_CODES.forbidden);
  }
  if (encounter.status !== "met") {
    throw badRequest("만남이 끝난 뒤에 쓸 수 있어요", ERROR_CODES.reviewNotReady);
  }

  const existingReview = await queryOne(
    "SELECT encounter_id FROM reviews WHERE encounter_id = ?",
    input.encounterId,
  );
  if (existingReview) {
    throw badRequest("이미 후기를 남겼어요", ERROR_CODES.reviewAlreadyDone);
  }

  const now = nowIso();

  // 아래 각 단계는 순차 실행이며 원자적이지 않다(중간에 실패하면 부분 반영될 수
  // 있음). 해커톤 범위에서는 이 정도로 충분하다고 보고, 후속 과제로 남긴다.
  await execute(
    `INSERT INTO reviews (encounter_id, junior_id, rating, review_text, self_answer, share_consent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.encounterId,
    juniorId,
    input.rating,
    input.reviewText,
    input.selfAnswer ?? null,
    input.shareConsent ? 1 : 0,
    now,
  );

  await execute(
    "UPDATE encounters SET status = 'caught' WHERE id = ?",
    input.encounterId,
  );

  const wobblingBalls = await queryAll<WobblingBallRow>(
    `SELECT b.id, b.senior_id, u.nickname AS senior_nickname
     FROM balls b
     JOIN users u ON u.id = b.senior_id
     WHERE b.encounter_id = ? AND b.status = 'wobbling'`,
    input.encounterId,
  );

  const caughtBy: SeniorCard[] = [];

  for (const ball of wobblingBalls) {
    await execute(
      "UPDATE balls SET status = 'caught', caught_at = ? WHERE id = ?",
      now,
      ball.id,
    );

    const { wasFirstCatch } = await registerCatch({
      seniorId: ball.senior_id,
      juniorId,
      typeFieldId: encounter.field_id,
      caughtAt: now,
      shareConsent: input.shareConsent,
    });

    await awardIntimacy({
      seniorId: ball.senior_id,
      juniorId,
      kind: wasFirstCatch ? "first_catch" : "repeat_catch",
      dedupeKey: `${wasFirstCatch ? "first_catch" : "repeat_catch"}:${input.encounterId}:${ball.senior_id}`,
    });

    if (input.rating === 5) {
      await awardIntimacy({
        seniorId: ball.senior_id,
        juniorId,
        kind: "five_star",
        dedupeKey: `five_star:${input.encounterId}:${ball.senior_id}`,
      });
    }
    if (input.selfAnswer) {
      await awardIntimacy({
        seniorId: ball.senior_id,
        juniorId,
        kind: "self_answer",
        dedupeKey: `self_answer:${input.encounterId}:${ball.senior_id}`,
      });
    }

    const dexEntry = await queryOne<{ intimacy: number }>(
      "SELECT intimacy FROM dex_entries WHERE senior_id = ? AND junior_id = ?",
      ball.senior_id,
      juniorId,
    );

    caughtBy.push({
      seniorId: ball.senior_id,
      seniorAlias: ball.senior_nickname,
      level: intimacyLevel(dexEntry?.intimacy ?? 0),
    });
  }

  return { caughtBy };
}
