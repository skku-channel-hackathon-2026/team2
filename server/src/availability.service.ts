import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  ERROR_CODES,
  MAX_SLOTS,
  type AvailabilitySearchInputSchema,
  type SeniorStatus,
} from "@tutorial/shared";
import { getDatabase, queryAll, queryOne } from "./database.js";
import { badRequest } from "./errors.js";
import { newId, nowIso } from "./util.js";

export interface Slot {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityRow {
  status: SeniorStatus;
  paused_until: string | null;
  status_note: string | null;
  weekly_limit_minutes: number;
  availability_updated_at: string | null;
}

export interface AvailableSenior {
  userId: string;
  nickname: string;
  headline: string | null;
  fieldIds: string[];
  startMinute: number;
  endMinute: number;
  overlapMinutes: number;
  weeklyLimitMinutes: number;
}

type SearchInput = z.infer<typeof AvailabilitySearchInputSchema>;

/**
 * Collapses a raw grid selection into the fewest possible ranges: one row per
 * contiguous block, per weekday. Search then never needs DISTINCT, because a
 * merged timetable can overlap any window at most once per weekday.
 */
export function mergeSlots(slots: Slot[]): Slot[] {
  const sorted = slots
    .map((slot) => ({
      weekday: slot.weekday,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
    }))
    .filter((slot) => slot.endMinute > slot.startMinute)
    .sort(
      (left, right) =>
        left.weekday - right.weekday || left.startMinute - right.startMinute,
    );

  const merged: Slot[] = [];
  for (const slot of sorted) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.weekday === slot.weekday &&
      slot.startMinute <= last.endMinute
    ) {
      last.endMinute = Math.max(last.endMinute, slot.endMinute);
      continue;
    }
    merged.push({ ...slot });
  }

  if (merged.length > MAX_SLOTS) {
    throw badRequest(
      `가능한 시간은 최대 ${MAX_SLOTS}개 구간까지 저장할 수 있어요.`,
      ERROR_CODES.invalidSlot,
    );
  }
  return merged;
}

export function totalMinutes(slots: Slot[]): number {
  return slots.reduce(
    (sum, slot) => sum + slot.endMinute - slot.startMinute,
    0,
  );
}

/** A pause with an elapsed end date is over, without anyone flipping it back. */
export function isAvailableNow(
  status: SeniorStatus,
  pausedUntil: string | null,
  now = Date.now(),
): boolean {
  if (status === "active") return true;
  if (!pausedUntil) return false;
  const parsed = Date.parse(pausedUntil);
  return Number.isFinite(parsed) && parsed <= now;
}

const SELECT_AVAILABILITY = `SELECT status, paused_until, status_note, weekly_limit_minutes, availability_updated_at
   FROM senior_profiles WHERE user_id = ?`;

@Injectable()
export class AvailabilityService {
  async find(userId: string): Promise<AvailabilityRow | null> {
    return queryOne<AvailabilityRow>(SELECT_AVAILABILITY, userId);
  }

  async slotsOf(userId: string): Promise<Slot[]> {
    const rows = await queryAll<{
      weekday: number;
      start_minute: number;
      end_minute: number;
    }>(
      "SELECT weekday, start_minute, end_minute FROM senior_slots WHERE user_id = ? ORDER BY weekday, start_minute",
      userId,
    );
    return rows.map((row) => ({
      weekday: row.weekday,
      startMinute: row.start_minute,
      endMinute: row.end_minute,
    }));
  }

  /** Seniors may reach the availability screen before `/선배등록`. */
  private async ensureProfile(userId: string): Promise<void> {
    const now = nowIso();
    await getDatabase()
      .prepare(
        `INSERT INTO senior_profiles (user_id, weekly_limit_minutes, status, created_at, updated_at)
         VALUES (?, 120, 'active', ?, ?)
         ON CONFLICT(user_id) DO NOTHING`,
      )
      .bind(userId, now, now)
      .run();
  }

  async setStatus(
    userId: string,
    status: SeniorStatus,
    pausedUntil: string | null,
    statusNote: string | null,
  ): Promise<AvailabilityRow> {
    await this.ensureProfile(userId);
    const now = nowIso();
    const until = status === "paused" ? pausedUntil : null;

    if (until !== null && !Number.isFinite(Date.parse(until))) {
      throw badRequest(
        "일시중지 종료일은 YYYY-MM-DD 형식으로 입력해 주세요.",
        ERROR_CODES.invalidSlot,
      );
    }

    await getDatabase()
      .prepare(
        `UPDATE senior_profiles
            SET status = ?, paused_until = ?, status_note = ?, updated_at = ?
          WHERE user_id = ?`,
      )
      .bind(status, until, statusNote, now, userId)
      .run();

    const row = await this.find(userId);
    if (!row)
      throw badRequest("상태를 저장하지 못했어요.", ERROR_CODES.notFound);
    return row;
  }

