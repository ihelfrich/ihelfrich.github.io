CREATE TABLE hint_events (
 ledger_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 presentation_id TEXT NOT NULL REFERENCES presentations(id),
 hint_version TEXT NOT NULL,
 hint_scope TEXT NOT NULL,
 hint_text TEXT NOT NULL,
 server_received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX hint_events_presentation ON hint_events(presentation_id,ledger_sequence);
CREATE TRIGGER hint_event_count AFTER INSERT ON hint_events
BEGIN
 UPDATE presentations SET hints_used=hints_used+1 WHERE id=NEW.presentation_id;
END;
CREATE TRIGGER hint_events_immutable BEFORE UPDATE ON hint_events
BEGIN SELECT RAISE(ABORT,'Hint events are immutable'); END;
