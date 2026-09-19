import { ERROR_CODES } from "@tutorial/shared";
import type {
  BallCard,
  BallListOutput,
  BallStatus,
  ConfirmMetOutput,
  EncounterStatus,
  RemindOutput,
} from "@tutorial/shared";
import { execute, queryAll, queryOne } from "../../database.js";
import { badRequest } from "../../errors.js";
import { nowIso } from "../../util.js";

const REVIEW_WINDOW_DAYS = 7;

interface BallRow {
  id: string;
  encounter_id: string;
  senior_id: string;
  status: BallStatus;
  reminders_sent: number;
}

interface EncounterRow {
  id: string;
  status: EncounterStatus;
  review_due_at: string | null;
}

async function getBallOrThrow(ballId: string): Promise<BallRow> {
  const ball = await queryOne<BallRow>(
    "SELECT id, encounter_id, senior_id, status, reminders_sent FROM balls WHERE id = ?",
    ballId,
  );
  if (!ball) {
    throw badRequest("볼을 찾을 수 없어요", ERROR_CODES.notFound);
  }
  return ball;
}

function assertOwnedBySenior(ball: BallRow, seniorId: string): void {
  if (ball.senior_id !== seniorId) {
    throw badRequest("내 볼이 아니에요", ERROR_CODES.forbidden);
  }
}

export async function confirmMet(
  ballId: string,
  seniorId: string,
): Promise<ConfirmMetOutput> {
  const ball = await getBallOrThrow(ballId);
  assertOwnedBySenior(ball, seniorId);
  if (ball.status !== "thrown") {
    throw badRequest("이미 처리된 볼이에요", ERROR_CODES.closed);
  }

  const now = nowIso();

  // 같은 출현의 다른 볼(다른 선배)도 함께 온다. 한 명만 확인해도 같은 만남으로
  // 간주해 전부 wobbling으로 넘긴다 (설계 결정: HUBAE_GO_PLAN.md T5 참고).
  await execute(
    "UPDATE balls SET status = 'wobbling', met_confirmed_at = ? WHERE encounter_id = ? AND status = 'thrown'",
    now,
    ball.encounter_id,
  );

  const reviewDueAt = new Date(
    Date.now() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await execute(
    "UPDATE encounters SET status = 'met', review_due_at = ? WHERE id = ? AND status = 'matched'",
    reviewDueAt,
    ball.encounter_id,
  );

  const encounter = await queryOne<EncounterRow>(
    "SELECT id, status, review_due_at FROM encounters WHERE id = ?",
    ball.encounter_id,
  );
  if (!encounter) {
    throw badRequest("출현 정보를 찾을 수 없어요", ERROR_CODES.notFound);
  }

  return {
    ballStatus: "wobbling",
    encounterStatus: encounter.status,
    reviewDueAt: encounter.review_due_at,
  };
}

export async function remind(
  ballId: string,
  seniorId: string,
): Promise<RemindOutput> {
  const ball = await getBallOrThrow(ballId);
  assertOwnedBySenior(ball, seniorId);

  if (ball.status !== "wobbling") {
    throw badRequest(
      "지금은 재촉할 수 없는 상태예요",
      ball.status === "thrown" ? ERROR_CODES.reviewNotReady : ERROR_CODES.closed,
    );
  }
  if (ball.reminders_sent >= 2) {
    throw badRequest("재촉은 볼당 2번까지예요", ERROR_CODES.reminderLimit);
  }

  await execute(
    "UPDATE balls SET reminders_sent = reminders_sent + 1 WHERE id = ?",
    ballId,
  );

  // T3(writeUserChatMessage 권한)가 아직 없어 자동 발송이 불가능하다.
  // 지금은 선배가 직접 붙여넣을 문구만 돌려주고, 권한이 생기면 이 함수 안에서
  // outbox(notifications.service)에 enqueue하는 분기만 추가하면 된다.
  const messageTemplate =
    "선배가 기다리고 있어요! 후기를 남기면 선배 도감에 등록돼요 🍚";

  return {
    remindersSent: ball.reminders_sent + 1,
    messageTemplate,
    delivered: "manual_copy",
  };
}

interface BallListRow {
  id: string;
  encounter_id: string;
  status: BallStatus;
  reminders_sent: number;
  title: string;
  slot_start: string | null;
  slot_end: string | null;
  place: string | null;
  review_due_at: string | null;
  junior_nickname: string;
}

export async function listForSenior(seniorId: string): Promise<BallListOutput> {
  const rows = await queryAll<BallListRow>(
    `SELECT b.id, b.encounter_id, b.status, b.reminders_sent,
            e.title, e.slot_start, e.slot_end, e.place, e.review_due_at,
            u.nickname AS junior_nickname
     FROM balls b
     JOIN encounters e ON e.id = b.encounter_id
     JOIN users u ON u.id = e.junior_id
     WHERE b.senior_id = ?
     ORDER BY b.thrown_at DESC`,
    seniorId,
  );

  const items: BallCard[] = rows.map((row) => ({
    ballId: row.id,
    encounterId: row.encounter_id,
    status: row.status,
    title: row.title,
    slotStart: row.slot_start,
    slotEnd: row.slot_end,
    place: row.place,
    juniorAlias: row.junior_nickname,
    remindersLeft: 2 - row.reminders_sent,
    reviewDueAt: row.review_due_at,
  }));

  return { items };
}
