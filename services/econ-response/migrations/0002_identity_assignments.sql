CREATE TABLE credentials (
 token_hash TEXT PRIMARY KEY,
 participant_id TEXT NOT NULL REFERENCES participants(id),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 revoked_at TEXT
);
CREATE INDEX credentials_participant ON credentials(participant_id);
INSERT INTO credentials SELECT credential_hash,id,created_at,strftime('%Y-%m-%dT%H:%M:%fZ',created_at,'+180 days'),NULL FROM participants WHERE credential_hash IS NOT NULL;
UPDATE participants SET credential_hash=NULL;
ALTER TABLE participants ADD COLUMN verified_email TEXT;
CREATE TABLE auth_challenges (
 id TEXT PRIMARY KEY,
 participant_id TEXT NOT NULL REFERENCES participants(id),
 nonce TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 consumed_at TEXT
);
CREATE TABLE assignments (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 course TEXT NOT NULL,
 bank_version TEXT NOT NULL,
 unit_filter INTEGER NOT NULL DEFAULT 0,
 topic_filter TEXT NOT NULL DEFAULT '',
 item_count INTEGER NOT NULL CHECK(item_count BETWEEN 6 AND 48),
 max_attempts INTEGER NOT NULL CHECK(max_attempts BETWEEN 1 AND 10),
 opens_at TEXT NOT NULL,
 closes_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 created_by TEXT NOT NULL,
 disabled_at TEXT
);
CREATE TABLE assignment_members (
 assignment_id TEXT NOT NULL REFERENCES assignments(id),
 participant_id TEXT NOT NULL REFERENCES participants(id),
 PRIMARY KEY(assignment_id,participant_id)
);
ALTER TABLE sessions ADD COLUMN assignment_id TEXT REFERENCES assignments(id);
ALTER TABLE sessions ADD COLUMN assignment_attempt INTEGER;
ALTER TABLE sessions ADD COLUMN target_count INTEGER NOT NULL DEFAULT 36;
CREATE UNIQUE INDEX assignment_attempt ON sessions(assignment_id,participant_id,assignment_attempt);
