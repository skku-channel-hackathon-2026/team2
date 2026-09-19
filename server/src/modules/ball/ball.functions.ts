import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  BALL_FUNCTIONS,
  BALL_WAM_NAME,
  BallListOutputSchema,
  CommandActionInputSchema,
  ConfirmMetInputSchema,
  ConfirmMetOutputSchema,
  RemindInputSchema,
  RemindOutputSchema,
  type CommandActionInput,
} from "@tutorial/shared";
import {
  CommandResultSchema,
  Ctx,
  Description,
  Func,
  Input,
  InputSchema,
  OutputSchema,
  type Context,
} from "@channel.io/app-sdk-server";
import { appId } from "../../config.js";
import { getSeniorIdByManagerId } from "../../accounts.js";
import { confirmMet, listForSenior, remind } from "./ball.service.js";

@Injectable()
export class BallFunctions {
  @Func(BALL_FUNCTIONS.open)
  @Description("내 포켓볼(예약) 목록 WAM을 연다")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  open(@Input() _params: CommandActionInput): z.infer<typeof CommandResultSchema> {
    return {
      type: "wam",
      attributes: { appId, name: BALL_WAM_NAME, wamArgs: {} },
    };
  }

  @Func(BALL_FUNCTIONS.list)
  @Description("내 포켓볼 목록")
  @InputSchema(z.object({}))
  @OutputSchema(BallListOutputSchema)
  async list(@Ctx() ctx: Context): Promise<z.infer<typeof BallListOutputSchema>> {
    const senior = await getSeniorIdByManagerId(ctx.caller.id ?? "");
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
    const senior = await getSeniorIdByManagerId(ctx.caller.id ?? "");
    return confirmMet(input.ballId, senior.id);
  }

  @Func(BALL_FUNCTIONS.remind)
  @Description("후기 작성을 재촉한다 (볼당 최대 2회)")
  @InputSchema(RemindInputSchema)
  @OutputSchema(RemindOutputSchema)
  async remind(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof RemindInputSchema>,
  ): Promise<z.infer<typeof RemindOutputSchema>> {
    const senior = await getSeniorIdByManagerId(ctx.caller.id ?? "");
    return remind(input.ballId, senior.id);
  }
}
