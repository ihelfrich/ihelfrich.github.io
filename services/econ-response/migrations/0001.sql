PRAGMA foreign_keys = ON;
CREATE TABLE participants (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL,
 identity_kind TEXT NOT NULL CHECK(identity_kind IN ('anonymous','account')),
 identity_subject_hash TEXT UNIQUE,
 consent_version TEXT NOT NULL,
 consent_at TEXT NOT NULL,
 disabled_at TEXT
);
CREATE TABLE sessions (
 id TEXT PRIMARY KEY,
 participant_id TEXT NOT NULL REFERENCES participants(id),
 course TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('practice','assessment')),
 bank_version TEXT NOT NULL,
 started_at TEXT NOT NULL,
 completed_at TEXT,
 token_hash TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE TABLE presentations (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL REFERENCES sessions(id),
 item_id TEXT NOT NULL,
 item_version TEXT NOT NULL,
 family_id TEXT NOT NULL,
 topic TEXT NOT NULL,
 unit INTEGER NOT NULL,
 presented_at TEXT NOT NULL,
 selection_probability REAL NOT NULL CHECK(selection_probability > 0 AND selection_probability <= 1),
 selection_pool_size INTEGER NOT NULL,
 selection_engine_version TEXT NOT NULL,
 model_version TEXT NOT NULL,
 first_family_exposure INTEGER NOT NULL CHECK(first_family_exposure IN (0,1)),
 item_snapshot_json TEXT NOT NULL
);
CREATE TABLE responses (
 ledger_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id TEXT NOT NULL UNIQUE,
 presentation_id TEXT NOT NULL REFERENCES presentations(id),
 session_id TEXT NOT NULL REFERENCES sessions(id),
 participant_id TEXT NOT NULL REFERENCES participants(id),
 attempt_number INTEGER NOT NULL CHECK(attempt_number >= 1),
 raw_answer_json TEXT NOT NULL,
 correct INTEGER NOT NULL CHECK(correct IN (0,1)),
 score REAL NOT NULL,
 client_submitted_at TEXT NOT NULL,
 server_received_at TEXT NOT NULL,
 elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms >= 0),
 active_ms INTEGER NOT NULL CHECK(active_ms >= 0),
 hints_used INTEGER NOT NULL CHECK(hints_used >= 0),
 feedback_before_answer INTEGER NOT NULL CHECK(feedback_before_answer IN (0,1)),
 validity TEXT NOT NULL,
 calibration_eligible INTEGER NOT NULL CHECK(calibration_eligible IN (0,1)),
 payload_sha256 TEXT NOT NULL,
 UNIQUE(presentation_id,attempt_number)
);
CREATE INDEX response_participant_time ON responses(participant_id,server_received_at,event_id);
CREATE INDEX response_session ON responses(session_id,event_id);
CREATE INDEX presentation_family ON presentations(family_id,session_id);
CREATE INDEX session_participant ON sessions(participant_id,started_at);
CREATE TABLE calibrations (
 id TEXT PRIMARY KEY,
 bank_version TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('candidate','rejected','approved','retired')),
 model_type TEXT NOT NULL,
 created_at TEXT NOT NULL,
 approved_at TEXT,
 approved_by TEXT,
 data_cutoff TEXT NOT NULL,
 data_sha256 TEXT NOT NULL,
 diagnostics_json TEXT NOT NULL,
 parameters_json TEXT NOT NULL
);
CREATE TABLE audit_log (
 id TEXT PRIMARY KEY,
 at TEXT NOT NULL,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 target TEXT NOT NULL,
 details_json TEXT NOT NULL
);
ALTER TABLE participants ADD COLUMN credential_hash TEXT;
ALTER TABLE sessions ADD COLUMN assigned INTEGER NOT NULL DEFAULT 0 CHECK(assigned IN (0,1));
ALTER TABLE sessions ADD COLUMN unit_filter INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN topic_filter TEXT NOT NULL DEFAULT '';
ALTER TABLE presentations ADD COLUMN sequence INTEGER NOT NULL DEFAULT 1;
ALTER TABLE presentations ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX presentation_sequence ON presentations(session_id,sequence);
