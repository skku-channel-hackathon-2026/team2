import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  CommandActionInputSchema,
  DEX_FUNCTIONS,
  DEX_WAM_NAME,
  DexListOutputSchema,
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
import { listDex } from "./dex.service.js";

@Injectable()
export class DexFunctions {
  @Func(DEX_FUNCTIONS.open)
  @Description("내 도감 WAM을 연다")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  open(@Input() _params: CommandActionInput): z.infer<typeof CommandResultSchema> {
    return {
      type: "wam",
      attributes: { appId, name: DEX_WAM_NAME, wamArgs: {} },
    };
  }

  @Func(DEX_FUNCTIONS.list)
  @Description("내가 잡은 후배 목록")
  @InputSchema(z.object({}))
  @OutputSchema(DexListOutputSchema)
  async list(@Ctx() ctx: Context): Promise<z.infer<typeof DexListOutputSchema>> {
    const senior = await getSeniorIdByManagerId(ctx.caller.id ?? "");
    return listDex(senior.id);
  }
}
