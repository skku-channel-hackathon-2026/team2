import { z } from "zod";

// T5 — 잡기 파이프라인: 만남 완료 → 재촉 → 후기 제출 → 도감 등록 + 친밀도.
// "커맨드 열기"(*.open)는 commands.extension.ts의 CommandActions가 전담하므로
// 여기서는 데이터 함수(list/confirmMet/remind/submit)만 다룬다.
// 도감 "타입"은 T1에서 이미 만들어진 fields(진로·취업/학업·수강/...) 테이블을 쓴다.

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

export const BallStatusSchema = z.enum([
  "thrown",
  "wobbling",
  "caught",
  "escaped",
  "cancelled",
]);
export type BallStatus = z.infer<typeof BallStatusSchema>;

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
