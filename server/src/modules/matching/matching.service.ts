import type { MeetType, TimeWindow } from "@tutorial/shared";
import { queryAll, queryOne } from "../../database.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const MEET_MINUTES: Record<MeetType, number> = {
  meal: 60,
  cafe: 45,
  online: 30,
};
const MIN_OVERLAP_MINUTES = 30;
const MAX_CANDIDATES = 5;
const RECENT_NOTIFY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface WeeklySlot {
  weekday: number;
  start_minute: number;
  end_minute: number;
}

function kstWeekdayAndMinute(
  iso: string,
): { weekday: number; minute: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    weekday: (kst.getUTCDay() + 6) % 7, // 0 = 월요일, senior_slots와 동일 기준
    minute: kst.getUTCHours() * 60 + kst.getUTCMinutes(),
  };
}

/**
 * 후배가 제시한 시간대(window)와 선배의 주간 반복 가용 시간(slot)이 겹치는
 * 분(minute) 수. window가 자정을 넘기지 않는다고 가정한다(WAM은 같은 날
 * 범위만 제시하도록 설계됨).
 */
export function overlapMinutes(window: TimeWindow, slot: WeeklySlot): number {
  const start = kstWeekdayAndMinute(window.startAt);
  const end = kstWeekdayAndMinute(window.endAt);
  if (
    !start ||
    !end ||
    start.weekday !== slot.weekday ||
    end.weekday !== slot.weekday
  ) {
    return 0;
  }
  const overlapStart = Math.max(start.minute, slot.start_minute);
  const overlapEnd = Math.min(end.minute, slot.end_minute);
  return Math.max(0, overlapEnd - overlapStart);
}

function weekRangeKst(now: Date): { startIso: string; endIso: string } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const weekday = (kst.getUTCDay() + 6) % 7;
  const mondayKst = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() - weekday,
  );
  const startIso = new Date(mondayKst - KST_OFFSET_MS).toISOString();
  const endIso = new Date(
    mondayKst - KST_OFFSET_MS + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  return { startIso, endIso };
}

async function weeklyUsedMinutes(seniorId: string): Promise<number> {
  const { startIso, endIso } = weekRangeKst(new Date());
  const rows = await queryAll<{ meet_type: MeetType }>(
    `SELECT e.meet_type FROM balls b JOIN encounters e ON e.id = b.encounter_id
     WHERE b.senior_id = ? AND b.status IN ('thrown','wobbling','caught')
       AND e.slot_start >= ? AND e.slot_start < ?`,
    seniorId,
    startIso,
    endIso,
  );
  return rows.reduce((sum, row) => sum + MEET_MINUTES[row.meet_type], 0);
}

export async function overlapWindowsForSenior(
  seniorId: string,
  windows: TimeWindow[],
): Promise<TimeWindow[]> {
  const slots = await queryAll<WeeklySlot>(
    "SELECT weekday, start_minute, end_minute FROM senior_slots WHERE user_id = ?",
    seniorId,
  );
  return windows.filter((window) =>
    slots.some((slot) => overlapMinutes(window, slot) >= MIN_OVERLAP_MINUTES),
  );
}

export interface Candidate {
  seniorId: string;
  seniorNickname: string;
  overlapWindows: TimeWindow[];
}

interface SeniorProfileRow {
  user_id: string;
  nickname: string;
  weekly_limit_minutes: number;
}

// 매칭 v2 가중치 (HUBAE_GO_SPEC.md §6.2). 분야는 이미 필터에서 100% 일치를
// 보장하므로 상수 1로 취급 — 남은 후보들 사이의 순위는 나머지 4개가 가른다.
const WEIGHTS = {
  field: 0.4,
  categoryExperience: 0.2,
  timeOverlap: 0.15,
  responsiveness: 0.15,
  fairness: 0.1,
};

