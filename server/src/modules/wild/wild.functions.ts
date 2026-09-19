import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  EmptyInputSchema,
  WILD_FUNCTIONS,
  WildAcceptInputSchema,
  WildAcceptOutputSchema,
  WildListOutputSchema,
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
import { AccountsService } from "../../accounts.service.js";
import { NotificationsService } from "../../notifications.service.js";
import { acceptWild, listWild } from "./wild.service.js";

@Injectable()
export class WildFunctions {
  constructor(
    private readonly accounts: AccountsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Func(WILD_FUNCTIONS.list)
  @Description("나에게 온 출현 목록")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(WildListOutputSchema)
  async list(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof WildListOutputSchema>> {
    const senior = await this.accounts.requireLinkedSenior(ctx);
    return listWild(senior.id);
  }

  @Func(WILD_FUNCTIONS.accept)
  @Description("출현을 선착순으로 수락한다")
  @InputSchema(WildAcceptInputSchema)
  @OutputSchema(WildAcceptOutputSchema)
  async accept(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof WildAcceptInputSchema>,
  ): Promise<z.infer<typeof WildAcceptOutputSchema>> {
    const senior = await this.accounts.requireLinkedSenior(ctx);
    return acceptWild({ id: senior.id, nickname: senior.nickname }, input, {
      notifications: this.notifications,
      channelId: ctx.channel.id,
    });
  }
}
