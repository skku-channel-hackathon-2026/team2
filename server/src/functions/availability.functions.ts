import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  AvailabilityGetOutputSchema,
  AvailabilitySearchInputSchema,
  AvailabilitySearchOutputSchema,
  AvailabilitySetSlotsInputSchema,
  AvailabilitySetSlotsOutputSchema,
  AvailabilityStatusSchema,
  AvailabilitySetStatusInputSchema,
  EmptyInputSchema,
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
import {
  AvailabilityService,
  isAvailableNow,
  totalMinutes,
  type AvailabilityRow,
} from "../availability.service.js";
import { nowIso } from "../util.js";

const DEFAULT_WEEKLY_LIMIT_MINUTES = 120;

function toStatus(
  row: AvailabilityRow | null,
): z.infer<typeof AvailabilityStatusSchema> {
  const status = row?.status ?? "active";
  const pausedUntil = row?.paused_until ?? null;
  return {
    status,
    pausedUntil,
    statusNote: row?.status_note ?? null,
    availableNow: isAvailableNow(status, pausedUntil),
  };
}

@Injectable()
export class AvailabilityFunctions {
  constructor(
    private readonly accounts: AccountsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Func("availability.get")
  @Description("내 밥약 가능 상태와 주간 가능 시간표를 반환")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(AvailabilityGetOutputSchema)
  async get(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof AvailabilityGetOutputSchema>> {
    const managerId = this.accounts.requireManagerId(ctx);
    const user = await this.accounts.findByManagerId(managerId);

    if (!user || user.is_senior !== 1) {
      return {
        linked: false,
        registered: false,
        availability: toStatus(null),
        slots: [],
        totalMinutes: 0,
        weeklyLimitMinutes: DEFAULT_WEEKLY_LIMIT_MINUTES,
        updatedAt: null,
      };
    }

    const [row, slots] = await Promise.all([
      this.availability.find(user.id),
      this.availability.slotsOf(user.id),
    ]);

    return {
      linked: true,
      registered: row !== null,
      availability: toStatus(row),
      slots,
      totalMinutes: totalMinutes(slots),
      weeklyLimitMinutes:
        row?.weekly_limit_minutes ?? DEFAULT_WEEKLY_LIMIT_MINUTES,
      updatedAt: row?.availability_updated_at ?? null,
    };
  }

  @Func("availability.setStatus")
  @Description("밥약 가능 상태를 켜거나 일시중지")
  @InputSchema(AvailabilitySetStatusInputSchema)
  @OutputSchema(AvailabilityStatusSchema)
  async setStatus(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof AvailabilitySetStatusInputSchema>,
  ): Promise<z.infer<typeof AvailabilityStatusSchema>> {
    const user = await this.accounts.requireLinkedSenior(ctx);
    const row = await this.availability.setStatus(
      user.id,
      input.status,
      input.pausedUntil ?? null,
      input.statusNote ?? null,
    );
    return toStatus(row);
  }

  @Func("availability.setSlots")
  @Description("주간 가능 시간표를 저장 (겹치는 구간은 합쳐서 저장)")
  @InputSchema(AvailabilitySetSlotsInputSchema)
  @OutputSchema(AvailabilitySetSlotsOutputSchema)
  async setSlots(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof AvailabilitySetSlotsInputSchema>,
  ): Promise<z.infer<typeof AvailabilitySetSlotsOutputSchema>> {
    const user = await this.accounts.requireLinkedSenior(ctx);
    const slots = await this.availability.setSlots(user.id, input.slots);
    return { slots, totalMinutes: totalMinutes(slots), updatedAt: nowIso() };
  }

  /**
   * Cross-senior visibility is an operations view, not a senior one: a senior
   * only ever sees their own timetable through `availability.get`.
   */
  @Func("availability.search")
  @Description("특정 요일·시간대에 가능한 선배를 검색 (운영진 전용)")
  @InputSchema(AvailabilitySearchInputSchema)
  @OutputSchema(AvailabilitySearchOutputSchema)
  async search(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof AvailabilitySearchInputSchema>,
  ): Promise<z.infer<typeof AvailabilitySearchOutputSchema>> {
    await this.accounts.requireStaff(ctx);
    return { items: await this.availability.search(input) };
  }
}
