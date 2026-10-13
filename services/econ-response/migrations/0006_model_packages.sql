CREATE TABLE model_packages (
 id TEXT PRIMARY KEY,
 bank_version TEXT NOT NULL REFERENCES bank_versions(version),
 course TEXT NOT NULL,
 unit INTEGER NOT NULL,
 model TEXT NOT NULL CHECK(model IN ('1PL','2PL')),
 artifact_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 created_by TEXT NOT NULL
);
CREATE TRIGGER model_package_immutable BEFORE UPDATE ON model_packages BEGIN SELECT RAISE(ABORT,'Model packages are immutable'); END;
