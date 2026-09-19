import { z } from "zod";
import {
  Description,
  Extension,
  Func,
  GetCommandsOutputSchema,
  InputSchema,
  OutputSchema,
} from "@channel.io/app-sdk-server";
import {
  BALL_FUNCTIONS,
  DEX_FUNCTIONS,
  REVIEW_FUNCTIONS,
  TUTORIAL_FUNCTIONS,
} from "@tutorial/shared";

// Channel App SDK는 앱 전체에서 커맨드 목록을 하나의 metadata.getCommands로만
// 받는다. 기능별 모듈(ball/review/dex/...)이 늘어나도 커맨드 "선언"은 이 파일
// 하나에 모아두고, 실제 로직은 각 모듈의 *.functions.ts가 담당한다.
@Extension({ name: "command", systemVersion: "v1" })
export class CommandExtension {
  @Func("metadata.getCommands")
  @Description("Return the hubae-go command definitions")
  @InputSchema(z.object({}))
  @OutputSchema(GetCommandsOutputSchema)
  getCommands(): z.infer<typeof GetCommandsOutputSchema> {
    return {
      commands: [
        {
          name: "tutorial",
          scope: "desk",
          description: "Open the Channel App SDK tutorial WAM",
          actionFunctionName: TUTORIAL_FUNCTIONS.open,
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "balls",
          scope: "desk",
          description: "내 포켓볼(예약)을 확인하고 만남 완료·재촉을 처리합니다",
          actionFunctionName: BALL_FUNCTIONS.open,
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "review",
          scope: "front",
          description: "밥약 후기와 자기 답을 남깁니다",
          actionFunctionName: REVIEW_FUNCTIONS.open,
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "dex",
          scope: "desk",
          description: "내가 잡은 후배 도감을 확인합니다",
          actionFunctionName: DEX_FUNCTIONS.open,
          alfMode: "disable",
          enabledByDefault: true,
        },
      ],
    };
  }
}
