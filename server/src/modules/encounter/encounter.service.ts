import { ERROR_CODES } from "@tutorial/shared";
import type {
  BallStatus,
  EncounterCreateInput,
  EncounterCreateOutput,
  EncounterFieldsOutput,
  EncounterMineOutput,
  EncounterStatus,
  MeetType,
  MyEncounterCard,
} from "@tutorial/shared";
import { execute, queryAll, queryOne } from "../../database.js";
import { badRequest } from "../../errors.js";
import { newId, nowIso } from "../../util.js";
import { NotificationsService } from "../../notifications.service.js";
import { SettingsService } from "../../settings.service.js";
import { findCandidates } from "../matching/matching.service.js";

export async function listFields(): Promise<EncounterFieldsOutput> {
  const fields = await queryAll<{ id: string; label: string }>(
    "SELECT id, label FROM fields WHERE active = 1 ORDER BY sort_order",
  );
  return { fields };
}

export async function createEncounter(
  juniorId: string,
  input: EncounterCreateInput,
  deps: {
    notifications: NotificationsService;
    settings: SettingsService;
    channelId: string;
  },
): Promise<EncounterCreateOutput> {
  const field = await queryOne<{ id: string; label: string }>(
    "SELECT id, label FROM fields WHERE id = ? AND active = 1",
    input.fieldId,
  );
  if (!field) {
    throw badRequest("존재하지 않는 분야예요", ERROR_CODES.notFound);
  }

  const encounterId = newId("enc");
  const now = nowIso();
  const WAVE1_WINDOW_MS = 6 * 60 * 60 * 1000;
  const nextWaveAt = new Date(Date.now() + WAVE1_WINDOW_MS).toISOString();

  await execute(
    `INSERT INTO encounters (id, junior_id, field_id, title, meet_type, max_seniors, status, wave, next_wave_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'wild', 1, ?, ?)`,
    encounterId,
    juniorId,
    input.fieldId,
    input.title,
    input.meetType,
    input.maxSeniors,
    nextWaveAt,
    now,
  );

  for (const window of input.windows) {
    await execute(
      "INSERT INTO encounter_windows (encounter_id, start_at, end_at) VALUES (?, ?, ?)",
      encounterId,
      window.startAt,
      window.endAt,
    );
  }

  const candidates = await findCandidates({
    fieldId: input.fieldId,
    meetType: input.meetType,
    windows: input.windows,
    juniorId,
  });

  for (const candidate of candidates) {
    await execute(
      "INSERT INTO encounter_targets (encounter_id, senior_id, wave, notified_at) VALUES (?, ?, 1, ?)",
      encounterId,
      candidate.seniorId,
      now,
    );
  }

  const wildGroupId = await deps.settings.groupId("wild");
  if (wildGroupId && candidates.length > 0) {
    const names = candidates
      .map((candidate) => candidate.seniorNickname)
      .join(", ");
    const enqueued = await deps.notifications.enqueue({
      dedupeKey: `wild_appeared:${encounterId}`,
      kind: "wild_appeared",
      text: `🌿 야생의 새내기가 출현했다! [${field.label}] ${input.title}\n대상: ${names}\n/출현 에서 수락할 수 있어요.`,
      targetType: "group",
      targetId: wildGroupId,
      urgent: true,
    });
    if (enqueued) await deps.notifications.runDue(deps.channelId, 5);
  }

  return { encounterId, notifiedCount: candidates.length };
}

interface MyEncounterRow {
  id: string;
  title: string;
  status: EncounterStatus;
  slot_start: string | null;
  slot_end: string | null;
  place: string | null;
  max_seniors: number;
  seniors_joined: number;
  field_id: string;
  field_label: string | null;
  meet_type: MeetType;
  created_at: string;
  review_due_at: string | null;
  has_review: number;
}

export async function listMine(juniorId: string): Promise<EncounterMineOutput> {
  const rows = await queryAll<MyEncounterRow>(
    `SELECT e.id, e.title, e.status, e.slot_start, e.slot_end, e.place, e.max_seniors,
            e.field_id, f.label AS field_label, e.meet_type, e.created_at, e.review_due_at,
            (SELECT COUNT(*) FROM balls b WHERE b.encounter_id = e.id AND b.status <> 'cancelled') AS seniors_joined,
            EXISTS (SELECT 1 FROM reviews r WHERE r.encounter_id = e.id) AS has_review
     FROM encounters e
     LEFT JOIN fields f ON f.id = e.field_id
     WHERE e.junior_id = ?
     ORDER BY e.created_at DESC`,
    juniorId,
  );

  const items: MyEncounterCard[] = [];
  for (const row of rows) {
    const windows = await queryAll<{ start_at: string; end_at: string }>(
      "SELECT start_at, end_at FROM encounter_windows WHERE encounter_id = ? ORDER BY start_at",
      row.id,
    );
    const seniors = await queryAll<{ nickname: string; status: BallStatus }>(
      `SELECT u.nickname, b.status
       FROM balls b JOIN users u ON u.id = b.senior_id
       WHERE b.encounter_id = ? AND b.status <> 'cancelled'
       ORDER BY b.thrown_at`,
      row.id,
    );

    items.push({
      encounterId: row.id,
      title: row.title,
      status: row.status,
      seniorsJoined: row.seniors_joined,
      maxSeniors: row.max_seniors,
      slotStart: row.slot_start,
      slotEnd: row.slot_end,
      place: row.place,
      fieldId: row.field_id,
      fieldLabel: row.field_label ?? row.field_id,
      meetType: row.meet_type,
      createdAt: row.created_at,
      windows: windows.map((window) => ({
        startAt: window.start_at,
        endAt: window.end_at,
      })),
      seniors: seniors.map((senior) => ({
        seniorAlias: senior.nickname,
        ballStatus: senior.status,
      })),
      reviewDueAt: row.review_due_at,
      hasReview: row.has_review === 1,
    });
  }

  return { items };
}
