import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  EmptyInputSchema,
  OkOutputSchema,
  SeniorGetProfileOutputSchema,
  SeniorUpsertProfileInputSchema,
} from "@tutorial/shared";
import {
  Ctx,
  Description,
  Func,
  Input,
  InputSchema,
  OutputSchema,
  type Context,
} from "@channel.io/app-sdk-server";
import { AccountsService } from "../accounts.service.js";
import { getDatabase, queryAll } from "../database.js";
import { newId, nowIso } from "../util.js";

interface FieldRow {
  id: string;
  label: string;
}

@Injectable()
export class SeniorFunctions {
  constructor(private readonly accounts: AccountsService) {}

  @Func("senior.getProfile")
  @Description("선배 등록 정보를 반환")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(SeniorGetProfileOutputSchema)
  async getProfile(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof SeniorGetProfileOutputSchema>> {
    const managerId = this.accounts.requireManagerId(ctx);
    const fields = await queryAll<FieldRow>(
      "SELECT id, label FROM fields WHERE active = 1 ORDER BY sort_order",
    );

    const user = await this.accounts.findByManagerId(managerId);
    if (!user || user.is_senior !== 1) {
      return { linked: false, profile: null, fields };
    }

    const profiles = await queryAll<{
      headline: string | null;
      portfolio: string | null;
      weekly_limit_minutes: number;
      status: "active" | "paused";
    }>(
      "SELECT headline, portfolio, weekly_limit_minutes, status FROM senior_profiles WHERE user_id = ?",
      user.id,
    );
    const profile = profiles[0];

    if (!profile) {
      return {
        linked: true,
        profile: {
          headline: null,
          portfolio: null,
          weeklyLimitMinutes: 120,
          status: "active",
          fieldIds: [],
          slots: [],
        },
        fields,
      };
    }

    const fieldIds = (
      await queryAll<{ field_id: string }>(
        "SELECT field_id FROM senior_fields WHERE user_id = ?",
        user.id,
      )
    ).map((row) => row.field_id);

    const slots = (
      await queryAll<{
        weekday: number;
        start_minute: number;
        end_minute: number;
      }>(
        "SELECT weekday, start_minute, end_minute FROM senior_slots WHERE user_id = ? ORDER BY weekday, start_minute",
        user.id,
      )
    ).map((row) => ({
      weekday: row.weekday,
      startMinute: row.start_minute,
      endMinute: row.end_minute,
    }));

    return {
      linked: true,
      profile: {
        headline: profile.headline,
        portfolio: profile.portfolio,
        weeklyLimitMinutes: profile.weekly_limit_minutes,
        status: profile.status,
        fieldIds,
        slots,
      },
      fields,
    };
  }

  @Func("senior.upsertProfile")
  @Description("선배 분야와 가용 시간, 주간 상한을 저장")
  @InputSchema(SeniorUpsertProfileInputSchema)
  @OutputSchema(OkOutputSchema)
  async upsertProfile(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof SeniorUpsertProfileInputSchema>,
  ): Promise<z.infer<typeof OkOutputSchema>> {
    const user = await this.accounts.requireLinkedSenior(ctx);
    const now = nowIso();
    const database = getDatabase();

    const statements = [
      database
        .prepare(
          `INSERT INTO senior_profiles (user_id, headline, portfolio, weekly_limit_minutes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             headline = excluded.headline,
             portfolio = excluded.portfolio,
             weekly_limit_minutes = excluded.weekly_limit_minutes,
             status = excluded.status,
             updated_at = excluded.updated_at`,
        )
        .bind(
          user.id,
          input.headline ?? null,
          input.portfolio ?? null,
          input.weeklyLimitMinutes,
          input.status,
          now,
          now,
        ),
      database
        .prepare("DELETE FROM senior_fields WHERE user_id = ?")
        .bind(user.id),
      database
        .prepare("DELETE FROM senior_slots WHERE user_id = ?")
        .bind(user.id),
      ...input.fieldIds.map((fieldId) =>
        database
          .prepare(
            "INSERT INTO senior_fields (user_id, field_id) VALUES (?, ?)",
          )
          .bind(user.id, fieldId),
      ),
      ...input.slots.map((slot) =>
        database
          .prepare(
            "INSERT INTO senior_slots (id, user_id, weekday, start_minute, end_minute) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            newId("slt"),
            user.id,
            slot.weekday,
            slot.startMinute,
            slot.endMinute,
          ),
      ),
    ];

    await database.batch(statements);
    return { ok: true };
  }
}
