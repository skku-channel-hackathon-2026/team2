import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  COMMANDS,
  CommandActionInputSchema,
  WAM_NAME,
  type CommandActionInput,
  type WamArgs,
} from "@tutorial/shared";
import {
  CommandResultSchema,
  Description,
  Extension,
  Func,
  GetCommandsOutputSchema,
  Input,
  InputSchema,
  OutputSchema,
} from "@channel.io/app-sdk-server";
import { appId } from "./config.js";

@Extension({ name: "command", systemVersion: "v1" })
export class CommandExtension {
  @Func("metadata.getCommands")
  @Description("후배 Go 커맨드 목록")
  @InputSchema(z.object({}))
  @OutputSchema(GetCommandsOutputSchema)
  getCommands(): z.infer<typeof GetCommandsOutputSchema> {
    return {
      commands: COMMANDS.map((command) => ({
        name: command.name,
        scope: command.scope,
        description: command.description,
        actionFunctionName: command.actionFunctionName,
        alfMode: command.alfMode,
        ...(command.alfDescription
          ? { alfDescription: command.alfDescription }
          : {}),
        enabledByDefault: true,
      })),
    };
  }
}

type CommandResult = z.infer<typeof CommandResultSchema>;

function openWam(commandId: string, params: CommandActionInput): CommandResult {
  const command = COMMANDS.find((entry) => entry.id === commandId);
  if (!command) throw new Error(`Unknown command: ${commandId}`);

  const wamArgs = {
    screen: command.screen,
    commandId: command.id,
    commandName: command.name,
    chatId: params.chat?.id ?? "",
    chatType: params.chat?.type ?? "",
  } satisfies WamArgs;

  return { type: "wam", attributes: { appId, name: WAM_NAME, wamArgs } };
}

/**
 * Every command is declared in T0 so operators register the whole set once.
 * Commands whose feature lands in a later tier open the `soon` screen.
 */
@Injectable()
export class CommandActions {
  @Func("me.open")
  @Description("내정보 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  me(@Input() params: CommandActionInput): CommandResult {
    return openWam("me", params);
  }

  @Func("upgrade.open")
  @Description("선배 업그레이드 신청 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  upgrade(@Input() params: CommandActionInput): CommandResult {
    return openWam("upgrade", params);
  }

  @Func("helpme.open")
  @Description("선배에게 질문하기 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  helpme(@Input() params: CommandActionInput): CommandResult {
    return openWam("helpme", params);
  }

  @Func("mybab.open")
  @Description("내 밥약 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  mybab(@Input() params: CommandActionInput): CommandResult {
    return openWam("mybab", params);
  }

  @Func("review.open")
  @Description("후기 남기기 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  review(@Input() params: CommandActionInput): CommandResult {
    return openWam("review", params);
  }

  @Func("seniorstart.open")
  @Description("선배 계정 연결 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  seniorstart(@Input() params: CommandActionInput): CommandResult {
    return openWam("seniorstart", params);
  }

  @Func("senior.open")
  @Description("선배 등록 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  senior(@Input() params: CommandActionInput): CommandResult {
    return openWam("senior", params);
  }

  @Func("availability.open")
  @Description("가능 시간표 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  availability(@Input() params: CommandActionInput): CommandResult {
    return openWam("availability", params);
  }

  @Func("wild.open")
  @Description("출현 목록 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  wild(@Input() params: CommandActionInput): CommandResult {
    return openWam("wild", params);
  }

  @Func("balls.open")
  @Description("포켓볼 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  balls(@Input() params: CommandActionInput): CommandResult {
    return openWam("balls", params);
  }

  @Func("dex.open")
  @Description("도감 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  dex(@Input() params: CommandActionInput): CommandResult {
    return openWam("dex", params);
  }

  @Func("answers.open")
  @Description("답변 목록 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  answers(@Input() params: CommandActionInput): CommandResult {
    return openWam("answers", params);
  }

  @Func("ops.open")
  @Description("운영 화면 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  ops(@Input() params: CommandActionInput): CommandResult {
    return openWam("ops", params);
  }

  @Func("opsconfig.open")
  @Description("운영 설정 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  opsconfig(@Input() params: CommandActionInput): CommandResult {
    return openWam("opsconfig", params);
  }

  @Func("rundue.open")
  @Description("알림 실행 열기")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  rundue(@Input() params: CommandActionInput): CommandResult {
    return openWam("rundue", params);
  }
}
