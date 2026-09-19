import { z } from "zod";

// T5 — 잡기 파이프라인: 만남 완료 → 재촉 → 후기 제출 → 도감 등록 + 친밀도.
// "커맨드 열기"(*.open)는 commands.extension.ts의 CommandActions가 전담하므로
// 여기서는 데이터 함수(list/confirmMet/remind/submit)만 다룬다.
// 도감 "타입"은 T1에서 이미 만들어진 fields(진로·취업/학업·수강/...) 테이블을 쓴다.

// 0003_t1_accounts.sql이 심어둔 fields 테이블과 반드시 같은 값을 유지한다.
export const FIELD_OPTIONS = [
  { id: "career", label: "진로·취업" },
  { id: "study", label: "학업·수강" },
  { id: "club", label: "동아리·대외활동" },
  { id: "grad", label: "대학원·연구" },
  { id: "life", label: "학교생활" },
] as const;

export const BALL_FUNCTIONS = {
  list: "ball.list",
  confirmMet: "ball.confirmMet",
  remind: "ball.remind",
} as const;

export const REVIEW_FUNCTIONS = {
  submit: "review.submit",
} as const;

export const DEX_FUNCTIONS = {
  list: "dex.list",
} as const;

export const ENCOUNTER_FUNCTIONS = {
  create: "encounter.create",
  mine: "encounter.mine",
  fields: "encounter.fields",
} as const;

export const ANSWERS_FUNCTIONS = {
  list: "answers.list",
} as const;

export const WILD_FUNCTIONS = {
  list: "wild.list",
  accept: "wild.accept",
} as const;

export const MeetTypeSchema = z.enum(["meal", "cafe", "online"]);
export type MeetType = z.infer<typeof MeetTypeSchema>;

export const MEET_TYPE_LABEL: Record<MeetType, string> = {
  meal: "밥약",
  cafe: "카페",
  online: "온라인",
};

export const TimeWindowSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

export const BallStatusSchema = z.enum([
  "thrown",
  "wobbling",
  "caught",
  "escaped",
  "cancelled",
]);
export type BallStatus = z.infer<typeof BallStatusSchema>;

export const BALL_STATUS_LABEL: Record<BallStatus, string> = {
  thrown: "만남 예정",
  wobbling: "후기 대기",
  caught: "잡기 성공",
  escaped: "도망",
  cancelled: "취소",
};

export const EncounterStatusSchema = z.enum([
  "wild",
  "matched",
  "met",
  "caught",
  "escaped",
  "expired",
  "cancelled",
]);
export type EncounterStatus = z.infer<typeof EncounterStatusSchema>;

export const ENCOUNTER_STATUS_LABEL: Record<EncounterStatus, string> = {
  wild: "선배 기다리는 중",
  matched: "만남 확정",
  met: "후기 대기",
  caught: "완료",
  escaped: "후기 없이 종료",
  expired: "기간 만료",
  cancelled: "취소",
};

export const ConfirmMetInputSchema = z.object({
  ballId: z.string().min(1),
});
export type ConfirmMetInput = z.infer<typeof ConfirmMetInputSchema>;

export const ConfirmMetOutputSchema = z.object({
  ballStatus: BallStatusSchema,
  encounterStatus: EncounterStatusSchema,
  reviewDueAt: z.string().nullable(),
});
export type ConfirmMetOutput = z.infer<typeof ConfirmMetOutputSchema>;

export const RemindInputSchema = z.object({
  ballId: z.string().min(1),
});
export type RemindInput = z.infer<typeof RemindInputSchema>;

export const RemindOutputSchema = z.object({
  remindersSent: z.number().int().min(0).max(2),
  messageTemplate: z.string(),
  delivered: z.enum(["auto", "manual_copy"]),
});
export type RemindOutput = z.infer<typeof RemindOutputSchema>;

export const BallCardSchema = z.object({
  ballId: z.string(),
  encounterId: z.string(),
  status: BallStatusSchema,
  title: z.string(),
  slotStart: z.string().nullable(),
  slotEnd: z.string().nullable(),
  place: z.string().nullable(),
  juniorAlias: z.string(),
  remindersLeft: z.number().int(),
  reviewDueAt: z.string().nullable(),
});
export type BallCard = z.infer<typeof BallCardSchema>;

