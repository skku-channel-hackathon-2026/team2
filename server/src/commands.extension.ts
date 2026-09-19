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
  @Description("Hubae Go command list")
  @InputSchema(z.object({}))
  @OutputSchema(GetCommandsOutputSchema)
  getCommands(): z.infer<typeof GetCommandsOutputSchema> {
    return {
      commands: [
        {
          name: "me",
          scope: "front",
          description: "Check your nickname, department and upgrade status",
          actionFunctionName: "me.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "upgrade",
          scope: "front",
          description: "Apply to become a senior who hosts meals",
          actionFunctionName: "upgrade.open",
          alfMode: "recommend",
          alfDescription:
            "Recommend when a junior wants to become a senior and host meals",
          enabledByDefault: true,
        },
        {
          name: "helpme",
          scope: "front",
          description: "Ask a question and set up a meal with a senior",
          actionFunctionName: "helpme.open",
          alfMode: "recommend",
          alfDescription:
            "Recommend when a junior wants to ask a senior about career or study concerns",
          enabledByDefault: true,
        },
        {
          name: "mybab",
          scope: "front",
          description: "Check your meal requests and schedule",
          actionFunctionName: "mybab.open",
          alfMode: "recommend",
          alfDescription:
            "Recommend when a junior asks about the status of a meal request",
          enabledByDefault: true,
        },
        {
          name: "review",
          scope: "front",
          description: "Leave a review and add the senior to your dex",
          actionFunctionName: "review.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "seniorstart",
          scope: "desk",
          description: "Enter a connection code to link your senior account",
          actionFunctionName: "seniorstart.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "senior",
          scope: "desk",
          description: "Register your fields, availability and weekly cap",
          actionFunctionName: "senior.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "availability",
          scope: "desk",
          description: "Manage your meal availability and weekly table",
          actionFunctionName: "availability.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "wild",
          scope: "desk",
          description: "Review and accept encounters sent to you",
          actionFunctionName: "wild.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "balls",
          scope: "desk",
          description: "Manage your meal schedule and mark meetings done",
          actionFunctionName: "balls.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "dex",
          scope: "desk",
          description: "See the juniors you have caught",
          actionFunctionName: "dex.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "answers",
          scope: "desk",
          description: "See questions you helped with and the juniors' answers",
          actionFunctionName: "answers.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "ops",
          scope: "desk",
          description: "Handle upgrade approvals and staff tasks",
          actionFunctionName: "ops.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "opsconfig",
          scope: "desk",
          description: "Register this group's role and invite link",
          actionFunctionName: "opsconfig.open",
          alfMode: "disable",
          enabledByDefault: true,
        },
        {
          name: "rundue",
          scope: "desk",
          description: "Send the scheduled notifications now",
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
  @Description("Open my profile")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  me(@Input() params: CommandActionInput): CommandResult {
    return openWam("me", params);
  }

  @Func("upgrade.open")
  @Description("Open the senior upgrade request screen")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  upgrade(@Input() params: CommandActionInput): CommandResult {
    return openWam("upgrade", params);
  }

  @Func("helpme.open")
  @Description("Open the ask-a-senior screen")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  helpme(@Input() params: CommandActionInput): CommandResult {
    return openWam("helpme", params);
  }

  @Func("mybab.open")
  @Description("Open my meals")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  mybab(@Input() params: CommandActionInput): CommandResult {
    return openWam("mybab", params);
  }

  @Func("review.open")
  @Description("Open the review screen")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  review(@Input() params: CommandActionInput): CommandResult {
    return openWam("review", params);
  }

  @Func("seniorstart.open")
  @Description("Open the senior account link screen")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  seniorstart(@Input() params: CommandActionInput): CommandResult {
    return openWam("seniorstart", params);
  }

  @Func("senior.open")
  @Description("Open the senior registration screen")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  senior(@Input() params: CommandActionInput): CommandResult {
    return openWam("senior", params);
  }

  @Func("availability.open")
  @Description("Open the availability table")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  availability(@Input() params: CommandActionInput): CommandResult {
    return openWam("availability", params);
  }

  @Func("wild.open")
  @Description("Open the encounter list")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  wild(@Input() params: CommandActionInput): CommandResult {
    return openWam("wild", params);
  }

  @Func("balls.open")
  @Description("Open my poke balls")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  balls(@Input() params: CommandActionInput): CommandResult {
    return openWam("balls", params);
  }

  @Func("dex.open")
  @Description("Open the dex")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  dex(@Input() params: CommandActionInput): CommandResult {
    return openWam("dex", params);
  }

  @Func("answers.open")
  @Description("Open the answers list")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  answers(@Input() params: CommandActionInput): CommandResult {
    return openWam("answers", params);
  }

  @Func("ops.open")
  @Description("Open the staff screen")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  ops(@Input() params: CommandActionInput): CommandResult {
    return openWam("ops", params);
  }

  @Func("opsconfig.open")
  @Description("Open the staff settings")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  opsconfig(@Input() params: CommandActionInput): CommandResult {
    return openWam("opsconfig", params);
  }

  @Func("rundue.open")
  @Description("Open the notification runner")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  rundue(@Input() params: CommandActionInput): CommandResult {
    return openWam("rundue", params);
  }
}