  async setSlots(userId: string, slots: Slot[]): Promise<Slot[]> {
    await this.ensureProfile(userId);
    const merged = mergeSlots(slots);
    const now = nowIso();
    const database = getDatabase();

    await database.batch([
      database
        .prepare("DELETE FROM senior_slots WHERE user_id = ?")
        .bind(userId),
      ...merged.map((slot) =>
        database
          .prepare(
            "INSERT INTO senior_slots (id, user_id, weekday, start_minute, end_minute) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            newId("slt"),
            userId,
            slot.weekday,
            slot.startMinute,
            slot.endMinute,
          ),
      ),
      database
        .prepare(
          "UPDATE senior_profiles SET availability_updated_at = ?, updated_at = ? WHERE user_id = ?",
        )
        .bind(now, now, userId),
    ]);

    return merged;
  }

  /**
   * Who is free during [startMinute, endMinute) on `weekday`.
   * Driven by idx_senior_slots_lookup(weekday, start_minute, end_minute); the
   * half-open overlap test is the standard `start < queryEnd AND end > queryStart`.
   */
  async search(input: SearchInput): Promise<AvailableSenior[]> {
    const { weekday, startMinute, endMinute } = input;
    if (endMinute <= startMinute) {
      throw badRequest(
        "종료 시간이 시작 시간보다 늦어야 해요.",
        ERROR_CODES.invalidSlot,
      );
    }

    const minOverlap = input.minOverlapMinutes ?? 30;
    const limit = input.limit ?? 20;
    const fieldIds = input.fieldIds ?? [];
    const now = nowIso();

    const fieldFilter = fieldIds.length
      ? `AND EXISTS (SELECT 1 FROM senior_fields f
                      WHERE f.user_id = s.user_id
                        AND f.field_id IN (${fieldIds.map(() => "?").join(",")}))`
      : "";

    const rows = await queryAll<{
      user_id: string;
      nickname: string;
      headline: string | null;
      weekly_limit_minutes: number;
      start_minute: number;
      end_minute: number;
      overlap_minutes: number;
    }>(
      `SELECT s.user_id AS user_id,
              u.nickname AS nickname,
              p.headline AS headline,
              p.weekly_limit_minutes AS weekly_limit_minutes,
              MAX(s.start_minute, ?) AS start_minute,
              MIN(s.end_minute, ?) AS end_minute,
              MIN(s.end_minute, ?) - MAX(s.start_minute, ?) AS overlap_minutes
         FROM senior_slots s
         JOIN senior_profiles p ON p.user_id = s.user_id
         JOIN users u ON u.id = s.user_id
        WHERE s.weekday = ?
          AND s.start_minute < ?
          AND s.end_minute > ?
          AND u.is_senior = 1
          AND (p.status = 'active'
               OR (p.paused_until IS NOT NULL AND p.paused_until <= ?))
          AND MIN(s.end_minute, ?) - MAX(s.start_minute, ?) >= ?
          ${fieldFilter}
        ORDER BY overlap_minutes DESC, u.nickname
        LIMIT ?`,
      startMinute,
      endMinute,
      endMinute,
      startMinute,
      weekday,
      endMinute,
      startMinute,
      now,
      endMinute,
      startMinute,
      minOverlap,
      ...fieldIds,
      limit,
    );

    if (rows.length === 0) return [];

    const placeholders = rows.map(() => "?").join(",");
    const fieldRows = await queryAll<{ user_id: string; field_id: string }>(
      `SELECT user_id, field_id FROM senior_fields WHERE user_id IN (${placeholders})`,
      ...rows.map((row) => row.user_id),
    );

    const byUser = new Map<string, string[]>();
    for (const row of fieldRows) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row.field_id);
      byUser.set(row.user_id, list);
    }

    return rows.map((row) => ({
      userId: row.user_id,
      nickname: row.nickname,
      headline: row.headline,
      fieldIds: byUser.get(row.user_id) ?? [],
      startMinute: row.start_minute,
      endMinute: row.end_minute,
      overlapMinutes: row.overlap_minutes,
      weeklyLimitMinutes: row.weekly_limit_minutes,
    }));
  }
}
