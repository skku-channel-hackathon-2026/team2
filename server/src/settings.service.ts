import { Injectable } from "@nestjs/common";
import { SETTING_KEYS, type GroupRole } from "@tutorial/shared";
import { execute, queryAll } from "./database.js";
import { nowIso } from "./util.js";

export interface OpsSettings {
  wildGroupId: string | null;
  loungeGroupId: string | null;
  opsGroupId: string | null;
  inviteLink: string | null;
  inviteExpiresAt: string | null;
}

const STAFF_MANAGER_IDS = "staff_manager_ids";

@Injectable()
export class SettingsService {
  async getMany(): Promise<Map<string, string>> {
    const rows = await queryAll<{ key: string; value: string }>(
      "SELECT key, value FROM app_settings",
    );
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  async get(key: string): Promise<string | null> {
    const rows = await queryAll<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = ?",
      key,
    );
    return rows[0]?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await execute(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      value,
      nowIso(),
    );
  }

  async ops(): Promise<OpsSettings> {
    const values = await this.getMany();
    return {
      wildGroupId: values.get(SETTING_KEYS.wildGroupId) ?? null,
      loungeGroupId: values.get(SETTING_KEYS.loungeGroupId) ?? null,
      opsGroupId: values.get(SETTING_KEYS.opsGroupId) ?? null,
      inviteLink: values.get(SETTING_KEYS.inviteLink) ?? null,
      inviteExpiresAt: values.get(SETTING_KEYS.inviteExpiresAt) ?? null,
    };
  }

  async groupId(role: GroupRole): Promise<string | null> {
    const settings = await this.ops();
    if (role === "wild") return settings.wildGroupId;
    if (role === "lounge") return settings.loungeGroupId;
    return settings.opsGroupId;
  }

  async staffManagerIds(): Promise<string[]> {
    const raw = await this.get(STAFF_MANAGER_IDS);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  }

  /**
   * The first manager to configure the app becomes staff; afterwards the list
   * is an explicit allowlist so limited-role seniors cannot approve upgrades.
   */
  async isStaff(managerId: string | undefined): Promise<boolean> {
    if (!managerId) return false;
    const ids = await this.staffManagerIds();
    return ids.length === 0 || ids.includes(managerId);
  }

  async addStaff(managerId: string): Promise<void> {
    const ids = await this.staffManagerIds();
    if (ids.includes(managerId)) return;
    await this.set(STAFF_MANAGER_IDS, JSON.stringify([...ids, managerId]));
  }
}
