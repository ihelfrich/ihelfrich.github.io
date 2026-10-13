ALTER TABLE sessions ADD COLUMN stopping_policy_json TEXT CHECK (stopping_policy_json IS NULL OR json_valid(stopping_policy_json));
ALTER TABLE sessions ADD COLUMN terminal_reason TEXT;
ALTER TABLE assignments ADD COLUMN stopping_policy TEXT NOT NULL DEFAULT 'fixed' CHECK (stopping_policy IN ('fixed','unit-precision'));
