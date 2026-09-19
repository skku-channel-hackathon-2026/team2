import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  CommandActionInputSchema,
  REVIEW_FUNCTIONS,
  REVIEW_WAM_NAME,
  ReviewSubmitInputSchema,
  ReviewSubmitOutputSchema,
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
import { getJuniorIdByUserId } from "../../accounts.js";
import { submitReview } from "./review.service.js";

@Injectable()
export class ReviewFunctions {
  @Func(REVIEW_FUNCTIONS.open)
  @Description("밥약 후기 WAM을 연다")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  open(@Input() _params: CommandActionInput): z.infer<typeof CommandResultSchema> {
    return {
      type: "wam",
      attributes: { appId, name: REVIEW_WAM_NAME, wamArgs: {} },
    };
  }

  @Func(REVIEW_FUNCTIONS.submit)
  @Description("후기 + 자기 답을 제출하고 도감에 등록한다")
  @InputSchema(ReviewSubmitInputSchema)
  @OutputSchema(ReviewSubmitOutputSchema)
  async submit(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof ReviewSubmitInputSchema>,
  ): Promise<z.infer<typeof ReviewSubmitOutputSchema>> {
    const junior = await getJuniorIdByUserId(ctx.caller.id ?? "");
    return submitReview(junior.id, input);
  }
}
