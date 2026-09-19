-- 선배 1명 × 출현 1건 = 볼 1개.
CREATE TABLE balls (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL REFERENCES encounters(id),
  senior_id    TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('thrown','wobbling','caught','escaped','cancelled')),
  thrown_at TEXT NOT NULL,
  met_confirmed_at TEXT,
  caught_at TEXT,
  reminders_sent INTEGER NOT NULL DEFAULT 0 CHECK (reminders_sent BETWEEN 0 AND 2),
  UNIQUE (encounter_id, senior_id),
  CHECK (status NOT IN ('wobbling','caught') OR met_confirmed_at IS NOT NULL),
  CHECK ((status = 'caught') = (caught_at IS NOT NULL))
);

CREATE INDEX idx_balls_senior ON balls(senior_id, status);
CREATE INDEX idx_balls_encounter ON balls(encounter_id, status);
