import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoAfter(milliseconds: number): string {
  return new Date(Date.now() + milliseconds).toISOString();
}

export function isPast(iso: string | null | undefined): boolean {
  if (!iso) return true;
  const parsed = Date.parse(iso);
  return !Number.isFinite(parsed) || parsed <= Date.now();
}

/** Excludes characters that are easily confused when read aloud or retyped. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newLinkCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

const CODE_DOMAIN = "hubaego-link-code\0";

/** Codes are stored only as a keyed digest, never in plaintext. */
export function hashLinkCode(code: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(CODE_DOMAIN)
    .update(code.trim().toUpperCase())
    .digest("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}
