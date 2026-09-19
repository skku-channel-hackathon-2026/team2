import { z } from "zod";

export * from "./hubaego.js";

export const WAM_NAME = "hubaego";

export const SCREENS = [
  "me",
  "upgrade",
  "link",
  "senior",
  "availability",
  "ops",
  "opsconfig",
  "helpme",
  "mybab",
  "wild",
  "balls",
  "dex",
  "review",
  "answers",
  "rundue",
  "helpme",
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
  availabilityGet: "availability.get",
  availabilitySetStatus: "availability.setStatus",
  availabilitySetSlots: "availability.setSlots",
  availabilitySearch: "availability.search",
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
    name: "me",
    description: "Check your nickname, department and upgrade status",
    scope: "front",
    alfMode: "disable",
    screen: "me",
    actionFunctionName: "me.open",
  },
  {
    id: "upgrade",
    name: "upgrade",
    description: "Apply to become a senior who hosts meals",
    scope: "front",
    alfMode: "recommend",
    alfDescription:
      "Recommend when a junior wants to become a senior and host meals",
    screen: "upgrade",
    actionFunctionName: "upgrade.open",
  },
  {
    id: "helpme",
    name: "helpme",
    description: "Ask a question and set up a meal with a senior",
    scope: "front",
    alfMode: "recommend",
    alfDescription:
      "Recommend when a junior wants to ask a senior about career or study concerns",
    screen: "helpme",
    actionFunctionName: "helpme.open",
  },
  {
    id: "mybab",
    name: "mybab",
    description: "Check your meal requests and schedule",
    scope: "front",
    alfMode: "recommend",
    alfDescription:
      "Recommend when a junior asks about the status of a meal request",
    screen: "mybab",
    actionFunctionName: "mybab.open",
  },
  {
    id: "review",
    name: "review",
    description: "Leave a review and add the senior to your dex",
    scope: "front",
    alfMode: "disable",
    screen: "review",
    actionFunctionName: "review.open",
  },
  {
    id: "seniorstart",
    name: "seniorstart",
    description: "Enter a connection code to link your senior account",
    scope: "desk",
    alfMode: "disable",
    screen: "link",
    actionFunctionName: "seniorstart.open",
  },
  {
    id: "senior",
    name: "senior",
    description: "Register your fields, availability and weekly cap",
    scope: "desk",
    alfMode: "disable",
    screen: "senior",
    actionFunctionName: "senior.open",
  },
  {
    id: "availability",
    name: "availability",
    description: "Manage your meal availability and weekly table",
    scope: "desk",
    alfMode: "disable",
    screen: "availability",
    actionFunctionName: "availability.open",
  },
  {
    id: "wild",
    name: "wild",
    description: "Review and accept encounters sent to you",
    scope: "desk",
    alfMode: "disable",
    screen: "wild",
    actionFunctionName: "wild.open",
  },
  {
    id: "balls",
    name: "balls",
    description: "Manage your meal schedule and mark meetings done",
    scope: "desk",
    alfMode: "disable",
    screen: "balls",
    actionFunctionName: "balls.open",
  },
  {
    id: "dex",
    name: "dex",
    description: "See the juniors you have caught",
    scope: "desk",
    alfMode: "disable",
    screen: "dex",
    actionFunctionName: "dex.open",
  },
  {
    id: "answers",
    name: "answers",
    description: "See questions you helped with and the juniors' answers",
    scope: "desk",
    alfMode: "disable",
    screen: "answers",
    actionFunctionName: "answers.open",
  },
  {
    id: "ops",
    name: "ops",
    description: "Handle upgrade approvals and staff tasks",
    scope: "desk",
    alfMode: "disable",
    screen: "ops",
    actionFunctionName: "ops.open",
  },
  {
    id: "opsconfig",
    name: "opsconfig",
    description: "Register this group's role and invite link",
    scope: "desk",
    alfMode: "disable",
    screen: "opsconfig",
    actionFunctionName: "opsconfig.open",
  },
  {
    id: "rundue",
    name: "rundue",
    description: "Send the scheduled notifications now",
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
export type AccountMeOutput = z.infer<typeof AccountMeOutputSchema>;

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
export type UpgradeStatusOutput = z.infer<typeof UpgradeStatusOutputSchema>;

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
export type UpgradeRequestCard = z.infer<typeof UpgradeRequestCardSchema>;
export type UpgradeListOutput = z.infer<typeof UpgradeListOutputSchema>;

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
export type UpgradeDecideOutput = z.infer<typeof UpgradeDecideOutputSchema>;

export const LinkManagerInputSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export const LinkManagerOutputSchema = z.object({
  linked: z.boolean(),
  userId: z.string(),
});

export const SENIOR_STATUSES = ["active", "paused"] as const;
export type SeniorStatus = (typeof SENIOR_STATUSES)[number];

/** The availability grid the WAM renders: one cell per hour, 08:00-23:00. */
export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 23;
export const MAX_SLOTS = 40;

/** Index 0 is Monday, matching `senior_slots.weekday` and the KST weekday
 *  the matcher derives in `matching.service.ts`. */
export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

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
export type SeniorProfile = z.infer<typeof SeniorProfileSchema>;
export type SeniorGetProfileOutput = z.infer<
  typeof SeniorGetProfileOutputSchema
>;

/** `status` and `slots` are owned by the availability screen; omitting them
 *  here leaves the stored timetable untouched. */
export const SeniorUpsertProfileInputSchema = z.object({
  headline: z.string().trim().max(60).optional(),
  portfolio: z.string().trim().max(200).optional(),
  weeklyLimitMinutes: z.number().int().min(0).max(1200),
  status: z.enum(SENIOR_STATUSES).optional(),
  fieldIds: z.array(z.string().min(1)).min(1).max(5),
  slots: z.array(SeniorSlotSchema).max(MAX_SLOTS).optional(),
});

export const AvailabilityStatusSchema = z.object({
  status: z.enum(SENIOR_STATUSES),
  pausedUntil: z.string().nullable(),
  statusNote: z.string().nullable(),
  /** `paused` with a past `pausedUntil` reads as available again. */
  availableNow: z.boolean(),
});

export const AvailabilityGetOutputSchema = z.object({
  linked: z.boolean(),
  registered: z.boolean(),
  availability: AvailabilityStatusSchema,
  slots: z.array(SeniorSlotSchema),
  totalMinutes: z.number().int(),
  weeklyLimitMinutes: z.number().int(),
  updatedAt: z.string().nullable(),
});
export type SeniorSlot = z.infer<typeof SeniorSlotSchema>;
export type AvailabilityGetOutput = z.infer<typeof AvailabilityGetOutputSchema>;

export const AvailabilitySetStatusInputSchema = z.object({
  status: z.enum(SENIOR_STATUSES),
  /** ISO date or datetime; ignored unless `status` is `paused`. */
  pausedUntil: z.string().trim().min(4).max(40).nullish(),
  statusNote: z.string().trim().max(80).nullish(),
});

export const AvailabilitySetSlotsInputSchema = z.object({
  slots: z.array(SeniorSlotSchema).max(MAX_SLOTS),
});

export const AvailabilitySetSlotsOutputSchema = z.object({
  slots: z.array(SeniorSlotSchema),
  totalMinutes: z.number().int(),
  updatedAt: z.string(),
});

export const AvailabilitySearchInputSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  fieldIds: z.array(z.string().min(1)).max(5).optional(),
  minOverlapMinutes: z.number().int().min(0).max(1440).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const AvailableSeniorSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  headline: z.string().nullable(),
  fieldIds: z.array(z.string()),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
  overlapMinutes: z.number().int(),
  weeklyLimitMinutes: z.number().int(),
});

export const AvailabilitySearchOutputSchema = z.object({
  items: z.array(AvailableSeniorSchema),
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
  full: "FULL",
  alreadyAccepted: "ALREADY_ACCEPTED",
  slotRequired: "SLOT_REQUIRED",
  invalidSlot: "INVALID_SLOT",
  piiDetected: "PII_DETECTED",
} as const;
