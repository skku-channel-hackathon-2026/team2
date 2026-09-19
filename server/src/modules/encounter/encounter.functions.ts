import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  ENCOUNTER_FUNCTIONS,
  EncounterCreateInputSchema,
  EncounterCreateOutputSchema,
  EncounterMineOutputSchema,
  EmptyInputSchema,
} from "@tutorial/shared";
import { Ctx, Description, Func, Input, InputSchema, OutputSchema, type Context } from "@channel.io/app-sdk-server";
import { AccountsService } from "../../accounts.service.js";
import { NotificationsService } from "../../notifications.service.js";
import { SettingsService } from "../../settings.service.js";
import { createEncounter, listMine } from "./encounter.service.js";

@Injectable()
export class EncounterFunctions {
  constructor(
    private readonly accounts: AccountsService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  @Func(ENCOUNTER_FUNCTIONS.create)
  @Description("질문을 밥약 신청(출현)으로 만든다")
  @InputSchema(EncounterCreateInputSchema)
  @OutputSchema(EncounterCreateOutputSchema)
  async create(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof EncounterCreateInputSchema>,
  ): Promise<z.infer<typeof EncounterCreateOutputSchema>> {
    const junior = await this.accounts.resolveJunior(ctx);
    return createEncounter(junior.id, input, {
      notifications: this.notifications,
      settings: this.settings,
      channelId: ctx.channel.id,
    });
  }

  @Func(ENCOUNTER_FUNCTIONS.mine)
  @Description("내 밥약 신청과 상태를 반환한다")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(EncounterMineOutputSchema)
  async mine(@Ctx() ctx: Context): Promise<z.infer<typeof EncounterMineOutputSchema>> {
    const junior = await this.accounts.resolveJunior(ctx);
    return listMine(junior.id);
  }
}
