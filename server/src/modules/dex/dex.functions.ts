import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  DEX_FUNCTIONS,
  DexListOutputSchema,
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
import { listDex } from "./dex.service.js";

@Injectable()
export class DexFunctions {
  constructor(private readonly accounts: AccountsService) {}

  @Func(DEX_FUNCTIONS.list)
  @Description("내가 잡은 후배 목록")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(DexListOutputSchema)
  async list(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof DexListOutputSchema>> {
    const senior = await this.accounts.requireLinkedSenior(ctx);
    return listDex(senior.id);
  }
}
