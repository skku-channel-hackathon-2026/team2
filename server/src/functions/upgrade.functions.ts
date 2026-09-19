import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  EmptyInputSchema,
  UpgradeDecideInputSchema,
  UpgradeDecideOutputSchema,
  UpgradeListInputSchema,
  UpgradeListOutputSchema,
  UpgradeRequestInputSchema,
  UpgradeRequestOutputSchema,
  UpgradeStatusOutputSchema,
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
import { UpgradeService } from "../upgrade.service.js";
import { isPast, newId } from "../util.js";

@Injectable()
export class UpgradeFunctions {
  constructor(
    private readonly accounts: AccountsService,
    private readonly upgrades: UpgradeService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  @Func("upgrade.request")
  @Description("선배 업그레이드를 신청")
  @InputSchema(UpgradeRequestInputSchema)
  @OutputSchema(UpgradeRequestOutputSchema)
  async request(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof UpgradeRequestInputSchema>,
  ): Promise<z.infer<typeof UpgradeRequestOutputSchema>> {
    const user = await this.accounts.resolveJunior(ctx);
    const row = await this.upgrades.request(user, {
      email: input.email,
      intro: input.intro,
    });

    const opsGroupId = await this.settings.groupId("ops");
    if (opsGroupId) {
      await this.notifications.enqueue({
        dedupeKey: `upgrade_requested:${row.id}`,
        kind: "upgrade_requested",
        text: `선배 업그레이드 신청이 들어왔어요.\n신청자: ${user.nickname}\n소개: ${input.intro}\n/운영 에서 승인할 수 있어요.`,
        targetType: "group",
        targetId: opsGroupId,
        urgent: true,
      });
    }
    await this.notifications.runDue(ctx.channel.id, 5);

    return { requestId: row.id, status: row.status };
  }

  @Func("upgrade.status")
  @Description("내 업그레이드 상태와 초대 링크를 반환")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(UpgradeStatusOutputSchema)
  async status(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof UpgradeStatusOutputSchema>> {
    const user = await this.accounts.resolveJunior(ctx);
    const row = await this.upgrades.latestFor(user.id);
    if (!row) return { status: "none" };

    if (row.status !== "approved") {
      return {
        status: row.status,
        ...(row.reason ? { reason: row.reason } : {}),
      };
    }

    if (isPast(row.code_expires_at)) return { status: "expired" };

    const settings = await this.settings.ops();
    return {
      status: "approved",
      ...(settings.inviteLink ? { inviteLink: settings.inviteLink } : {}),
      ...(settings.inviteExpiresAt
        ? { inviteExpiresAt: settings.inviteExpiresAt }
        : {}),
      ...(row.code_plain ? { linkCode: row.code_plain } : {}),
      ...(row.code_expires_at ? { codeExpiresAt: row.code_expires_at } : {}),
    };
  }

  @Func("upgrade.list")
  @Description("업그레이드 신청 목록 (운영진)")
  @InputSchema(UpgradeListInputSchema)
  @OutputSchema(UpgradeListOutputSchema)
  async list(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof UpgradeListInputSchema>,
  ): Promise<z.infer<typeof UpgradeListOutputSchema>> {
    await this.accounts.requireStaff(ctx);
    const rows = await this.upgrades.list(input.status);

    return {
      items: rows.map((row) => ({
        requestId: row.id,
        nickname: row.user.nickname,
        department: row.user.department,
        cohortYear: row.user.cohort_year,
        email: row.email,
        intro: row.intro,
        status: row.status,
        createdAt: row.created_at,
      })),
    };
  }

  @Func("upgrade.decide")
  @Description("업그레이드 신청을 승인하거나 반려 (운영진)")
  @InputSchema(UpgradeDecideInputSchema)
  @OutputSchema(UpgradeDecideOutputSchema)
  async decide(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof UpgradeDecideInputSchema>,
  ): Promise<z.infer<typeof UpgradeDecideOutputSchema>> {
    const staffManagerId = await this.accounts.requireStaff(ctx);

    if (!input.approve) {
      const rejected = await this.upgrades.reject(
        input.requestId,
        staffManagerId,
        input.reason,
      );
      await this.notifyApplicant(
        ctx,
        rejected.user_id,
        `선배 업그레이드 신청이 반려됐어요.${input.reason ? `\n사유: ${input.reason}` : ""}`,
        `upgrade_rejected:${rejected.id}`,
        "upgrade_rejected",
      );
      return { status: rejected.status, delivered: "wam_only" };
    }

    const { row, code } = await this.upgrades.approve(
      input.requestId,
      staffManagerId,
    );
    const settings = await this.settings.ops();
    const linkLine = settings.inviteLink
      ? `초대 링크: ${settings.inviteLink}`
      : "초대 링크는 운영진에게 요청해 주세요.";

    const delivered = await this.notifyApplicant(
      ctx,
      row.user_id,
      `선배 업그레이드가 승인됐어요!\n${linkLine}\n연결 코드: ${code}\n가입 후 데스크에서 /선배시작 을 실행하고 코드를 입력해 주세요. (72시간 유효)`,
      `upgrade_approved:${row.id}`,
      "upgrade_approved",
    );

    return { status: row.status, delivered, linkCode: code };
  }

  /**
   * Delivery falls back to the WAM when the app has no user-chat permission,
   * which is the documented T1 fallback.
   */
  private async notifyApplicant(
    ctx: Context,
    userId: string,
    text: string,
    dedupeKey: string,
    kind: string,
  ): Promise<"user_chat" | "wam_only"> {
    const applicant = await this.accounts.findById(userId);
    if (!applicant?.primary_user_chat_id) return "wam_only";

    const id = await this.notifications.enqueue({
      dedupeKey: `${dedupeKey}:${newId("d")}`,
      kind,
      text,
      targetType: "user_chat",
      targetUserId: applicant.id,
      urgent: true,
    });
    if (!id) return "wam_only";

    const sent = await this.notifications.runOne(ctx.channel.id, id);
    return sent ? "user_chat" : "wam_only";
  }
}
