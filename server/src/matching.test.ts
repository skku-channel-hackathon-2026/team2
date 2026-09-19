import assert from "node:assert/strict";
import test from "node:test";
import { overlapMinutes } from "./modules/matching/matching.service.js";

// KST(UTC+9) 기준 2026-09-21은 월요일(weekday 0).
test("overlaps a window against a same-weekday slot", () => {
  const minutes = overlapMinutes(
    { startAt: "2026-09-21T03:00:00.000Z", endAt: "2026-09-21T05:00:00.000Z" }, // KST 12:00-14:00
    { weekday: 0, start_minute: 13 * 60, end_minute: 15 * 60 }, // KST 13:00-15:00
  );
  assert.equal(minutes, 60);
});

test("returns 0 for a different weekday", () => {
  const minutes = overlapMinutes(
    { startAt: "2026-09-21T03:00:00.000Z", endAt: "2026-09-21T05:00:00.000Z" },
    { weekday: 1, start_minute: 0, end_minute: 24 * 60 },
  );
  assert.equal(minutes, 0);
});

test("returns 0 when the ranges do not touch", () => {
  const minutes = overlapMinutes(
    { startAt: "2026-09-21T03:00:00.000Z", endAt: "2026-09-21T04:00:00.000Z" }, // KST 12:00-13:00
    { weekday: 0, start_minute: 14 * 60, end_minute: 15 * 60 }, // KST 14:00-15:00
  );
  assert.equal(minutes, 0);
});
