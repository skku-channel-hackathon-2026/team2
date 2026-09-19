import { Injectable } from "@nestjs/common";
import type { Context } from "@channel.io/app-sdk-server";
import { ERROR_CODES, type AccountProfile, type Role } from "@tutorial/shared";
import { execute, queryAll } from "./database.js";
import { badRequest } from "./errors.js";
import { SettingsService } from "./settings.service.js";
import { newId, nowIso } from "./util.js";

export interface UserRow {
  id: string;
  channel_user_id: string | null;
  channel_manager_id: string | null;
  primary_user_chat_id: string | null;
  nickname: string;
  department: string | null;
  cohort_year: number | null;
  notify_level: "all" | "important" | "none";
  is_senior: number;
  is_staff: number;
  created_at: string;
  updated_at: string;
}

const SELECT_USER =
  "SELECT id, channel_user_id, channel_manager_id, primary_user_chat_id, nickname, department, cohort_year, notify_level, is_senior, is_staff, created_at, updated_at FROM users";

function nicknameFromContext(ctx: Context): string {
  const profile = ctx.user?.profile as Record<string, unknown> | undefined;
  const name = typeof profile?.name === "string" ? profile.name.trim() : "";
  return name.slice(0, 20) || "새내기";
}

@Injectable()
export class AccountsService {
  constructor(private readonly settings: SettingsService) {}

  async findByUserId(channelUserId: string): Promise<UserRow | null> {
    const rows = await queryAll<UserRow>(
      `${SELECT_USER} WHERE channel_user_id = ?`,
      channelUserId,
    );
    return rows[0] ?? null;
  }

  async findByManagerId(channelManagerId: string): Promise<UserRow | null> {
    const rows = await queryAll<UserRow>(
      `${SELECT_USER} WHERE channel_manager_id = ?`,
      channelManagerId,
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const rows = await queryAll<UserRow>(`${SELECT_USER} WHERE id = ?`, id);
    return rows[0] ?? null;
  }

  /**
   * Junior accounts are created on first contact. The chat the command ran in
   * is remembered so T3 notifications have a delivery target.
   */
  async resolveJunior(ctx: Context): Promise<UserRow> {
    if (ctx.caller.type !== "user" || !ctx.caller.id) {
      throw badRequest(
        "이 기능은 채널톡 메신저에서 새내기만 사용할 수 있어요.",
        ERROR_CODES.notJunior,
      );
    }

    const channelUserId = ctx.caller.id;
    const userChatId = ctx.userChat?.id ?? null;
    const existing = await this.findByUserId(channelUserId);

    if (existing) {
      if (userChatId && existing.primary_user_chat_id !== userChatId) {
        await execute(
          "UPDATE users SET primary_user_chat_id = ?, updated_at = ? WHERE id = ?",
          userChatId,
          nowIso(),
          existing.id,
        );
        existing.primary_user_chat_id = userChatId;
      }
      return existing;
    }

    const now = nowIso();
    const id = newId("usr");
    await execute(
      `INSERT INTO users (id, channel_user_id, primary_user_chat_id, nickname, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      channelUserId,
      userChatId,
      nicknameFromContext(ctx),
      now,
      now,
    );

    const created = await this.findById(id);
    if (!created)
      throw badRequest("계정을 만들지 못했어요.", ERROR_CODES.notFound);
    return created;
  }

  requireManagerId(ctx: Context): string {
    if (ctx.caller.type !== "manager" || !ctx.caller.id) {
      throw badRequest(
        "이 기능은 채널톡 데스크에서 팀원만 사용할 수 있어요.",
        ERROR_CODES.notManager,
      );
    }
    return ctx.caller.id;
  }

  async requireLinkedSenior(ctx: Context): Promise<UserRow> {
    const managerId = this.requireManagerId(ctx);
    const row = await this.findByManagerId(managerId);
    if (!row || row.is_senior !== 1) {
      throw badRequest(
        "선배 연결 후 이용할 수 있어요. /선배시작 에서 연결 코드를 입력해 주세요.",
        ERROR_CODES.notLinked,
      );
    }
    return row;
  }

  async requireStaff(ctx: Context): Promise<string> {
    const managerId = this.requireManagerId(ctx);
    if (!(await this.settings.isStaff(managerId))) {
      throw badRequest("운영진만 사용할 수 있어요.", ERROR_CODES.notStaff);
    }
    return managerId;
  }

  async rolesFor(row: UserRow | null, managerId?: string): Promise<Role[]> {
    const roles: Role[] = [];
    if (row?.channel_user_id) roles.push("junior");
    if (row?.is_senior === 1) roles.push("senior");
    const staffId = managerId ?? row?.channel_manager_id ?? undefined;
    if (staffId && (await this.settings.isStaff(staffId))) roles.push("staff");
    return roles;
  }

  toProfile(row: UserRow): AccountProfile {
    return {
      id: row.id,
      nickname: row.nickname,
      department: row.department,
      cohortYear: row.cohort_year,
      notifyLevel: row.notify_level,
      hasManagerAccount: row.channel_manager_id !== null,
    };
  }
}
