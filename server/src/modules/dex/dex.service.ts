import {
  type DexEntry,
  type DexListOutput,
  intimacyLevel,
} from "@tutorial/shared";
import { execute, queryOne, queryAll } from "../../database.js";

interface DexEntryRow {
  junior_id: string;
  junior_nickname: string;
  type_field_id: string;
  type_label: string | null;
  first_caught_at: string;
  catch_count: number;
  intimacy: number;
  evolved_at: string | null;
}

export async function listDex(seniorId: string): Promise<DexListOutput> {
  const rows = await queryAll<DexEntryRow>(
    `SELECT d.junior_id, u.nickname AS junior_nickname, d.type_field_id,
            f.label AS type_label,
            d.first_caught_at, d.catch_count, d.intimacy, d.evolved_at
     FROM dex_entries d
     JOIN users u ON u.id = d.junior_id
     LEFT JOIN fields f ON f.id = d.type_field_id
     WHERE d.senior_id = ?
     ORDER BY d.first_caught_at DESC`,
    seniorId,
  );

  const items: DexEntry[] = rows.map((row) => ({
    juniorAlias: row.junior_nickname,
    typeFieldId: row.type_field_id,
    typeLabel: row.type_label ?? row.type_field_id,
    firstCaughtAt: row.first_caught_at,
    catchCount: row.catch_count,
    intimacy: row.intimacy,
    level: intimacyLevel(row.intimacy),
    evolved: row.evolved_at !== null,
  }));

  return {
    total: items.length,
    evolved: items.filter((item) => item.evolved).length,
    items,
  };
}

// review.service가 후기 제출마다 호출한다. 이미 잡은 적 있는 후배면 catch_count만
// 늘리고, 처음이면 새 행을 만든다. 반환값(wasFirstCatch)으로 친밀도 종류를 정한다.
export async function registerCatch(params: {
  seniorId: string;
  juniorId: string;
  typeFieldId: string;
  caughtAt: string;
  shareConsent: boolean;
}): Promise<{ wasFirstCatch: boolean }> {
  const existing = await queryOne(
    "SELECT senior_id FROM dex_entries WHERE senior_id = ? AND junior_id = ?",
    params.seniorId,
    params.juniorId,
  );

  if (!existing) {
    await execute(
      `INSERT INTO dex_entries
         (senior_id, junior_id, type_field_id, first_caught_at, catch_count, intimacy, share_consent)
       VALUES (?, ?, ?, ?, 1, 0, ?)`,
      params.seniorId,
      params.juniorId,
      params.typeFieldId,
      params.caughtAt,
      params.shareConsent ? 1 : 0,
    );
    return { wasFirstCatch: true };
  }

  await execute(
    `UPDATE dex_entries
     SET catch_count = catch_count + 1, share_consent = ?
     WHERE senior_id = ? AND junior_id = ?`,
    params.shareConsent ? 1 : 0,
    params.seniorId,
    params.juniorId,
  );
  return { wasFirstCatch: false };
}
