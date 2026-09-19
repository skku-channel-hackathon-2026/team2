import { z } from "zod";

export * from "./hubaego.js";

export const WAM_NAME = "hubaego";

export const SCREENS = [
  "me",
  "upgrade",
  "link",
  "senior",
  "ops",
  "opsconfig",
  "rundue",
  "soon",
] as const;
export type Screen = (typeof SCREENS)[number];

export const FUNCTIONS = {
  accountMe: "account.me",
  accountUpsertProfile: "account.upsertProfile",
  accountLinkManager: "account.linkManager",
  upgradeRequest: "upgrade.request",
  upgradeStatus: "upgrade.status",
  upgradeList: "upgrade.list",
  upgradeDecide: "upgrade.decide",
  seniorGetProfile: "senior.getProfile",
  seniorUpsertProfile: "senior.upsertProfile",
  opsGetSettings: "ops.getSettings",
  opsSaveSettings: "ops.saveSettings",
  jobsRunDue: "jobs.runDue",
} as const;

export const SETTING_KEYS = {
  wildGroupId: "wild_group_id",
  loungeGroupId: "lounge_group_id",
  opsGroupId: "ops_group_id",
  inviteLink: "invite_link",
  inviteExpiresAt: "invite_expires_at",
} as const;

export const GROUP_ROLES = ["wild", "lounge", "ops"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const GROUP_ROLE_SETTING_KEY: Record<GroupRole, string> = {
  wild: SETTING_KEYS.wildGroupId,
  lounge: SETTING_KEYS.loungeGroupId,
  ops: SETTING_KEYS.opsGroupId,
};

export const GROUP_ROLE_LABEL: Record<GroupRole, string> = {
  wild: "출현 알림방",
  lounge: "선배 라운지",
  ops: "운영방",
};

/**
 * Every command declared in T0. Unimplemented commands open the `soon` screen
 * so the whole set can be registered by operators in a single request.
 */
export interface CommandSpec {
  id: string;
  name: string;
  description: string;
  scope: "front" | "desk";
  alfMode: "disable" | "recommend";
  alfDescription?: string;
  screen: Screen;
  actionFunctionName: string;
}

export const COMMANDS: CommandSpec[] = [
  {
    id: "me",
    name: "내정보",
    description: "내 별명과 학과, 업그레이드 상태를 확인해요",
    scope: "front",
    alfMode: "disable",
    screen: "me",
    actionFunctionName: "me.open",
  },
  {
    id: "upgrade",
    name: "선배로-업그레이드",
    description: "밥약을 해주는 선배로 업그레이드를 신청해요",
    scope: "front",
    alfMode: "recommend",
    alfDescription: "후배가 선배가 되어 밥약을 해주고 싶어할 때 추천해요",
    screen: "upgrade",
    actionFunctionName: "upgrade.open",
  },
  {
    id: "helpme",
    name: "선배-도와줘요",
    description: "궁금한 것을 물어보고 선배와 밥약을 잡아요",
    scope: "front",
    alfMode: "recommend",
    alfDescription:
      "후배가 진로나 학업 고민을 선배에게 물어보고 싶을 때 추천해요",
    screen: "soon",
    actionFunctionName: "helpme.open",
  },
  {
    id: "mybab",
    name: "내밥약",
    description: "내 밥약 신청과 일정을 확인해요",
    scope: "front",
    alfMode: "recommend",
    alfDescription: "후배가 신청한 밥약의 진행 상태를 물어볼 때 추천해요",
    screen: "soon",
    actionFunctionName: "mybab.open",
  },
  {
    id: "review",
    name: "후기",
    description: "만남 후기를 남기고 선배를 도감에 등록해요",
    scope: "front",
    alfMode: "disable",
    screen: "soon",
    actionFunctionName: "review.open",
  },
  {
    id: "seniorstart",
    name: "선배시작",
    description: "연결 코드를 입력해 선배 계정을 연결해요",
    scope: "desk",
    alfMode: "disable",
    screen: "link",
    actionFunctionName: "seniorstart.open",
  },
  {
    id: "senior",
    name: "선배등록",
    description: "분야와 가용 시간, 주간 상한을 등록해요",
    scope: "desk",
    alfMode: "disable",
    screen: "senior",
    actionFunctionName: "senior.open",
  },
  {
    id: "wild",
    name: "출현",
    description: "나에게 온 출현을 확인하고 수락해요",
    scope: "desk",
    alfMode: "disable",
    screen: "soon",
    actionFunctionName: "wild.open",
  },
  {
    id: "balls",
    name: "포켓볼",
    description: "내 밥약 일정과 만남 완료를 관리해요",
    scope: "desk",
    alfMode: "disable",
    screen: "soon",
    actionFunctionName: "balls.open",
  },
  {
    id: "dex",
    name: "도감",
    description: "내가 잡은 후배 목록을 봐요",
    scope: "desk",
    alfMode: "disable",
    screen: "soon",
    actionFunctionName: "dex.open",
  },
  {
    id: "answers",
    name: "답변",
    description: "내가 도운 질문과 후배의 답을 봐요",
    scope: "desk",
    alfMode: "disable",
    screen: "soon",
    actionFunctionName: "answers.open",
  },
  {
    id: "ops",
    name: "운영",
    description: "업그레이드 승인과 운영 작업을 처리해요",
    scope: "desk",
    alfMode: "disable",
    screen: "ops",
    actionFunctionName: "ops.open",
  },
  {
    id: "opsconfig",
    name: "운영설정",
    description: "이 그룹방의 역할과 초대 링크를 등록해요",
    scope: "desk",
    alfMode: "disable",
    screen: "opsconfig",
    actionFunctionName: "opsconfig.open",
  },
  {
    id: "rundue",
    name: "알림실행",
    description: "예약된 알림을 지금 발송해요",
    scope: "desk",
    alfMode: "disable",
    screen: "rundue",
    actionFunctionName: "rundue.open",
  },
];

/** AppStore currently emits nullable optionals for these command fields. */
export const CommandActionInputSchema = z.object({
  chat: z.object({ type: z.string(), id: z.string() }).optional(),
  trigger: z
    .object({
      type: z.string(),
      attributes: z
        .record(z.string())
        .nullish()
        .transform((attributes) => attributes ?? {}),
    })
    .optional(),
  input: z
    .record(z.unknown())
    .nullish()
    .transform((input) => input ?? {}),
  language: z.string().optional(),
});
export type CommandActionInput = z.infer<typeof CommandActionInputSchema>;

export const WamArgsSchema = z.object({
  screen: z.enum(SCREENS),
  commandId: z.string(),
  commandName: z.string(),
  chatId: z.string(),
  chatType: z.string(),
});
export type WamArgs = z.infer<typeof WamArgsSchema>;

export const WamDataSchema = WamArgsSchema.extend({
  appId: z.string(),
  channelId: z.string(),
});
export type WamData = z.infer<typeof WamDataSchema>;

export const ROLES = ["junior", "senior", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const UPGRADE_STATUSES = [
  "none",
  "requested",
  "approved",
  "linked",
  "rejected",
  "expired",
] as const;
export type UpgradeStatus = (typeof UPGRADE_STATUSES)[number];

export const EmptyInputSchema = z.object({});

export const AccountProfileSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  department: z.string().nullable(),
  cohortYear: z.number().int().nullable(),
  notifyLevel: z.enum(["all", "important", "none"]),
  hasManagerAccount: z.boolean(),
});
export type AccountProfile = z.infer<typeof AccountProfileSchema>;