export const BallListOutputSchema = z.object({
  items: z.array(BallCardSchema),
});
export type BallListOutput = z.infer<typeof BallListOutputSchema>;

export const ReviewSubmitInputSchema = z.object({
  encounterId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(20),
  selfAnswer: z.string().min(1).optional(),
  shareConsent: z.boolean(),
});
export type ReviewSubmitInput = z.infer<typeof ReviewSubmitInputSchema>;

export const SeniorCardSchema = z.object({
  seniorId: z.string(),
  seniorAlias: z.string(),
  level: z.number().int().min(1).max(4),
});
export type SeniorCard = z.infer<typeof SeniorCardSchema>;

export const ReviewSubmitOutputSchema = z.object({
  caughtBy: z.array(SeniorCardSchema),
});
export type ReviewSubmitOutput = z.infer<typeof ReviewSubmitOutputSchema>;

export const DexEntrySchema = z.object({
  juniorAlias: z.string(),
  typeFieldId: z.string(),
  typeLabel: z.string(),
  firstCaughtAt: z.string(),
  catchCount: z.number().int(),
  intimacy: z.number().int(),
  level: z.number().int().min(1).max(4),
  evolved: z.boolean(),
});
export type DexEntry = z.infer<typeof DexEntrySchema>;

export const DexListOutputSchema = z.object({
  total: z.number().int(),
  evolved: z.number().int(),
  items: z.array(DexEntrySchema),
});
export type DexListOutput = z.infer<typeof DexListOutputSchema>;

export const EncounterCreateInputSchema = z.object({
  title: z.string().trim().min(5).max(200),
  fieldId: z.string().min(1),
  meetType: MeetTypeSchema,
  maxSeniors: z.number().int().min(1).max(3),
  windows: z.array(TimeWindowSchema).min(1).max(5),
});
export type EncounterCreateInput = z.infer<typeof EncounterCreateInputSchema>;

export const EncounterCreateOutputSchema = z.object({
  encounterId: z.string(),
  notifiedCount: z.number().int(),
});
export type EncounterCreateOutput = z.infer<typeof EncounterCreateOutputSchema>;

export const EncounterSeniorSchema = z.object({
  seniorAlias: z.string(),
  ballStatus: BallStatusSchema,
});
export type EncounterSenior = z.infer<typeof EncounterSeniorSchema>;

export const MyEncounterCardSchema = z.object({
  encounterId: z.string(),
  title: z.string(),
  status: EncounterStatusSchema,
  seniorsJoined: z.number().int(),
  maxSeniors: z.number().int(),
  slotStart: z.string().nullable(),
  slotEnd: z.string().nullable(),
  place: z.string().nullable(),
  fieldId: z.string(),
  fieldLabel: z.string(),
  meetType: MeetTypeSchema,
  createdAt: z.string(),
  windows: z.array(TimeWindowSchema),
  seniors: z.array(EncounterSeniorSchema),
  reviewDueAt: z.string().nullable(),
  hasReview: z.boolean(),
});
export type MyEncounterCard = z.infer<typeof MyEncounterCardSchema>;

export const EncounterMineOutputSchema = z.object({
  items: z.array(MyEncounterCardSchema),
});
export type EncounterMineOutput = z.infer<typeof EncounterMineOutputSchema>;

export const WildCardSchema = z.object({
  encounterId: z.string(),
  title: z.string(),
  fieldId: z.string(),
  fieldLabel: z.string(),
  meetType: MeetTypeSchema,
  overlapWindows: z.array(TimeWindowSchema),
  seniorsJoined: z.number().int(),
  maxSeniors: z.number().int(),
  juniorAlias: z.string(),
});
export type WildCard = z.infer<typeof WildCardSchema>;

export const WildListOutputSchema = z.object({
  items: z.array(WildCardSchema),
});
export type WildListOutput = z.infer<typeof WildListOutputSchema>;

export const WildAcceptInputSchema = z.object({
  encounterId: z.string().min(1),
  slot: TimeWindowSchema.optional(),
  place: z.string().trim().max(100).optional(),
});
export type WildAcceptInput = z.infer<typeof WildAcceptInputSchema>;

