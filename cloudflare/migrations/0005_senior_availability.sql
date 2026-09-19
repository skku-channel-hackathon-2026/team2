-- Senior availability: pause window, status note, and the weekday lookup index
-- the "who is free at this time" search runs on.

ALTER TABLE senior_profiles ADD COLUMN paused_until TEXT;
ALTER TABLE senior_profiles ADD COLUMN status_note TEXT;
ALTER TABLE senior_profiles ADD COLUMN availability_updated_at TEXT;

CREATE INDEX idx_senior_slots_lookup
  ON senior_slots(weekday, start_minute, end_minute);
