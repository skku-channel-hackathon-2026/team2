import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  CommandActionInputSchema,
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

/**
 * AppStore still has the starter's `/tutorial` command registered against
 * `tutorial.open`, and re-registering is operator-gated. Keeping this
 * implemented makes `/tutorial` a live end-to-end probe: if it answers, a
 * signed AppStore call reached this server and the response came back.
 *
 * It deliberately returns text rather than the original WAM — the tutorial WAM
 * bundle is gone, so a `wam` result would just fail to load and tell us less.
 * This is not part of `getCommands`, so it disappears on its own once the real
 * command list registers.
 */
@Injectable()
export class TutorialFunctions {
  @Func("tutorial.open")
  @Description("Report that a signed Channel call reached this server")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  open(
    @Ctx() ctx: Context,
    @Input() params: CommandActionInput,
  ): z.infer<typeof CommandResultSchema> {
    const message = [
      "Hubae Go server reached.",
      `channel: ${ctx.channel.id}`,
      `caller: ${ctx.caller.type}`,
      `chat: ${params.chat?.type ?? "-"} ${params.chat?.id ?? "-"}`,
    ].join("\n");

    return { type: "text", attributes: { message } };
  }
}
