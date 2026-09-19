import { ERROR_CODES } from "@tutorial/shared";
import type {
  EncounterStatus,
  WildAcceptInput,
  WildAcceptOutput,
  WildCard,
  WildListOutput,
} from "@tutorial/shared";
import { changedRows, execute, queryAll, queryOne } from "../../database.js";
import { badRequest } from "../../errors.js";
import { newId, nowIso } from "../../util.js";
import { overlapWindowsForSenior } from "../matching/matching.service.js";
import type { NotificationsService } from "../../notifications.service.js";

interface WildRow {
  id: string;
  title: string;
  field_id: string;
  field_label: string | null;
  meet_type: "meal" | "cafe" | "online";
  max_seniors: number;
  seniors_joined: number;
  junior_nickname: string;
}

export async function listWild(seniorId: string): Promise<WildListOutput> {
  const rows = await queryAll<WildRow>(
    `SELECT e.id, e.title, e.field_id, f.label AS field_label,
            e.meet_type, e.max_seniors,
            u.nickname AS junior_nickname,
            (SELECT COUNT(*) FROM balls b WHERE b.encounter_id = e.id AND b.status <> 'cancelled') AS seniors_joined
     FROM encounters e
     JOIN encounter_targets t ON t.encounter_id = e.id AND t.senior_id = ?
     JOIN users u ON u.id = e.junior_id
     LEFT JOIN fields f ON f.id = e.field_id
     WHERE e.status IN ('wild','matched')
       AND NOT EXISTS (SELECT 1 FROM balls b2 WHERE b2.encounter_id = e.id AND b2.senior_id = ?)
     ORDER BY e.created_at ASC`,
    seniorId,
    seniorId,
  );

  const items: WildCard[] = [];
  for (const row of rows) {
    const windows = await queryAll<{ start_at: string; end_at: string }>(
      "SELECT start_at, end_at FROM encounter_windows WHERE encounter_id = ?",
      row.id,
    );
    const overlapWindows = await overlapWindowsForSenior(
      seniorId,
      windows.map((w) => ({ startAt: w.start_at, endAt: w.end_at })),
    );
    items.push({
      encounterId: row.id,
      title: row.title,
      fieldId: row.field_id,
      fieldLabel: row.field_label ?? row.field_id,
      meetType: row.meet_type,
      overlapWindows,
      seniorsJoined: row.seniors_joined,
      maxSeniors: row.max_seniors,
      juniorAlias: row.junior_nickname,
    });
  }

  return { items };
}

export async function acceptWild(
  senior: { id: string; nickname: string },
  input: WildAcceptInput,
  deps: { notifications: NotificationsService; channelId: string },
): Promise<WildAcceptOutput> {
  const seniorId = senior.id;
  const encounter = await queryOne<{
    id: string;
    status: EncounterStatus;
    max_seniors: number;
    junior_id: string;
  }>(
    "SELECT id, status, max_seniors, junior_id FROM encounters WHERE id = ?",
    input.encounterId,
  );
  if (!encounter) {
    throw badRequest("출현을 찾을 수 없어요", ERROR_CODES.notFound);
  }
  if (encounter.status !== "wild" && encounter.status !== "matched") {
    throw badRequest("이미 끝난 출현이에요", ERROR_CODES.closed);
  }

  const target = await queryOne(
    "SELECT 1 FROM encounter_targets WHERE encounter_id = ? AND senior_id = ?",
    input.encounterId,
    seniorId,
  );
  if (!target) {
    throw badRequest("이번 출현의 대상이 아니에요", ERROR_CODES.forbidden);
  }

  const existingBall = await queryOne(
    "SELECT 1 FROM balls WHERE encounter_id = ? AND senior_id = ?",
    input.encounterId,
    seniorId,
  );
  if (existingBall) {
    throw badRequest("이미 수락했어요", ERROR_CODES.alreadyAccepted);
  }

  const isFirst = encounter.status === "wild";
  if (isFirst && !input.slot) {
    throw badRequest(
      "첫 수락자는 만날 시간을 골라야 해요",
      ERROR_CODES.slotRequired,
    );
  }

  const ballId = newId("bal");
  const now = nowIso();

  // 선착순 수락의 핵심: "대상자이고, 아직 max_seniors명 미만이고, 열린 출현일
  // 때만" 볼을 만든다. D1(SQLite)은 쓰기를 직렬화하므로 동시에 눌러도
  // max_seniors를 넘지 않는다 (HUBAE_GO_SPEC.md §9.3).
  const result = await execute(
    `INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at)
     SELECT ?, ?, ?, 'thrown', ?
     WHERE EXISTS (SELECT 1 FROM encounter_targets WHERE encounter_id = ? AND senior_id = ?)
       AND EXISTS (SELECT 1 FROM encounters WHERE id = ? AND status IN ('wild','matched'))
       AND (SELECT COUNT(*) FROM balls WHERE encounter_id = ? AND status <> 'cancelled') < ?`,
    ballId,
    input.encounterId,
    seniorId,
    now,
    input.encounterId,
    seniorId,
    input.encounterId,
    input.encounterId,
    encounter.max_seniors,
  );

  if (changedRows(result) !== 1) {
    throw badRequest("아쉽게도 다른 선배가 먼저 잡았어요!", ERROR_CODES.full);
  }

  if (isFirst && input.slot) {
    await execute(
      `UPDATE encounters SET status = 'matched', slot_start = ?, slot_end = ?, place = ?, next_wave_at = NULL
       WHERE id = ? AND status = 'wild'`,
      input.slot.startAt,
      input.slot.endAt,
      input.place ?? null,
      input.encounterId,
    );
  }

  const final = await queryOne<{
    slot_start: string | null;
    slot_end: string | null;
  }>(
    "SELECT slot_start, slot_end FROM encounters WHERE id = ?",
    input.encounterId,
  );
  const joined = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM balls WHERE encounter_id = ? AND status <> 'cancelled'",
    input.encounterId,
  );
  const seniorsJoined = joined?.count ?? 1;

  // 새내기 채팅방 알림. writeUserChatMessage 권한이 없으면 notifications.runDue가
  // 조용히 실패로 남기고, 응답에는 영향 없다 (§upgrade.functions.ts와 동일 패턴).
  await deps.notifications.enqueue({
    dedupeKey: `accepted:${input.encounterId}:${seniorId}`,
    kind: "wild_accepted",
    text: `${senior.nickname} 선배가 수락했어요! 곧 채팅으로 연락할 거예요.`,
    targetType: "user_chat",
    targetUserId: encounter.junior_id,
    urgent: true,
  });
  if (seniorsJoined === encounter.max_seniors) {
    await deps.notifications.enqueue({
      dedupeKey: `full:${input.encounterId}`,
      kind: "wild_full",
      text: `선배 ${encounter.max_seniors}명이 모두 정해졌어요! /내밥약 에서 일정을 확인하세요.`,
      targetType: "user_chat",
      targetUserId: encounter.junior_id,
      urgent: true,
    });
  }
  await deps.notifications.runDue(deps.channelId, 5);

  return {
    ballId,
    isFirst,
    slotStart: final?.slot_start ?? null,
    slotEnd: final?.slot_end ?? null,
    seniorsJoined,
    maxSeniors: encounter.max_seniors,
  };
}
