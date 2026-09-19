// 공개 지식(published)에 개인정보가 들어가지 않도록 막는 간단한 패턴 검사.
// 완벽한 탐지는 아니고, publish를 막는 1차 안전장치다.
const PII_PATTERNS = [
  /01[016789]-?\d{3,4}-?\d{4}/, // 휴대폰 번호
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // 이메일
  /\d{6}-?[1-4]\d{6}/, // 주민등록번호
  /\b20\d{2}\d{5,8}\b/, // 학번(대략)
];

export function containsPii(text: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(text));
}
