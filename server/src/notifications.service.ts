import { Injectable } from "@nestjs/common";
import { changedRows, execute, queryAll } from "./database.js";
import { ChannelService } from "./channel.service.js";
import { newId, nowIso } from "./util.js";

export interface EnqueueInput {
  dedupeKey: string;
  kind: string;
  text: string;
  targetType: "group" | "user_chat";
  targetId?: string | null;
  targetUserId?: string | null;
  rootMessageId?: string | null;
  urgent?: boolean;
  dueAt?: string;
}

interface NotificationRow {
  id: string;
  kind: string;
  target_type: "group" | "user_chat";
  target_id: string | null;
  target_user_id: string | null;
  root_message_id: string | null;
  body_json: string;
  attempts: number;
}

export interface RunSummary {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000];
const QUIET_START_HOUR = 23;
const QUIET_END_HOUR = 8;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Channel Talk operates in KST; quiet hours are evaluated there. */
function kstHour(date: Date): number {
  return new Date(date.getTime() + KST_OFFSET_MS).getUTCHours();
}

export function applyQuietHours(dueAt: string, urgent: boolean): string {
  if (urgent) return dueAt;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return dueAt;

  const hour = kstHour(due);
  if (hour >= QUIET_END_HOUR && hour < QUIET_START_HOUR) return dueAt;

  const kst = new Date(due.getTime() + KST_OFFSET_MS);
  const morningKst = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate(),
    QUIET_END_HOUR,
    0,
    0,
    0,
  );
  const nextDay = hour >= QUIET_START_HOUR ? 24 * 60 * 60 * 1000 : 0;
  return new Date(morningKst - KST_OFFSET_MS + nextDay).toISOString();
}

@Injectable()
export class NotificationsService {
  constructor(private readonly channel: ChannelService) {}

  /** Returns the notification id, or null when the dedupe key already exists. */
  async enqueue(input: EnqueueInput): Promise<string | null> {
    const now = nowIso();
    const urgent = input.urgent === true;
    const dueAt = applyQuietHours(input.dueAt ?? now, urgent);
    const id = newId("ntf");

    const result = await execute(
      `INSERT OR IGNORE INTO notifications
         (id, dedupe_key, kind, target_type, target_id, target_user_id, root_message_id,
          body_json, urgent, due_at, status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      id,
      input.dedupeKey,
      input.kind,
      input.targetType,
      input.targetId ?? null,
      input.targetUserId ?? null,
      input.rootMessageId ?? null,
      JSON.stringify({ text: input.text }),
      urgent ? 1 : 0,
      dueAt,
      now,
      now,
    );

    return changedRows(result) === 1 ? id : null;
  }

  async runDue(channelId: string, limit = 20): Promise<RunSummary> {
    const rows = await queryAll<NotificationRow>(
      `SELECT id, kind, target_type, target_id, target_user_id, root_message_id, body_json, attempts
       FROM notifications
       WHERE status = 'pending' AND due_at <= ?
       ORDER BY due_at ASC
       LIMIT ?`,
      nowIso(),
      limit,
    );

    const summary: RunSummary = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
    const runId = newId("run");

    for (const row of rows) {
      const claimed = await this.claim(row.id, runId, true);
      if (!claimed) {
        summary.skipped += 1;
        continue;
      }
      summary.processed += 1;
      const delivered = await this.send(channelId, row);
      if (delivered) summary.sent += 1;
      else summary.failed += 1;
    }

    return summary;
  }

  async runOne(channelId: string, id: string): Promise<boolean> {
    const rows = await queryAll<NotificationRow>(
      `SELECT id, kind, target_type, target_id, target_user_id, root_message_id, body_json, attempts
       FROM notifications WHERE id = ? AND status = 'pending'`,
      id,
    );
    const row = rows[0];
    if (!row) return false;
    if (!(await this.claim(row.id, newId("run"), false))) return false;
    return this.send(channelId, row);
  }

  /**
   * Conditional update: only one runner can move a row out of `pending`.
   * Scheduled runs must also re-check `due_at`, because a concurrent runner
   * that just failed this row resets it to `pending` with a retry time in the
   * future — without this check that row would be sent again immediately.
   */
  private async claim(
    id: string,
    runId: string,
    respectDueAt: boolean,
  ): Promise<boolean> {
    const now = nowIso();
    const result = respectDueAt
      ? await execute(
          `UPDATE notifications SET status = 'sending', run_id = ?, updated_at = ?
           WHERE id = ? AND status = 'pending' AND due_at <= ?`,
          runId,
          now,
          id,
          now,
        )
      : await execute(
          `UPDATE notifications SET status = 'sending', run_id = ?, updated_at = ?
           WHERE id = ? AND status = 'pending'`,
          runId,
          now,
          id,
        );
    return changedRows(result) === 1;
  }

  private async resolveTarget(row: NotificationRow): Promise<string | null> {
    if (row.target_type === "group") return row.target_id;
    if (row.target_id) return row.target_id;
    if (!row.target_user_id) return null;

    const users = await queryAll<{ primary_user_chat_id: string | null }>(
      "SELECT primary_user_chat_id FROM users WHERE id = ?",
      row.target_user_id,
    );
    return users[0]?.primary_user_chat_id ?? null;
  }

  private async send(
    channelId: string,
    row: NotificationRow,
  ): Promise<boolean> {
    let text = "";
    try {
      text = String(
        (JSON.parse(row.body_json) as { text?: string }).text ?? "",
      );
    } catch {
      text = "";
    }

    try {
      const target = await this.resolveTarget(row);
      if (!target || !text) {
        await this.fail(row, "발송 대상 또는 본문이 없어요", true);
        return false;
      }

      const messageId =
        row.target_type === "group"
          ? await this.channel.postToGroup(
              channelId,
              target,
              text,
              row.root_message_id ?? undefined,
            )
          : await this.channel.postToUserChat(channelId, target, text);

      await execute(
        `UPDATE notifications SET status = 'sent', sent_message_id = ?, last_error = NULL, updated_at = ?
         WHERE id = ?`,
        messageId ?? null,
        nowIso(),
        row.id,
      );
      return true;
    } catch (error) {
      this.channel.logFailure(row.kind, error);
      await this.fail(
        row,
        error instanceof Error ? error.message : "unknown",
        false,
      );
      return false;
    }
  }

  private async fail(
    row: NotificationRow,
    reason: string,
    terminal: boolean,
  ): Promise<void> {
    const attempts = row.attempts + 1;
    const exhausted = terminal || attempts >= RETRY_BACKOFF_MS.length;
    const backoff =
      RETRY_BACKOFF_MS[Math.min(attempts, RETRY_BACKOFF_MS.length) - 1];

    await execute(
      `UPDATE notifications
         SET status = ?, attempts = ?, last_error = ?, due_at = ?, updated_at = ?
       WHERE id = ?`,
      exhausted ? "failed" : "pending",
      Math.min(attempts, 3),
      reason.slice(0, 200),
      exhausted ? nowIso() : new Date(Date.now() + backoff).toISOString(),
      nowIso(),
      row.id,
    );
  }
}
