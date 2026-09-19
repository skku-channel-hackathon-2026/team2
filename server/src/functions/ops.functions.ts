import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  EmptyInputSchema,
  GROUP_ROLE_LABEL,
  GROUP_ROLE_SETTING_KEY,
  OpsSaveSettingsInputSchema,
  OpsSaveSettingsOutputSchema,
  OpsSettingsSchema,
  RunDueOutputSchema,
  SETTING_KEYS,
} from "@tutorial/shared";
import {
  Ctx,
  Description,
  Func,
  Input,
  InputSchema,
  OutputSchema,
  type Context,
} from "@channel.io/app-sdk-server";
import { AccountsService } from "../accounts.service.js";
import { NotificationsService } from "../notifications.service.js";
import { SettingsService } from "../settings.service.js";
import { newId } from "../util.js";
import { sweepReviewLifecycle } from "../modules/ball/review-lifecycle.service.js";
import { sweepWaves } from "../modules/matching/wave-lifecycle.service.js";

@Injectable()
export class OpsFunctions {
  constructor(
    private readonly accounts: AccountsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Func("ops.getSettings")
  @Description("운영 설정을 반환")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(OpsSettingsSchema)
  async getSettings(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof OpsSettingsSchema>> {
    await this.accounts.requireStaff(ctx);
    return this.settings.ops();
  }

  @Func("ops.saveSettings")
  @Description("그룹방 역할과 초대 링크를 저장")
  @InputSchema(OpsSaveSettingsInputSchema)
  @OutputSchema(OpsSaveSettingsOutputSchema)
  async saveSettings(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof OpsSaveSettingsInputSchema>,
  ): Promise<z.infer<typeof OpsSaveSettingsOutputSchema>> {
    const managerId = await this.accounts.requireStaff(ctx);
    // The first manager to configure the app becomes the staff allowlist seed.
    await this.settings.addStaff(managerId);

    let announced = false;

    if (input.groupRole && input.chatId) {
      await this.settings.set(
        GROUP_ROLE_SETTING_KEY[input.groupRole],
        input.chatId,
      );

      const id = await this.notifications.enqueue({
        dedupeKey: `opsconfig:${newId("d")}`,
        kind: "ops_configured",
        text: `이 방을 ${GROUP_ROLE_LABEL[input.groupRole]}으로 등록했어요.`,
        targetType: "group",
        targetId: input.chatId,
        urgent: true,
      });
      if (id) announced = await this.notifications.runOne(ctx.channel.id, id);
    }

    if (input.inviteLink) {
      await this.settings.set(SETTING_KEYS.inviteLink, input.inviteLink);
    }
    if (input.inviteExpiresAt) {
      await this.settings.set(
        SETTING_KEYS.inviteExpiresAt,
        input.inviteExpiresAt,
      );
    }

    return { settings: await this.settings.ops(), announced };
  }

  @Func("jobs.runDue")
  @Description("예약된 알림을 발송")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(RunDueOutputSchema)
  async runDue(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof RunDueOutputSchema>> {
    await this.accounts.requireStaff(ctx);

    // 후기 마감 리마인드·도망 처리, 웨이브 승급·만료를 outbox에 먼저 쌓은
    // 뒤, 아래에서 한 번에 발송한다. 이렇게 하면 새 응답 필드 없이도(=등록
    // 갱신 불필요) 방금 쌓인 알림이 sent/failed 집계에 자연히 포함된다.
    await sweepReviewLifecycle({ notifications: this.notifications });
    await sweepWaves({
      notifications: this.notifications,
      settings: this.settings,
    });

    const summary = await this.notifications.runDue(ctx.channel.id, 20);

    if (summary.failed > 0) {
      const opsGroupId = await this.settings.groupId("ops");
      if (opsGroupId) {
        const id = await this.notifications.enqueue({
          dedupeKey: `notify_failures:${newId("d")}`,
          kind: "notify_failures",
          text: `⚠️ 알림 발송 실패 ${summary.failed}건이 있어요. 서버 로그를 확인해 주세요.`,
          targetType: "group",
          targetId: opsGroupId,
          urgent: true,
        });
        if (id) await this.notifications.runOne(ctx.channel.id, id);
      }
    }

    return summary;
  }
}
