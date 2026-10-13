-- Approval is distinct from candidate registration. Existing sessions remain provisional.
CREATE TABLE model_approvals (
 id TEXT PRIMARY KEY,
 package_id TEXT NOT NULL REFERENCES model_packages(id),
 approved_at TEXT NOT NULL,
 approved_by TEXT NOT NULL,
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 1 AND 2000)
);
CREATE TRIGGER model_approval_immutable BEFORE UPDATE ON model_approvals BEGIN SELECT RAISE(ABORT,'Model approvals are immutable'); END;
CREATE TRIGGER model_approval_no_delete BEFORE DELETE ON model_approvals BEGIN SELECT RAISE(ABORT,'Model approvals are retained'); END;

-- One row per session seals the complete map, including an explicitly empty map.
-- No row is interpreted as legacy provisional, never as permission to load latest models.
CREATE TABLE session_model_pins (
 session_id TEXT PRIMARY KEY REFERENCES sessions(id),
 bank_version TEXT NOT NULL REFERENCES bank_versions(version),
 course TEXT NOT NULL,
 approvals_json TEXT NOT NULL CHECK(json_valid(approvals_json) AND json_type(approvals_json)='object'),
 pinned_at TEXT NOT NULL
);
CREATE TRIGGER session_model_pin_scope BEFORE INSERT ON session_model_pins
WHEN NOT EXISTS(SELECT 1 FROM sessions WHERE id=NEW.session_id AND bank_version=NEW.bank_version AND course=NEW.course)
BEGIN SELECT RAISE(ABORT,'Session model scope mismatch'); END;
CREATE TRIGGER session_model_pin_approval BEFORE INSERT ON session_model_pins
WHEN EXISTS(
 SELECT 1 FROM json_each(NEW.approvals_json) entry
 WHERE entry.type!='text' OR NOT EXISTS(
  SELECT 1 FROM model_approvals approval JOIN model_packages package ON package.id=approval.package_id
  WHERE approval.id=entry.value AND package.bank_version=NEW.bank_version AND package.course=NEW.course
    AND CAST(package.unit AS TEXT)=entry.key
 )
)
BEGIN SELECT RAISE(ABORT,'Session model approval mismatch'); END;
CREATE TRIGGER session_model_pin_immutable BEFORE UPDATE ON session_model_pins BEGIN SELECT RAISE(ABORT,'Session model pins are immutable'); END;
CREATE TRIGGER session_model_pin_no_delete BEFORE DELETE ON session_model_pins BEGIN SELECT RAISE(ABORT,'Session model pins are retained'); END;
CREATE TRIGGER session_model_pin_before_presentation BEFORE INSERT ON session_model_pins
WHEN EXISTS(SELECT 1 FROM presentations WHERE session_id=NEW.session_id)
BEGIN SELECT RAISE(ABORT,'Session models must be pinned before presentation'); END;
CREATE TRIGGER session_model_pin_unique_units BEFORE INSERT ON session_model_pins
WHEN (SELECT COUNT(*) FROM json_each(NEW.approvals_json)) != (SELECT COUNT(DISTINCT key) FROM json_each(NEW.approvals_json))
BEGIN SELECT RAISE(ABORT,'Duplicate model unit'); END;
