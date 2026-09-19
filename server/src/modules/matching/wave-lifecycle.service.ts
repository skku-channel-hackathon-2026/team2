import type { MeetType } from "@tutorial/shared";
import { execute, queryAll } from "../../database.js";
import { nowIso } from "../../util.js";
import type { NotificationsService } from "../../notifications.service.js";
import type { SettingsService } from "../../settings.service.js";
import { findCandidates } from "./matching.service.js";

const WAVE2_WINDOW_MS = 42 * 60 * 60 * 1000; // 2차 웨이브 유효 시간

interface WildEncounterRow {
  id: string;
  field_id: string;
  title: string;
  meet_type: MeetType;
  junior_id: string;
}

/**
 * `/알림실행`(jobs.runDue)마다 같이 도는 스윕: 1차에서 6시간 무수락이면 2차
 * 웨이브(새 후보 5명)를 열고, 2차에서도 42시간 무수락이면 `expired`로 닫는다
 * (HUBAE_GO_PLAN.md T4 §7.4). 폴링/Cron이 없는 동안은 `/알림실행`을 눌러야
 * 돈다는 한계는 review-lifecycle.service.ts와 같다.
 */
export async function sweepWaves(deps: {
  notifications: NotificationsService;
  settings: SettingsService;
}): Promise<void> {
  const now = nowIso();

  const dueForWave2 = await queryAll<WildEncounterRow>(
    `SELECT id, field_id, title, meet_type, junior_id FROM encounters
     WHERE status = 'wild' AND wave = 1 AND next_wave_at IS NOT NULL AND next_wave_at <= ?`,
    now,
  );

  for (const encounter of dueForWave2) {
    const windowRows = await queryAll<{ start_at: string; end_at: string }>(
      "SELECT start_at, end_at FROM encounter_windows WHERE encounter_id = ?",
      encounter.id,
    );
    const existingTargets = await queryAll<{ senior_id: string }>(
      "SELECT senior_id FROM encounter_targets WHERE encounter_id = ?",
      encounter.id,
    );

    const candidates = await findCandidates({
      fieldId: encounter.field_id,
      meetType: encounter.meet_type,
      windows: windowRows.map((w) => ({
        startAt: w.start_at,
        endAt: w.end_at,
      })),
      juniorId: encounter.junior_id,
      excludeSeniorIds: new Set(existingTargets.map((t) => t.senior_id)),
    });

    if (candidates.length === 0) {
      // 2차로 보낼 새 후보가 아예 없으면 더 기다릴 이유가 없다.
      await execute(
        "UPDATE encounters SET status = 'expired', wave = 2 WHERE id = ? AND status = 'wild'",
        encounter.id,
      );
      continue;
    }

    for (const candidate of candidates) {
      await execute(
        "INSERT INTO encounter_targets (encounter_id, senior_id, wave, notified_at) VALUES (?, ?, 2, ?)",
        encounter.id,
        candidate.seniorId,
        now,
      );
    }
    await execute(
      "UPDATE encounters SET wave = 2, next_wave_at = ? WHERE id = ? AND status = 'wild'",
      new Date(Date.now() + WAVE2_WINDOW_MS).toISOString(),
      encounter.id,
    );

    const wildGroupId = await deps.settings.groupId("wild");
    if (wildGroupId) {
      const names = candidates.map((c) => c.seniorNickname).join(", ");
      await deps.notifications.enqueue({
        dedupeKey: `wild_wave2:${encounter.id}`,
        kind: "wild_wave2",
        text: `아직 아무도 없어요… [${encounter.field_id}] ${encounter.title}\n2차 대상: ${names}`,
        targetType: "group",
        targetId: wildGroupId,
        urgent: true,
      });
    }
  }

  const dueForExpiry = await queryAll<{ id: string; junior_id: string }>(
    `SELECT id, junior_id FROM encounters
     WHERE status = 'wild' AND wave = 2 AND next_wave_at IS NOT NULL AND next_wave_at <= ?`,
    now,
  );

  for (const encounter of dueForExpiry) {
    await execute(
      "UPDATE encounters SET status = 'expired' WHERE id = ? AND status = 'wild'",
      encounter.id,
    );
    await deps.notifications.enqueue({
      dedupeKey: `wild_expired:${encounter.id}`,
      kind: "wild_expired",
      text: "이번엔 선배를 못 찾았어요. 정규 멘토링이나 게시판도 확인해보세요.",
      targetType: "user_chat",
      targetUserId: encounter.junior_id,
      urgent: false,
    });
  }
}