export const WildAcceptOutputSchema = z.object({
  ballId: z.string(),
  isFirst: z.boolean(),
  slotStart: z.string().nullable(),
  slotEnd: z.string().nullable(),
  seniorsJoined: z.number().int(),
  maxSeniors: z.number().int(),
});
export type WildAcceptOutput = z.infer<typeof WildAcceptOutputSchema>;

export const FieldOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type FieldOption = z.infer<typeof FieldOptionSchema>;

export const EncounterFieldsOutputSchema = z.object({
  fields: z.array(FieldOptionSchema),
});
export type EncounterFieldsOutput = z.infer<typeof EncounterFieldsOutputSchema>;

export const AnswerCardSchema = z.object({
  encounterId: z.string(),
  title: z.string(),
  fieldLabel: z.string(),
  juniorAlias: z.string(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string(),
  selfAnswer: z.string().nullable(),
  createdAt: z.string(),
});
export type AnswerCard = z.infer<typeof AnswerCardSchema>;

export const AnswersListOutputSchema = z.object({
  items: z.array(AnswerCardSchema),
});
export type AnswersListOutput = z.infer<typeof AnswersListOutputSchema>;

export const KNOWLEDGE_FUNCTIONS = {
  searchSimilar: "question.searchSimilar",
  listDrafts: "knowledge.listDrafts",
  review: "knowledge.review",
  export: "knowledge.export",
} as const;

export const SearchSimilarInputSchema = z.object({
  text: z.string().trim().min(1),
  fieldId: z.string().min(1),
});
export type SearchSimilarInput = z.infer<typeof SearchSimilarInputSchema>;

export const KnowledgeCardSchema = z.object({
  knowledgeId: z.string(),
  questionTitle: z.string(),
  answerText: z.string(),
  confirmedBySeniorAlias: z.string().nullable(),
});
export type KnowledgeCard = z.infer<typeof KnowledgeCardSchema>;

export const SearchSimilarOutputSchema = z.object({
  items: z.array(KnowledgeCardSchema),
});
export type SearchSimilarOutput = z.infer<typeof SearchSimilarOutputSchema>;

export const KnowledgeStatusSchema = z.enum([
  "draft",
  "published",
  "expired",
  "rejected",
]);

export const KnowledgeDraftSchema = z.object({
  knowledgeId: z.string(),
  questionTitle: z.string(),
  answerText: z.string(),
  fieldLabel: z.string(),
  authorAlias: z.string().nullable(),
  createdAt: z.string(),
});
export type KnowledgeDraft = z.infer<typeof KnowledgeDraftSchema>;

export const KnowledgeDraftListOutputSchema = z.object({
  items: z.array(KnowledgeDraftSchema),
});
export type KnowledgeDraftListOutput = z.infer<
  typeof KnowledgeDraftListOutputSchema
>;

export const KnowledgeReviewInputSchema = z.object({
  knowledgeId: z.string().min(1),
  action: z.enum(["publish", "reject"]),
  editedAnswerText: z.string().trim().min(1).optional(),
});
export type KnowledgeReviewInput = z.infer<typeof KnowledgeReviewInputSchema>;

export const KnowledgeReviewOutputSchema = z.object({
  status: KnowledgeStatusSchema,
});
export type KnowledgeReviewOutput = z.infer<typeof KnowledgeReviewOutputSchema>;

export const KnowledgeExportInputSchema = z.object({
  since: z.string().optional(),
});
export type KnowledgeExportInput = z.infer<typeof KnowledgeExportInputSchema>;

export const KnowledgeExportOutputSchema = z.object({
  markdown: z.string(),
  count: z.number().int(),
});
export type KnowledgeExportOutput = z.infer<typeof KnowledgeExportOutputSchema>;

// 친밀도 레벨: Lv1 0-29 · Lv2 30-79 · Lv3 80-149 · Lv4 150+
export function intimacyLevel(points: number): 1 | 2 | 3 | 4 {
  if (points >= 150) return 4;
  if (points >= 80) return 3;
  if (points >= 30) return 2;
  return 1;
}

export const INTIMACY_POINTS = {
  first_catch: 30,
  repeat_catch: 20,
  five_star: 10,
  self_answer: 10,
  evolution: 50,
} as const;
