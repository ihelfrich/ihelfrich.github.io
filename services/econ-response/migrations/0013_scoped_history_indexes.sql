-- Preserve the immutable ledger; these indexes support scoped occasion/course replay.
CREATE INDEX response_participant_session_ledger ON responses(participant_id,session_id,ledger_sequence);
CREATE INDEX session_course ON sessions(course,id);
