import {
  FunctionCallError,
  FunctionCallErrorCode,
} from "@channel.io/app-sdk-server";
import type {
  BallCard,
  BallListOutput,
  BallStatus,
  ConfirmMetOutput,
  EncounterStatus,
  RemindOutput,
} from "@tutorial/shared";
import { getDatabase } from "../../database.js";
import { nowIso } from "../../id.js";

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
  const ball = await getDatabase()
    .prepare(
      "SELECT id, encounter_id, senior_id, status, reminders_sent FROM balls WHERE id = ?",
    )
    .bind(ballId)
    .first<BallRow>();
  if (!ball) {
    throw new FunctionCallError(
      "볼을 찾을 수 없어요",
      FunctionCallErrorCode.BadRequest,
      { type: "NOT_FOUND" },
    );
  }
  return ball;
}

function assertOwnedBySenior(ball: BallRow, seniorId: string): void {
  if (ball.senior_id !== seniorId) {
    throw new FunctionCallError(
      "내 볼이 아니에요",
      FunctionCallErrorCode.BadRequest,
      { type: "FORBIDDEN" },
    );
  }
}

export async function confirmMet(
  ballId: string,
  seniorId: string,
): Promise<ConfirmMetOutput> {
  const db = getDatabase();
  const ball = await getBallOrThrow(ballId);
  assertOwnedBySenior(ball, seniorId);
  if (ball.status !== "thrown") {
    throw new FunctionCallError(
      "이미 처리된 볼이에요",
      FunctionCallErrorCode.BadRequest,
      { type: "CLOSED" },
    );
  }

  const now = nowIso();

  // 같은 출현의 다른 볼(다른 선배)도 함께 온다. 한 명만 확인해도 같은 만남으로
  // 간주해 전부 wobbling으로 넘긴다 (§7.5 "지금은 정본으로 정한" 설계 결정).
  await db
    .prepare(
      "UPDATE balls SET status = 'wobbling', met_confirmed_at = ? WHERE encounter_id = ? AND status = 'thrown'",
    )
    .bind(now, ball.encounter_id)
    .run();

  const reviewDueAt = new Date(
    Date.now() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await db
    .prepare(
      "UPDATE encounters SET status = 'met', review_due_at = ? WHERE id = ? AND status = 'matched'",
    )
    .bind(reviewDueAt, ball.encounter_id)
    .run();

  const encounter = await db
    .prepare("SELECT id, status, review_due_at FROM encounters WHERE id = ?")
    .bind(ball.encounter_id)
    .first<EncounterRow>();
  if (!encounter) {
    throw new FunctionCallError(
      "출현 정보를 찾을 수 없어요",
      FunctionCallErrorCode.Internal,
      { type: "ENCOUNTER_MISSING" },
    );
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
  const db = getDatabase();
  const ball = await getBallOrThrow(ballId);
  assertOwnedBySenior(ball, seniorId);

  if (ball.status !== "wobbling") {
    throw new FunctionCallError(
      "지금은 재촉할 수 없는 상태예요",
      FunctionCallErrorCode.BadRequest,
      { type: ball.status === "thrown" ? "REVIEW_NOT_READY" : "CLOSED" },
    );
  }
  if (ball.reminders_sent >= 2) {
    throw new FunctionCallError(
      "재촉은 볼당 2번까지예요",
      FunctionCallErrorCode.BadRequest,
      { type: "REMINDER_LIMIT" },
    );
  }

  await db
    .prepare("UPDATE balls SET reminders_sent = reminders_sent + 1 WHERE id = ?")
    .bind(ballId)
    .run();

  // T3(writeUserChatMessage 권한)가 아직 없어 자동 발송이 불가능하다.
  // 지금은 선배가 직접 붙여넣을 문구만 돌려주고, 권한이 생기면 이 함수 안에서
  // outbox에 enqueue하는 분기만 추가하면 된다 (호출부는 그대로).
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
  const { results } = await getDatabase()
    .prepare(
      `SELECT b.id, b.encounter_id, b.status, b.reminders_sent,
              e.title, e.slot_start, e.slot_end, e.place, e.review_due_at,
              u.nickname AS junior_nickname
       FROM balls b
       JOIN encounters e ON e.id = b.encounter_id
       JOIN users u ON u.id = e.junior_id
       WHERE b.senior_id = ?
       ORDER BY b.thrown_at DESC`,
    )
    .bind(seniorId)
    .all<BallListRow>();

  const items: BallCard[] = results.map((row) => ({
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
