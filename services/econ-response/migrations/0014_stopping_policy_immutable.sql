CREATE TRIGGER session_stopping_policy_immutable BEFORE UPDATE OF stopping_policy_json ON sessions
WHEN OLD.stopping_policy_json IS NOT NULL AND NEW.stopping_policy_json IS NOT OLD.stopping_policy_json
BEGIN SELECT RAISE(ABORT,'Session stopping policy is immutable'); END;
