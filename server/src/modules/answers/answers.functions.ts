import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  ANSWERS_FUNCTIONS,
  AnswersListOutputSchema,
  EmptyInputSchema,
} from "@tutorial/shared";
import {
  Ctx,
  Description,
  Func,
  InputSchema,
  OutputSchema,
  type Context,
} from "@channel.io/app-sdk-server";
import { AccountsService } from "../../accounts.service.js";
import { listAnswers } from "./answers.service.js";

@Injectable()
export class AnswersFunctions {
  constructor(private readonly accounts: AccountsService) {}

  @Func(ANSWERS_FUNCTIONS.list)
  @Description("내가 도운 질문과 새내기의 답")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(AnswersListOutputSchema)
  async list(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof AnswersListOutputSchema>> {
    const senior = await this.accounts.requireLinkedSenior(ctx);
    return listAnswers(senior.id);
  }
}
