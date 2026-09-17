# Official planning documents

The index contains a bounded recent selection from City Planning Commission, Preservation Board, TIF Commission, capital budget pages, and published County Planning Commission meetings. It is not a comprehensive inventory of projects, approvals, or municipalities. The existing reviewed notices at `/st-louis/planning/` are separate and preserved.

Refresh from the repository:

```
uv run --no-project python scripts/st-louis/fetch_property_planning_documents.py
```

`--cached` rebuilds the last successful observation without changing its retrieval date. Each fresh run reviews up to 12 recent landing pages per source, with two concurrent City detail requests. The County public calendar uses the endpoint disclosed by its ordinary portal JavaScript; only published Planning Commission records are selected. No login, challenge bypass or payment operation is involved.

Publication, meeting and explicit hearing dates are separate. Attachment publication times are not derived from the publication date of their landing page. Document titles supply dates only when unambiguous; two-digit years require corroboration. A meeting venue never becomes a project coordinate, and a publishing jurisdiction is not an affected project boundary.

Every indexed link has a metadata hash. Source pages and a rotating budget of up to eight attachment bodies / 32 MB per run receive content-addressed archive receipts under the local research directory. Individual attachments above 8 MB remain links. `metadataSha256` is not a document-content hash. `contentSha256` exists only after the body was acquired; `contentCheckedAt` and `contentCaptureStatus` distinguish old receipts from failed or deferred rechecks. Successive complete indexes are archived locally. Older records leaving the bounded discovery window remain in the index; absence from that window does not imply withdrawal.

The small public index contains metadata only, with no extracted owner, contact, payment, or personal-profile fields. Records remain unmapped and have no asserted parcel associations. Drafts, preliminary agendas, agendas, minutes, meeting packets and literally adopted capital-plan documents have distinct labels. These labels do not establish individual project approval, expenditure or completion.

`status.json` records each attempted refresh. A failed source/schema acquisition exits nonzero and retains the prior index, manifest and history input. The refresh pipeline must read that status separately; retained data are not a successful new observation. `history-input.json` carries source-identity observations with all parcel identity fields null. `complete` refers only to the bounded acquisition, not all public planning activity.
