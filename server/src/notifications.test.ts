import assert from "node:assert/strict";
import test from "node:test";
import { applyQuietHours } from "./notifications.service.js";

// 08:00 KST is 23:00 UTC on the previous day.
const morningUtc = "T23:00:00.000Z";

test("non-urgent notifications inside quiet hours move to the next morning", () => {
  // 23:30 KST on 2026-09-19 is 14:30 UTC the same day.
  assert.equal(
    applyQuietHours("2026-09-19T14:30:00.000Z", false),
    `2026-09-19${morningUtc}`,
  );

  // 02:00 KST on 2026-09-20 is 17:00 UTC on 2026-09-19.
  assert.equal(
    applyQuietHours("2026-09-19T17:00:00.000Z", false),
    `2026-09-19${morningUtc}`,
  );
});

test("notifications outside quiet hours keep their due time", () => {
  // 12:00 KST is 03:00 UTC.
  const noon = "2026-09-19T03:00:00.000Z";
  assert.equal(applyQuietHours(noon, false), noon);

  // 22:59 KST is 13:59 UTC.
  const lateEvening = "2026-09-19T13:59:00.000Z";
  assert.equal(applyQuietHours(lateEvening, false), lateEvening);
});

test("urgent notifications ignore quiet hours", () => {
  const midnight = "2026-09-19T15:00:00.000Z";
  assert.equal(applyQuietHours(midnight, true), midnight);
});
