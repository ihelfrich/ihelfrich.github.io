CREATE TABLE bank_versions (
 version TEXT PRIMARY KEY,
 manifest_json TEXT NOT NULL,
 manifest_sha256 TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE bank_chunks (
 version TEXT NOT NULL REFERENCES bank_versions(version),
 course TEXT NOT NULL,
 unit INTEGER NOT NULL,
 items_json TEXT NOT NULL,
 PRIMARY KEY(version,course,unit)
);
CREATE TRIGGER bank_version_immutable BEFORE UPDATE ON bank_versions BEGIN SELECT RAISE(ABORT,'Bank versions are immutable'); END;
CREATE TRIGGER bank_chunk_immutable BEFORE UPDATE ON bank_chunks BEGIN SELECT RAISE(ABORT,'Bank chunks are immutable'); END;
