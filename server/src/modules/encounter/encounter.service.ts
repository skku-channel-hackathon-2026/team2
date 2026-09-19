import { ERROR_CODES } from "@tutorial/shared";
import type {
  EncounterCreateInput,
  EncounterCreateOutput,
  EncounterFieldsOutput,
  EncounterMineOutput,
  EncounterStatus,
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
      text: `🌿 야생의 후배가 출현했다! [${field.label}] ${input.title}\n대상: ${names}\n/출현 에서 수락할 수 있어요.`,
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
}

export async function listMine(juniorId: string): Promise<EncounterMineOutput> {
  const rows = await queryAll<MyEncounterRow>(
    `SELECT e.id, e.title, e.status, e.slot_start, e.slot_end, e.place, e.max_seniors,
            (SELECT COUNT(*) FROM balls b WHERE b.encounter_id = e.id AND b.status <> 'cancelled') AS seniors_joined
     FROM encounters e
     WHERE e.junior_id = ?
     ORDER BY e.created_at DESC`,
    juniorId,
  );

  return {
    items: rows.map((row) => ({
      encounterId: row.id,
      title: row.title,
      status: row.status,
      seniorsJoined: row.seniors_joined,
      maxSeniors: row.max_seniors,
      slotStart: row.slot_start,
      slotEnd: row.slot_end,
      place: row.place,
    })),
  };
}
