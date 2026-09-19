import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { REVIEW_FUNCTIONS, ReviewSubmitInputSchema, ReviewSubmitOutputSchema } from "@tutorial/shared";
import { Ctx, Description, Func, Input, InputSchema, OutputSchema, type Context } from "@channel.io/app-sdk-server";
import { AccountsService } from "../../accounts.service.js";
import { submitReview } from "./review.service.js";

@Injectable()
export class ReviewFunctions {
  constructor(private readonly accounts: AccountsService) {}

  @Func(REVIEW_FUNCTIONS.submit)
  @Description("후기 + 자기 답을 제출하고 도감에 등록한다")
  @InputSchema(ReviewSubmitInputSchema)
  @OutputSchema(ReviewSubmitOutputSchema)
  async submit(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof ReviewSubmitInputSchema>,
  ): Promise<z.infer<typeof ReviewSubmitOutputSchema>> {
    const junior = await this.accounts.resolveJunior(ctx);
    return submitReview(junior.id, input);
  }
}
