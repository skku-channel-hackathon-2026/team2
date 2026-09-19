import { Injectable, Logger } from "@nestjs/common";
import { NativeFunctionClient, TokenManager } from "@channel.io/app-sdk-server";

const BOT_NAME = "후배Go";

interface MessageResult {
  message?: { id?: string };
}

/**
 * The single outbound path to Channel Talk. Everything that sends a message
 * goes through here so token handling and failures stay in one place.
 */
@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private readonly tokenManager: TokenManager,
    private readonly native: NativeFunctionClient,
  ) {}

  private async api(channelId: string) {
    const token = await this.tokenManager.getChannelToken({ channelId });
    return this.native.createProxyApi(token.accessToken);
  }

  async postToGroup(
    channelId: string,
    groupId: string,
    plainText: string,
    rootMessageId?: string,
  ): Promise<string | undefined> {
    const api = await this.api(channelId);
    const result = (await api.writeGroupMessage({
      channelId,
      groupId,
      rootMessageId,
      dto: { plainText, botName: BOT_NAME },
    })) as MessageResult;
    return result.message?.id;
  }

  async postToUserChat(
    channelId: string,
    userChatId: string,
    plainText: string,
  ): Promise<string | undefined> {
    const api = await this.api(channelId);
    const result = (await api.writeUserChatMessage({
      channelId,
      userChatId,
      dto: { plainText, botName: BOT_NAME },
    })) as MessageResult;
    return result.message?.id;
  }

  logFailure(kind: string, error: unknown): void {
    this.logger.warn(
      `${kind} 발송 실패: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}
