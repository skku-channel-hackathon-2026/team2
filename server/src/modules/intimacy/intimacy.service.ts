import { INTIMACY_POINTS } from "@tutorial/shared";
import { execute } from "../../database.js";
import { newId, nowIso } from "../../util.js";

type IntimacyKind = keyof typeof INTIMACY_POINTS;

// dedupe_key UNIQUE 제약으로 같은 이벤트의 중복 적립을 막는다.
// INSERT가 제약 위반으로 실패하면 "이미 적립됨"으로 보고 조용히 0점을 반환한다.
export async function awardIntimacy(params: {
  seniorId: string;
  juniorId: string;
  kind: IntimacyKind;
  dedupeKey: string;
}): Promise<number> {
  const points = INTIMACY_POINTS[params.kind];
  try {
    await execute(
      `INSERT INTO intimacy_events (id, senior_id, junior_id, kind, points, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId("evt"),
      params.seniorId,
      params.juniorId,
      params.kind,
      points,
      params.dedupeKey,
      nowIso(),
    );
  } catch {
    return 0;
  }

  await execute(
    "UPDATE dex_entries SET intimacy = intimacy + ? WHERE senior_id = ? AND junior_id = ?",
    points,
    params.seniorId,
    params.juniorId,
  );

  return points;
}
