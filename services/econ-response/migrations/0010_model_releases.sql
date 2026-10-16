-- Append-only, scope-specific release history. NULL approval explicitly withdraws
-- calibrated use for future sessions; existing immutable session pins survive.
CREATE TABLE model_releases (
 id TEXT PRIMARY KEY,
 bank_version TEXT NOT NULL REFERENCES bank_versions(version),
 course TEXT NOT NULL,
 unit INTEGER NOT NULL CHECK(unit BETWEEN 1 AND 6),
 approval_id TEXT REFERENCES model_approvals(id),
 previous_id TEXT REFERENCES model_releases(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 released_at TEXT NOT NULL,
 released_by TEXT NOT NULL,
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 1 AND 2000),
 UNIQUE(bank_version,course,unit,revision)
);
CREATE TRIGGER model_release_scope BEFORE INSERT ON model_releases
WHEN NEW.approval_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM model_approvals a JOIN model_packages p ON p.id=a.package_id
 WHERE a.id=NEW.approval_id AND p.bank_version=NEW.bank_version AND p.course=NEW.course AND p.unit=NEW.unit
)
BEGIN SELECT RAISE(ABORT,'Release approval scope mismatch'); END;
CREATE TRIGGER model_release_predecessor BEFORE INSERT ON model_releases
WHEN NEW.previous_id IS NOT (SELECT id FROM model_releases WHERE bank_version=NEW.bank_version AND course=NEW.course AND unit=NEW.unit ORDER BY revision DESC LIMIT 1)
 OR NEW.revision != COALESCE((SELECT MAX(revision)+1 FROM model_releases WHERE bank_version=NEW.bank_version AND course=NEW.course AND unit=NEW.unit),1)
BEGIN SELECT RAISE(ABORT,'Release changed; reload before retrying'); END;
CREATE TRIGGER model_release_immutable BEFORE UPDATE ON model_releases BEGIN SELECT RAISE(ABORT,'Model releases are immutable'); END;
CREATE TRIGGER model_release_no_delete BEFORE DELETE ON model_releases BEGIN SELECT RAISE(ABORT,'Model release history is retained'); END;
