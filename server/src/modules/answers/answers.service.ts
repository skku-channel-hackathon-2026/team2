import type { AnswerCard, AnswersListOutput } from "@tutorial/shared";
import { queryAll } from "../../database.js";

interface AnswerRow {
  encounter_id: string;
  title: string;
  field_label: string | null;
  field_id: string;
  junior_nickname: string;
  share_consent: number;
  rating: number;
  review_text: string;
  self_answer: string | null;
  created_at: string;
}

export async function listAnswers(
  seniorId: string,
): Promise<AnswersListOutput> {
  const rows = await queryAll<AnswerRow>(
    `SELECT e.id AS encounter_id, e.title, e.field_id, f.label AS field_label,
            u.nickname AS junior_nickname, r.share_consent,
            r.rating, r.review_text, r.self_answer, r.created_at
     FROM balls b
     JOIN encounters e ON e.id = b.encounter_id
     JOIN reviews r ON r.encounter_id = e.id
     JOIN users u ON u.id = e.junior_id
     LEFT JOIN fields f ON f.id = e.field_id
     WHERE b.senior_id = ?
     ORDER BY r.created_at DESC`,
    seniorId,
  );

  // 공유에 동의하지 않은 새내기의 별명은 선배에게도 노출하지 않는다 (T5 규칙).
  const items: AnswerCard[] = rows.map((row) => ({
    encounterId: row.encounter_id,
    title: row.title,
    fieldLabel: row.field_label ?? row.field_id,
    juniorAlias: row.share_consent === 1 ? row.junior_nickname : "익명 새내기",
    rating: row.rating,
    reviewText: row.review_text,
    selfAnswer: row.self_answer,
    createdAt: row.created_at,
  }));

  return { items };
}
