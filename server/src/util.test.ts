import assert from "node:assert/strict";
import test from "node:test";
import { hashLinkCode, newLinkCode, normalizeCode, safeEqual } from "./util.js";

test("link codes avoid characters that are easily misread", () => {
  for (let index = 0; index < 200; index += 1) {
    const code = newLinkCode();
    assert.equal(code.length, 6);
    assert.doesNotMatch(code, /[IO01]/);
    assert.match(code, /^[A-Z2-9]+$/);
  }
});

test("code hashing is stable across formatting and keyed by the app secret", () => {
  const code = newLinkCode();
  const hash = hashLinkCode(code, "secret");

  assert.equal(
    hashLinkCode(normalizeCode(` ${code.toLowerCase()} `), "secret"),
    hash,
  );
  assert.notEqual(hashLinkCode(code, "other-secret"), hash);
  assert.ok(!hash.includes(code));
});

test("safeEqual rejects different lengths without throwing", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("abc", "abd"), false);
});
