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
      commands: [
        {
          name: "me",
          scope: "front",
          description: "내 별명과 학과, 업그레이드 상태를 확인해요",
          actionFunctionName: "me.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "upgrade",
          scope: "front",
          description: "밥약을 해주는 선배로 업그레이드를 신청해요",
          actionFunctionName: "upgrade.open",
          alfMode: "recommend",
          alfDescription: "후배가 선배가 되어 밥약을 해주고 싶어할 때 추천해요",
          enabledByDefault: true,
        },
        {
          name: "helpme",
          scope: "front",
          description: "궁금한 것을 물어보고 선배와 밥약을 잡아요",
          actionFunctionName: "helpme.open",
          alfMode: "recommend",
          alfDescription:
            "후배가 진로나 학업 고민을 선배에게 물어보고 싶을 때 추천해요",
          enabledByDefault: true,
        },
        {
          name: "mybab",
          scope: "front",
          description: "내 밥약 신청과 일정을 확인해요",
          actionFunctionName: "mybab.open",
          alfMode: "recommend",
          alfDescription: "후배가 신청한 밥약의 진행 상태를 물어볼 때 추천해요",
          enabledByDefault: true,
        },
        {
          name: "review",
          scope: "front",
          description: "만남 후기를 남기고 선배를 도감에 등록해요",
          actionFunctionName: "review.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "seniorstart",
          scope: "desk",
          description: "연결 코드를 입력해 선배 계정을 연결해요",
          actionFunctionName: "seniorstart.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "senior",
          scope: "desk",
          description: "분야와 가용 시간, 주간 상한을 등록해요",
          actionFunctionName: "senior.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "availability",
          scope: "desk",
          description: "밥약 가능 상태와 주간 가능 시간표를 관리해요",
          actionFunctionName: "availability.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "wild",
          scope: "desk",
          description: "나에게 온 출현을 확인하고 수락해요",
          actionFunctionName: "wild.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "balls",
          scope: "desk",
          description: "내 밥약 일정과 만남 완료를 관리해요",
          actionFunctionName: "balls.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "dex",
          scope: "desk",
          description: "내가 잡은 후배 목록을 봐요",
          actionFunctionName: "dex.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "answers",
          scope: "desk",
          description: "내가 도운 질문과 후배의 답을 봐요",
          actionFunctionName: "answers.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "ops",
          scope: "desk",
          description: "업그레이드 승인과 운영 작업을 처리해요",
          actionFunctionName: "ops.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "opsconfig",
          scope: "desk",
          description: "이 그룹방의 역할과 초대 링크를 등록해요",
          actionFunctionName: "opsconfig.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "rundue",
          scope: "desk",
          description: "예약된 알림을 지금 발송해요",
          actionFunctionName: "rundue.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
      ],
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
