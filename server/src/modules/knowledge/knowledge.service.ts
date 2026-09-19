import { ERROR_CODES } from "@tutorial/shared";
import type {
  KnowledgeExportInput,
  KnowledgeExportOutput,
  KnowledgeReviewInput,
  KnowledgeReviewOutput,
  SearchSimilarInput,
  SearchSimilarOutput,
} from "@tutorial/shared";
import { execute, queryAll, queryOne } from "../../database.js";
import { badRequest } from "../../errors.js";
import { nowIso } from "../../util.js";
import { containsPii } from "./pii.js";

function currentTerm(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (month >= 3 && month <= 8) return `${year}-1`;
  if (month >= 9) return `${year}-2`;
  return `${year - 1}-2`;
}

/** 문자 3-gram Jaccard류 유사도 (짧은 쪽 기준 포함 비율). */
function similarityScore(query: string, candidate: string): number {
  const grams = (text: string) => {
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    const set = new Set<string>();
    for (let i = 0; i < normalized.length - 2; i += 1) {
      set.add(normalized.slice(i, i + 3));
    }
    return set;
  };
  const a = grams(query);
  const b = grams(candidate);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of a) if (b.has(gram)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

interface KnowledgeRow {
  id: string;
  question_title: string;
  answer_text: string;
  search_text: string;
  confirmed_by_nickname: string | null;
}

export async function searchSimilar(
  input: SearchSimilarInput,
): Promise<SearchSimilarOutput> {
  const rows = await queryAll<KnowledgeRow>(
    `SELECT k.id, k.question_title, k.answer_text, k.search_text,
            u.nickname AS confirmed_by_nickname
     FROM knowledge_entries k
     LEFT JOIN users u ON u.id = k.confirmed_by
     WHERE k.status = 'published' AND k.field_id = ?`,
    input.fieldId,
  );

  const items = rows
    .map((row) => ({
      row,
      score: similarityScore(input.text, row.search_text),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ row }) => ({
      knowledgeId: row.id,
      questionTitle: row.question_title,
      answerText: row.answer_text,
      confirmedBySeniorAlias: row.confirmed_by_nickname,
    }));

  return { items };
}

export async function reviewKnowledge(
  staffManagerId: string,
  input: KnowledgeReviewInput,
): Promise<KnowledgeReviewOutput> {
  const entry = await queryOne<{
    id: string;
    question_title: string;
    answer_text: string;
    status: string;
  }>(
    "SELECT id, question_title, answer_text, status FROM knowledge_entries WHERE id = ?",
    input.knowledgeId,
  );
  if (!entry) {
    throw badRequest("지식을 찾을 수 없어요", ERROR_CODES.notFound);
  }
  if (entry.status !== "draft") {
    throw badRequest("이미 처리된 지식이에요", ERROR_CODES.closed);
  }

  if (input.action === "reject") {
    await execute(
      "UPDATE knowledge_entries SET status = 'rejected', updated_at = ? WHERE id = ?",
      nowIso(),
      input.knowledgeId,
    );
    return { status: "rejected" };
  }

  const finalText = input.editedAnswerText ?? entry.answer_text;
  if (containsPii(finalText) || containsPii(entry.question_title)) {
    throw badRequest(
      "개인정보가 포함된 것 같아요. 수정 후 다시 확인해 주세요",
      ERROR_CODES.piiDetected,
    );
  }

  await execute(
    `UPDATE knowledge_entries
     SET status = 'published', answer_text = ?, pii_checked = 1, confirmed_by = ?,
         valid_until_term = ?, search_text = ?, updated_at = ?
     WHERE id = ?`,
    finalText,
    staffManagerId,
    currentTerm(),
    `${entry.question_title} ${finalText}`,
    nowIso(),
    input.knowledgeId,
  );
  return { status: "published" };
}

interface ExportRow {
  id: string;
  question_title: string;
  answer_text: string;
  field_id: string;
}

export async function exportKnowledge(
  input: KnowledgeExportInput,
): Promise<KnowledgeExportOutput> {
  const rows = input.since
    ? await queryAll<ExportRow>(
        `SELECT id, question_title, answer_text, field_id FROM knowledge_entries
         WHERE status = 'published' AND created_at >= ? ORDER BY created_at DESC`,
        input.since,
      )
    : await queryAll<ExportRow>(
        `SELECT id, question_title, answer_text, field_id FROM knowledge_entries
         WHERE status = 'published' ORDER BY created_at DESC`,
      );

  const markdown = rows
    .map(
      (row) =>
        `## ${row.question_title}\n\n${row.answer_text}\n\n_분야: ${row.field_id}_`,
    )
    .join("\n\n---\n\n");

  if (rows.length > 0) {
    await execute(
      `UPDATE knowledge_entries SET exported_at = ? WHERE id IN (${rows.map(() => "?").join(",")})`,
      nowIso(),
      ...rows.map((row) => row.id),
    );
  }

  return { markdown, count: rows.length };
}
