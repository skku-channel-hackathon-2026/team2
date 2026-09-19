import assert from "node:assert/strict";
import test from "node:test";
import {
  isAvailableNow,
  mergeSlots,
  totalMinutes,
} from "./availability.service.js";

const slot = (weekday: number, startMinute: number, endMinute: number) => ({
  weekday,
  startMinute,
  endMinute,
});

test("hourly grid cells collapse into one contiguous block", () => {
  const merged = mergeSlots([
    slot(1, 720, 780),
    slot(1, 780, 840),
    slot(1, 840, 900),
  ]);
  assert.deepEqual(merged, [slot(1, 720, 900)]);
});

test("overlapping and unsorted input merges deterministically", () => {
  const merged = mergeSlots([
    slot(3, 1080, 1140),
    slot(1, 750, 900),
    slot(1, 720, 780),
  ]);
  assert.deepEqual(merged, [slot(1, 720, 900), slot(3, 1080, 1140)]);
});

test("a gap between blocks is preserved", () => {
  const merged = mergeSlots([slot(2, 660, 720), slot(2, 1020, 1080)]);
  assert.equal(merged.length, 2);
});

test("blocks never merge across weekdays", () => {
  const merged = mergeSlots([slot(1, 720, 780), slot(2, 720, 780)]);
  assert.deepEqual(merged, [slot(1, 720, 780), slot(2, 720, 780)]);
});

test("empty and zero-length ranges are dropped", () => {
  assert.deepEqual(mergeSlots([]), []);
  assert.deepEqual(mergeSlots([slot(1, 720, 720)]), []);
});

test("too many distinct blocks are rejected", () => {
  const many = Array.from({ length: 50 }, (_, index) =>
    slot(index % 7, index * 20, index * 20 + 10),
  );
  assert.throws(() => mergeSlots(many), /최대/);
});

test("total minutes counts merged blocks once", () => {
  const merged = mergeSlots([slot(1, 720, 840), slot(1, 780, 900)]);
  assert.equal(totalMinutes(merged), 180);
});

test("a pause whose end date has passed reads as available", () => {
  const now = Date.parse("2026-09-19T00:00:00.000Z");
  assert.equal(isAvailableNow("active", null, now), true);
  assert.equal(isAvailableNow("paused", null, now), false);
  assert.equal(isAvailableNow("paused", "2026-09-30", now), false);
  assert.equal(isAvailableNow("paused", "2026-09-01", now), true);
  assert.equal(isAvailableNow("paused", "not-a-date", now), false);
});
