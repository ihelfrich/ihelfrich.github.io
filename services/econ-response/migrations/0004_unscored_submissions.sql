-- Valid owned submissions rejected by scoring rules remain available for review.
CREATE TABLE unscored_submissions (
 ledger_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 receipt_id TEXT NOT NULL UNIQUE,
 participant_id TEXT NOT NULL REFERENCES participants(id),
 session_id TEXT NOT NULL REFERENCES sessions(id),
 presentation_id TEXT NOT NULL REFERENCES presentations(id),
 event_id TEXT NOT NULL,
 payload_sha256 TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(reason IN ('idempotency-conflict','attempt-sequence-conflict','assessment-answer-locked')),
 server_received_at TEXT NOT NULL,
 UNIQUE(participant_id,session_id,event_id,payload_sha256)
);
CREATE INDEX unscored_participant_ledger ON unscored_submissions(participant_id,ledger_sequence);
