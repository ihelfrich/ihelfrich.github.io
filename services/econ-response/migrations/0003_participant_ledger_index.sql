-- Support participant-owned keyset exports, bounded replay and MAX(sequence).
-- The earlier participant/time index cannot satisfy ledger ordering directly.
CREATE INDEX response_participant_ledger ON responses(participant_id, ledger_sequence);