export const AccountMeOutputSchema = z.object({
  user: AccountProfileSchema,
  roles: z.array(z.enum(ROLES)),
  upgrade: z.object({
    status: z.enum(UPGRADE_STATUSES),
    requestId: z.string().optional(),
    reason: z.string().optional(),
  }),
});

export const UpsertProfileInputSchema = z.object({
  nickname: z.string().trim().min(1).max(20),
  department: z.string().trim().max(40).optional(),
  cohortYear: z.number().int().min(1900).max(2100).optional(),
});

export const OkOutputSchema = z.object({ ok: z.boolean() });

export const UpgradeRequestInputSchema = z.object({
  email: z.string().trim().email().optional(),
  intro: z.string().trim().min(10).max(300),
  agreeRules: z.literal(true),
});

export const UpgradeRequestOutputSchema = z.object({
  requestId: z.string(),
  status: z.enum(UPGRADE_STATUSES),
});

export const UpgradeStatusOutputSchema = z.object({
  status: z.enum(UPGRADE_STATUSES),
  reason: z.string().optional(),
  inviteLink: z.string().optional(),
  inviteExpiresAt: z.string().optional(),
  linkCode: z.string().optional(),
  codeExpiresAt: z.string().optional(),
});

export const UpgradeListInputSchema = z.object({
  status: z
    .enum(["requested", "approved", "linked", "rejected", "expired"])
    .optional(),
});

