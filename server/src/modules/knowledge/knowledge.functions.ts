import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  KNOWLEDGE_FUNCTIONS,
  KnowledgeExportInputSchema,
  KnowledgeExportOutputSchema,
  KnowledgeReviewInputSchema,
  KnowledgeReviewOutputSchema,
  SearchSimilarInputSchema,
  SearchSimilarOutputSchema,
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
import { AccountsService } from "../../accounts.service.js";
import {
  exportKnowledge,
  reviewKnowledge,
  searchSimilar,
} from "./knowledge.service.js";

@Injectable()
export class KnowledgeFunctions {
  constructor(private readonly accounts: AccountsService) {}

  @Func(KNOWLEDGE_FUNCTIONS.searchSimilar)
  @Description("비슷한 질문의 지식을 찾는다")
  @InputSchema(SearchSimilarInputSchema)
  @OutputSchema(SearchSimilarOutputSchema)
  async searchSimilar(
    @Input() input: z.infer<typeof SearchSimilarInputSchema>,
  ): Promise<z.infer<typeof SearchSimilarOutputSchema>> {
    return searchSimilar(input);
  }

  @Func(KNOWLEDGE_FUNCTIONS.review)
  @Description("지식 초안을 승인/반려한다 (운영진)")
  @InputSchema(KnowledgeReviewInputSchema)
  @OutputSchema(KnowledgeReviewOutputSchema)
  async review(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof KnowledgeReviewInputSchema>,
  ): Promise<z.infer<typeof KnowledgeReviewOutputSchema>> {
    const staffId = await this.accounts.requireStaff(ctx);
    return reviewKnowledge(staffId, input);
  }

  @Func(KNOWLEDGE_FUNCTIONS.export)
  @Description("공개된 지식을 마크다운으로 내보낸다 (운영진)")
  @InputSchema(KnowledgeExportInputSchema)
  @OutputSchema(KnowledgeExportOutputSchema)
  async export(
    @Ctx() ctx: Context,
    @Input() input: z.infer<typeof KnowledgeExportInputSchema>,
  ): Promise<z.infer<typeof KnowledgeExportOutputSchema>> {
    await this.accounts.requireStaff(ctx);
    return exportKnowledge(input);
  }
}
