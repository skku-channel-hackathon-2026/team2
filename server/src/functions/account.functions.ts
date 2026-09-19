import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  AccountMeOutputSchema,
  EmptyInputSchema,
  LinkManagerInputSchema,
  LinkManagerOutputSchema,
  OkOutputSchema,
  UpsertProfileInputSchema,
  type UpgradeStatus,
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
import { UpgradeService } from "../upgrade.service.js";
import { execute } from "../database.js";
import { nowIso } from "../util.js";

@Injectable()
export class AccountFunctions {
  constructor(
    private readonly accounts: AccountsService,
    private readonly upgrades: UpgradeService,
  ) {}

  @Func("account.me")
  @Description("내 계정과 역할, 업그레이드 상태를 반환")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(AccountMeOutputSchema)
  async me(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof AccountMeOutputSchema>> {
    const user = await this.accounts.resolveJunior(ctx);
    const request = await this.upgrades.latestFor(user.id);
    const status: UpgradeStatus = request?.status ?? "none";

    return {
      user: this.accounts.toProfile(user),
      roles: await this.accounts.rolesFor(user),
      upgrade: {
        status,
        ...(request ? { requestId: request.id } : {}),
        ...(request?.reason ? { reason: request.reason } : {}),
      },
    };
  }

  @Func("account.upsertProfile")
  @Description("별명과 학과, 학번을 저장")
  @InputSchema(UpsertProfileInputSchema)
  @OutputSchema(OkOutputSchema)
  async upsertProfile(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof UpsertProfileInputSchema>,
  ): Promise<z.infer<typeof OkOutputSchema>> {
    const user = await this.accounts.resolveJunior(ctx);
    await execute(
      "UPDATE users SET nickname = ?, department = ?, cohort_year = ?, updated_at = ? WHERE id = ?",
      input.nickname,
      input.department ?? null,
      input.cohortYear ?? null,
      nowIso(),
      user.id,
    );
    return { ok: true };
  }

  @Func("account.linkManager")
  @Description("연결 코드로 선배 계정을 연결")
  @InputSchema(LinkManagerInputSchema)
  @OutputSchema(LinkManagerOutputSchema)
  async linkManager(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof LinkManagerInputSchema>,
  ): Promise<z.infer<typeof LinkManagerOutputSchema>> {
    const managerId = this.accounts.requireManagerId(ctx);
    const linked = await this.upgrades.linkManager(input.code, managerId);
    return { linked: true, userId: linked.id };
  }
}
