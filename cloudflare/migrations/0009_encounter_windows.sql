-- 후배가 제시한 가능한 시간대 (출현 1건에 여러 개).
CREATE TABLE encounter_windows (
  encounter_id TEXT NOT NULL REFERENCES encounters(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  CHECK (end_at > start_at)
);

CREATE INDEX idx_encounter_windows_encounter ON encounter_windows(encounter_id);