/** 이 분야에서 잡아본 서로 다른 후배 수를 0~1로 스무딩(n/(n+3)). */
async function categoryExperienceScore(
  seniorId: string,
  fieldId: string,
): Promise<number> {
  const rows = await queryAll(
    "SELECT 1 FROM dex_entries WHERE senior_id = ? AND type_field_id = ?",
    seniorId,
    fieldId,
  );
  const n = rows.length;
  return n / (n + 3);
}

/** 최근 알림 대비 실제 수락 비율. 알림을 아직 못 받은 신규 선배는 0.5. */
async function responsivenessScore(seniorId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [notified, accepted] = await Promise.all([
    queryAll(
      "SELECT 1 FROM encounter_targets WHERE senior_id = ? AND notified_at >= ?",
      seniorId,
      since,
    ),
    queryAll(
      "SELECT 1 FROM balls WHERE senior_id = ? AND thrown_at >= ?",
      seniorId,
      since,
    ),
  ]);
  if (notified.length === 0) return 0.5;
  return Math.min(1, accepted.length / notified.length);
}

/**
 * 매칭 v2 (규칙 + 가중치 점수): 후보 필터 → 5개 요소 가중합 점수 → 상위 5명.
 * 선배 수가 적은 해커톤 규모를 가정해 후보별로 조회한다(수백 명 단위로
 * 커지면 조인 하나로 합치는 게 낫다).
 */
export async function findCandidates(params: {
  fieldId: string;
  meetType: MeetType;
  windows: TimeWindow[];
  juniorId: string;
  excludeSeniorIds?: Set<string>;
}): Promise<Candidate[]> {
  const durationNeeded = MEET_MINUTES[params.meetType];

  const seniors = await queryAll<SeniorProfileRow>(
    `SELECT sp.user_id, u.nickname, sp.weekly_limit_minutes
     FROM senior_profiles sp
     JOIN users u ON u.id = sp.user_id
     JOIN senior_fields sf ON sf.user_id = sp.user_id AND sf.field_id = ?
     WHERE sp.status = 'active' AND u.is_senior = 1`,
    params.fieldId,
  );

  const scored: Array<Candidate & { score: number }> = [];
  const since = new Date(Date.now() - RECENT_NOTIFY_WINDOW_MS).toISOString();

  for (const senior of seniors) {
    if (params.excludeSeniorIds?.has(senior.user_id)) continue;

    const activeWithJunior = await queryOne(
      `SELECT b.id FROM balls b JOIN encounters e ON e.id = b.encounter_id
       WHERE b.senior_id = ? AND e.junior_id = ? AND b.status IN ('thrown','wobbling')`,
      senior.user_id,
      params.juniorId,
    );
    if (activeWithJunior) continue;

    const usedMinutes = await weeklyUsedMinutes(senior.user_id);
    if (senior.weekly_limit_minutes - usedMinutes < durationNeeded) continue;

    const overlapWindows = await overlapWindowsForSenior(
      senior.user_id,
      params.windows,
    );
    if (overlapWindows.length === 0) continue;

    const recentTargets = await queryAll(
      "SELECT 1 FROM encounter_targets WHERE senior_id = ? AND notified_at >= ?",
      senior.user_id,
      since,
    );

    const [categoryExperience, responsiveness] = await Promise.all([
      categoryExperienceScore(senior.user_id, params.fieldId),
      responsivenessScore(senior.user_id),
    ]);
    const timeOverlapRatio = overlapWindows.length / params.windows.length;
    const fairness = 1 / (1 + recentTargets.length);

    const score =
      WEIGHTS.field * 1 +
      WEIGHTS.categoryExperience * categoryExperience +
      WEIGHTS.timeOverlap * timeOverlapRatio +
      WEIGHTS.responsiveness * responsiveness +
      WEIGHTS.fairness * fairness;

    scored.push({
      seniorId: senior.user_id,
      seniorNickname: senior.nickname,
      overlapWindows,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, MAX_CANDIDATES)
    .map(({ seniorId, seniorNickname, overlapWindows }) => ({
      seniorId,
      seniorNickname,
      overlapWindows,
    }));
}
