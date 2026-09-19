import { execute, queryAll } from "../../database.js";
import type { NotificationsService } from "../../notifications.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

interface MetEncounterRow {
  id: string;
  junior_id: string;
  review_due_at: string;
}

/**
 * `/알림실행`(jobs.runDue)마다 같이 도는 스윕: 후기 마감이 다가온 met 출현에
 * 리마인드를 enqueue하고, 마감이 지났는데 후기가 없으면 조용히 escaped 처리한다
 * (§8.2/§15 — 도망은 공개 게시하지 않음, 알림도 보내지 않는다).
 *
 * 폴링/Cron이 없는 동안은 누군가 `/알림실행`을 눌러야만 돈다는 한계가 있다.
 */
export async function sweepReviewLifecycle(deps: {
  notifications: NotificationsService;
  channelId: string;
}): Promise<void> {
  const now = Date.now();
  const metEncounters = await queryAll<MetEncounterRow>(
    "SELECT id, junior_id, review_due_at FROM encounters WHERE status = 'met'",
  );

  let enqueuedAny = false;

  for (const encounter of metEncounters) {
    const dueAt = new Date(encounter.review_due_at).getTime();
    if (Number.isNaN(dueAt)) continue;
    const remaining = dueAt - now;

    if (remaining <= 0) {
      await execute(
        "UPDATE encounters SET status = 'escaped' WHERE id = ? AND status = 'met'",
        encounter.id,
      );
      await execute(
        "UPDATE balls SET status = 'escaped' WHERE encounter_id = ? AND status = 'wobbling'",
        encounter.id,
      );
      continue;
    }

    const bucket =
      remaining <= DAY_MS ? "d1" : remaining <= 3 * DAY_MS ? "d3" : null;
    if (!bucket) continue;

    const id = await deps.notifications.enqueue({
      dedupeKey: `review_reminder_${bucket}:${encounter.id}`,
      kind: "review_reminder",
      text:
        bucket === "d1"
          ? "후기 작성 마감이 하루 남았어요! 지금 남기면 선배 도감에 등록돼요."
          : "후기 작성 마감이 3일 남았어요. 잊지 말고 남겨주세요!",
      targetType: "user_chat",
      targetUserId: encounter.junior_id,
      urgent: false,
    });
    if (id) enqueuedAny = true;
  }

  if (enqueuedAny) await deps.notifications.runDue(deps.channelId, 20);
}
