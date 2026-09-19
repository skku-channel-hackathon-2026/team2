import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  BALL_FUNCTIONS,
  BallListOutputSchema,
  ConfirmMetInputSchema,
  ConfirmMetOutputSchema,
  EmptyInputSchema,
  RemindInputSchema,
  RemindOutputSchema,
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
import { confirmMet, listForSenior, remind } from "./ball.service.js";

@Injectable()
export class BallFunctions {
  constructor(
    private readonly accounts: AccountsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Func(BALL_FUNCTIONS.list)
  @Description("잡은 새내기 목록")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(BallListOutputSchema)
  async list(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof BallListOutputSchema>> {
    const senior = await this.accounts.requireLinkedSenior(ctx);
    return listForSenior(senior.id);
  }

  @Func(BALL_FUNCTIONS.confirmMet)
  @Description("만남 완료를 기록한다")
  @InputSchema(ConfirmMetInputSchema)
  @OutputSchema(ConfirmMetOutputSchema)
  async confirmMet(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof ConfirmMetInputSchema>,
  ): Promise<z.infer<typeof ConfirmMetOutputSchema>> {
    const senior = await this.accounts.requireLinkedSenior(ctx);
    return confirmMet(input.ballId, senior.id, {
      notifications: this.notifications,
      channelId: ctx.channel.id,
    });
  }

  @Func(BALL_FUNCTIONS.remind)
  @Description("후기 작성을 재촉한다 (볼당 최대 2회)")
  @InputSchema(RemindInputSchema)
  @OutputSchema(RemindOutputSchema)
  async remind(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof RemindInputSchema>,
  ): Promise<z.infer<typeof RemindOutputSchema>> {
    const senior = await this.accounts.requireLinkedSenior(ctx);
    return remind(input.ballId, senior.id, {
      notifications: this.notifications,
      channelId: ctx.channel.id,
    });
  }
}