export const UpgradeRequestCardSchema = z.object({
  requestId: z.string(),
  nickname: z.string(),
  department: z.string().nullable(),
  cohortYear: z.number().int().nullable(),
  email: z.string().nullable(),
  intro: z.string(),
  status: z.enum(UPGRADE_STATUSES),
  createdAt: z.string(),
});

export const UpgradeListOutputSchema = z.object({
  items: z.array(UpgradeRequestCardSchema),
});

export const UpgradeDecideInputSchema = z.object({
  requestId: z.string().min(1),
  approve: z.boolean(),
  reason: z.string().trim().max(200).optional(),
});

export const UpgradeDecideOutputSchema = z.object({
  status: z.enum(UPGRADE_STATUSES),
  delivered: z.enum(["user_chat", "wam_only", "manual"]),
  linkCode: z.string().optional(),
});

export const LinkManagerInputSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export const LinkManagerOutputSchema = z.object({
  linked: z.boolean(),
  userId: z.string(),
});

export const SeniorSlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});

export const SeniorProfileSchema = z.object({
  headline: z.string().nullable(),
  portfolio: z.string().nullable(),
  weeklyLimitMinutes: z.number().int(),
  status: z.enum(["active", "paused"]),
  fieldIds: z.array(z.string()),
  slots: z.array(SeniorSlotSchema),
});

export const SeniorGetProfileOutputSchema = z.object({
  linked: z.boolean(),
  profile: SeniorProfileSchema.nullable(),
  fields: z.array(z.object({ id: z.string(), label: z.string() })),
});

export const SeniorUpsertProfileInputSchema = z.object({
  headline: z.string().trim().max(60).optional(),
  portfolio: z.string().trim().max(200).optional(),
  weeklyLimitMinutes: z.number().int().min(0).max(1200),
  status: z.enum(["active", "paused"]),
  fieldIds: z.array(z.string().min(1)).min(1).max(5),
  slots: z.array(SeniorSlotSchema).max(20),
});

export const OpsSettingsSchema = z.object({
  wildGroupId: z.string().nullable(),
  loungeGroupId: z.string().nullable(),
  opsGroupId: z.string().nullable(),
  inviteLink: z.string().nullable(),
  inviteExpiresAt: z.string().nullable(),
});

export const OpsSaveSettingsInputSchema = z.object({
  groupRole: z.enum(GROUP_ROLES).optional(),
  chatId: z.string().optional(),
  inviteLink: z.string().trim().url().max(500).optional(),
  inviteExpiresAt: z.string().trim().max(40).optional(),
});

export const OpsSaveSettingsOutputSchema = z.object({
  settings: OpsSettingsSchema,
  announced: z.boolean(),
});

export const RunDueOutputSchema = z.object({
  processed: z.number().int(),
  sent: z.number().int(),
  failed: z.number().int(),
  skipped: z.number().int(),
});

export const ERROR_CODES = {
  notJunior: "NOT_JUNIOR",
  notManager: "NOT_MANAGER",
  notStaff: "NOT_STAFF",
  notLinked: "NOT_LINKED",
  codeInvalid: "CODE_INVALID",
  codeExpired: "CODE_EXPIRED",
  codeLocked: "CODE_LOCKED",
  alreadyLinked: "ALREADY_LINKED",
  duplicateRequest: "DUPLICATE_REQUEST",
  notFound: "NOT_FOUND",
  notConfigured: "NOT_CONFIGURED",
  forbidden: "FORBIDDEN",
  closed: "CLOSED",
  reviewNotReady: "REVIEW_NOT_READY",
  reviewAlreadyDone: "REVIEW_ALREADY_DONE",
  reminderLimit: "REMINDER_LIMIT",
} as const;
