import {
  FunctionCallError,
  FunctionCallErrorCode,
} from "@channel.io/app-sdk-server";
import { getDatabase } from "./database.js";

interface UserRow {
  id: string;
  nickname: string;
}

// T1(계정 자동 생성·업그레이드 연결)이 아직 없다. 지금은 users를 채널톡 ID로
// 조회만 하고, 없으면 "아직 연결 안 됨"을 명확한 에러로 알린다. T1이 들어오면
// 이 두 함수의 내부 구현만 "없으면 자동 생성"으로 바뀌고, 호출부는 그대로다.

export async function getSeniorIdByManagerId(
  managerId: string,
): Promise<UserRow> {
  const row = await getDatabase()
    .prepare(
      "SELECT id, nickname FROM users WHERE channel_manager_id = ? AND is_senior = 1",
    )
    .bind(managerId)
    .first<UserRow>();
  if (!row) {
    throw new FunctionCallError(
      "선배 계정이 아직 연결되어 있지 않아요",
      FunctionCallErrorCode.BadRequest,
      { type: "SENIOR_NOT_LINKED" },
    );
  }
  return row;
}

export async function getJuniorIdByUserId(userId: string): Promise<UserRow> {
  const row = await getDatabase()
    .prepare("SELECT id, nickname FROM users WHERE channel_user_id = ?")
    .bind(userId)
    .first<UserRow>();
  if (!row) {
    throw new FunctionCallError(
      "후배 계정을 찾을 수 없어요",
      FunctionCallErrorCode.BadRequest,
      { type: "JUNIOR_NOT_FOUND" },
    );
  }
  return row;
}
