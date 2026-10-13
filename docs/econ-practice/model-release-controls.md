# Calibration release controls

Candidate registration, scientific approval and release selection are distinct records. Migration 0010 and `model-releases.mjs` implement an append-only release decision history scoped to bank version, course and unit. A release references an immutable approval; a null approval withdraws calibrated use for future sessions. Restoring an earlier approval creates another revision rather than rewriting history.

Each write supplies the predecessor the instructor reviewed. Database triggers reject stale predecessors, skipped revisions and approval scope mismatches. The decision and audit event commit in one transaction. Identical retries return their original receipt even when newer decisions exist; they never restore an old state. Approval content is revalidated against its archived bank before a new non-null release decision is accepted.

Verification: six registry test groups pass, including concurrent identical requests, competing withdrawals, restoration, stale direct SQL writes, scope mismatches, immutable history and audit counts. The complete economics suite has 192 passing tests; bank audit has no errors or warnings.

Implementation boundary: this service is not yet exposed through an instructor route or connected to session creation. No real model has been released. Next: atomically select and pin releases when creating assessments, validate filtered calibrated-pool capacity before accepting sessions, add authenticated release/withdrawal controls and exercise the browser workflow. Existing session pins must remain immutable; legacy unpinned sessions stay provisional. A release is not evidence that a model is scientifically defensible: the independent review and calibration evidence gates remain mandatory.
