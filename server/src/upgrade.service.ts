import { Injectable } from "@nestjs/common";
import { ERROR_CODES, type UpgradeStatus } from "@tutorial/shared";
import { changedRows, execute, queryAll } from "./database.js";
import { badRequest } from "./errors.js";
import { AccountsService, type UserRow } from "./accounts.service.js";
import { appSecret } from "./config.js";
import {
  hashLinkCode,
  isPast,
  isoAfter,
  newId,
  newLinkCode,
  normalizeCode,
  nowIso,
} from "./util.js";

export interface UpgradeRow {
  id: string;
  user_id: string;
  email: string | null;
  intro: string;
  status: Exclude<UpgradeStatus, "none">;
  code_hash: string | null;
  code_plain: string | null;
  code_expires_at: string | null;
  code_attempts: number;
  reason: string | null;
  linked_manager_id: string | null;
  created_at: string;
}

const SELECT_UPGRADE =
  "SELECT id, user_id, email, intro, status, code_hash, code_plain, code_expires_at, code_attempts, reason, linked_manager_id, created_at FROM upgrade_requests";

const CODE_TTL_MS = 72 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30 * 60 * 1000;

@Injectable()
export class UpgradeService {
  constructor(private readonly accounts: AccountsService) {}

  async latestFor(userId: string): Promise<UpgradeRow | null> {
    const rows = await queryAll<UpgradeRow>(
      `${SELECT_UPGRADE} WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      userId,
    );
    return rows[0] ?? null;
  }

  async openFor(userId: string): Promise<UpgradeRow | null> {
    const rows = await queryAll<UpgradeRow>(
      `${SELECT_UPGRADE} WHERE user_id = ? AND status IN ('requested','approved') LIMIT 1`,
      userId,
    );
    return rows[0] ?? null;
  }

  async request(
    user: UserRow,
    input: { email?: string; intro: string },
  ): Promise<UpgradeRow> {
    if (user.is_senior === 1) {
      throw badRequest(
        "이미 선배로 연결된 계정이에요.",
        ERROR_CODES.alreadyLinked,
      );
    }
    if (await this.openFor(user.id)) {
      throw badRequest(
        "이미 진행 중인 업그레이드 신청이 있어요.",
        ERROR_CODES.duplicateRequest,
      );
    }

    const now = nowIso();
    const id = newId("upg");
    await execute(
      `INSERT INTO upgrade_requests (id, user_id, email, intro, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'requested', ?, ?)`,
      id,
      user.id,
      input.email ?? null,
      input.intro,
      now,
      now,
    );

    const created = await this.byId(id);
    if (!created)
      throw badRequest("신청을 저장하지 못했어요.", ERROR_CODES.notFound);
    return created;
  }

  async byId(id: string): Promise<UpgradeRow | null> {
    const rows = await queryAll<UpgradeRow>(
      `${SELECT_UPGRADE} WHERE id = ?`,
      id,
    );
    return rows[0] ?? null;
  }

  async list(status?: string): Promise<(UpgradeRow & { user: UserRow })[]> {
    const rows = status
      ? await queryAll<UpgradeRow>(
          `${SELECT_UPGRADE} WHERE status = ? ORDER BY created_at DESC LIMIT 50`,
          status,
        )
      : await queryAll<UpgradeRow>(
          `${SELECT_UPGRADE} ORDER BY created_at DESC LIMIT 50`,
        );

    const items: (UpgradeRow & { user: UserRow })[] = [];
    for (const row of rows) {
      const user = await this.accounts.findById(row.user_id);
      if (user) items.push({ ...row, user });
    }
    return items;
  }

  /** Approving mints a one-time code; the plaintext is returned exactly once. */
  async approve(
    requestId: string,
    staffManagerId: string,
  ): Promise<{ row: UpgradeRow; code: string }> {
    const row = await this.byId(requestId);
    if (!row) throw badRequest("신청을 찾을 수 없어요.", ERROR_CODES.notFound);
    if (row.status === "linked") {
      throw badRequest(
        "이미 연결이 끝난 신청이에요.",
        ERROR_CODES.alreadyLinked,
      );
    }

    const code = newLinkCode();
    const now = nowIso();

    await execute(
      `UPDATE upgrade_requests
         SET status = 'approved', code_hash = ?, code_plain = ?, code_expires_at = ?, code_attempts = 0,
             reason = NULL, decided_by_manager_id = ?, decided_at = ?, updated_at = ?
       WHERE id = ?`,
      hashLinkCode(code, appSecret),
      code,
      isoAfter(CODE_TTL_MS),
      staffManagerId,
      now,
      now,
      requestId,
    );

    const updated = await this.byId(requestId);
    if (!updated)
      throw badRequest("신청을 갱신하지 못했어요.", ERROR_CODES.notFound);
    return { row: updated, code };
  }

  async reject(
    requestId: string,
    staffManagerId: string,
    reason?: string,
  ): Promise<UpgradeRow> {
    const row = await this.byId(requestId);
    if (!row) throw badRequest("신청을 찾을 수 없어요.", ERROR_CODES.notFound);

    const now = nowIso();
    await execute(
      `UPDATE upgrade_requests
         SET status = 'rejected', code_hash = NULL, code_plain = NULL, code_expires_at = NULL, reason = ?,
             decided_by_manager_id = ?, decided_at = ?, updated_at = ?
       WHERE id = ?`,
      reason ?? null,
      staffManagerId,
      now,
      now,
      requestId,
    );

    const updated = await this.byId(requestId);
    if (!updated)
      throw badRequest("신청을 갱신하지 못했어요.", ERROR_CODES.notFound);
    return updated;
  }

  async linkManager(rawCode: string, managerId: string): Promise<UserRow> {
    await this.assertNotLocked(managerId);

    if (await this.accounts.findByManagerId(managerId)) {
      throw badRequest(
        "이 팀원 계정은 이미 연결되어 있어요.",
        ERROR_CODES.alreadyLinked,
      );
    }

    const hash = hashLinkCode(normalizeCode(rawCode), appSecret);
    const rows = await queryAll<UpgradeRow>(
      `${SELECT_UPGRADE} WHERE code_hash = ? AND status = 'approved' LIMIT 1`,
      hash,
    );
    const row = rows[0];

    if (!row) {
      await this.recordFailure(managerId);
      throw badRequest("연결 코드가 올바르지 않아요.", ERROR_CODES.codeInvalid);
    }

    if (isPast(row.code_expires_at)) {
      await execute(
        `UPDATE upgrade_requests SET status = 'expired', code_hash = NULL, code_plain = NULL,
           code_attempts = MIN(code_attempts + 1, 5), updated_at = ? WHERE id = ?`,
        nowIso(),
        row.id,
      );
      throw badRequest(
        "연결 코드가 만료됐어요. 운영진에게 재발급을 요청해 주세요.",
        ERROR_CODES.codeExpired,
      );
    }

    const now = nowIso();
    const claimed = await execute(
      `UPDATE upgrade_requests
         SET status = 'linked', code_hash = NULL, code_plain = NULL, linked_manager_id = ?, linked_at = ?, updated_at = ?
       WHERE id = ? AND status = 'approved'`,
      managerId,
      now,
      now,
      row.id,
    );
    if (changedRows(claimed) !== 1) {
      throw badRequest("이미 사용된 연결 코드예요.", ERROR_CODES.codeInvalid);
    }

    await execute(
      `UPDATE users SET channel_manager_id = ?, is_senior = 1, updated_at = ? WHERE id = ?`,
      managerId,
      now,
      row.user_id,
    );
    await execute("DELETE FROM link_attempts WHERE manager_id = ?", managerId);

    const linked = await this.accounts.findById(row.user_id);
    if (!linked)
      throw badRequest("계정을 찾을 수 없어요.", ERROR_CODES.notFound);
    return linked;
  }

  private async assertNotLocked(managerId: string): Promise<void> {
    const rows = await queryAll<{
      attempts: number;
      locked_until: string | null;
    }>(
      "SELECT attempts, locked_until FROM link_attempts WHERE manager_id = ?",
      managerId,
    );
    const row = rows[0];
    if (!row?.locked_until) return;

    if (!isPast(row.locked_until)) {
      throw badRequest(
        "코드를 여러 번 잘못 입력해 잠겼어요. 30분 후 다시 시도해 주세요.",
        ERROR_CODES.codeLocked,
      );
    }

    await execute(
      "UPDATE link_attempts SET attempts = 0, locked_until = NULL, updated_at = ? WHERE manager_id = ?",
      nowIso(),
      managerId,
    );
  }

  private async recordFailure(managerId: string): Promise<void> {
    const now = nowIso();
    await execute(
      `INSERT INTO link_attempts (manager_id, attempts, updated_at) VALUES (?, 1, ?)
       ON CONFLICT(manager_id) DO UPDATE SET
         attempts = link_attempts.attempts + 1,
         locked_until = CASE WHEN link_attempts.attempts + 1 >= ? THEN ? ELSE link_attempts.locked_until END,
         updated_at = excluded.updated_at`,
      managerId,
      now,
      MAX_ATTEMPTS,
      isoAfter(LOCK_MS),
    );
  }
}
