# Property notebook

The property workspace brings parcel research, source-linked records, organization connections, planning documents and financial scenarios together. Its public interface describes these functions without prescribing a research conclusion.

Entry: `/st-louis/?area=overland&workspace=notebook`. The existing `purpose=resident` query opens the same workspace and is normalized to the new route. Its notebook schema remains compatible with saved backups. Select an exact parcel in Evidence, open its notebook and add it to the browser watchlist. The parcel baseline and pro formas remain available.

## Implemented

- Local parcel cases with dated public records and explicitly unverified leads.
- Searchable saved properties, record-type filtering, and direct actions to find a parcel, select an area or open its pro forma. A persistent selected-property bar keeps the current parcel visible while using the expandable workspace.
- Public organization names, exact jurisdiction-qualified registration IDs, registry sources and separately cited affiliation claims. Matching names or registered agents do not create ownership links.
- Organization connections across the latest dated, source-linked, non-superseded acquisition entries for each watched parcel. Same-date conflicting IDs, missing IDs and future-dated records do not produce connections. These are notebook observations, not verified current holdings or neighborhood market shares.
- Corrections append a new record and retain the earlier version as superseded. Both remain in evidence exports.
- Portable JSON backup/import, explicit replacement review, and a printable HTML evidence brief. Browser data is not sent to a server or published. Failed persistence leaves the prior notebook intact.
- Rent scenarios from the current calculated pro forma: changes the proposed monthly rent, holds all other assumptions fixed, and reports NOI, cash after scheduled debt, NPV, the nonnegative time-zero contribution required to bring NPV to zero, and the worst annual operating cash flow. This contribution does not resize debt, establish financing eligibility, or guarantee annual liquidity. An entered rent target is not a household affordability determination.
- A dated, manually reviewed selection of Overland planning documents, including the September 29, 2026 meeting cancellation. No recurring monitoring or automatic alerts are configured.

## Evidence available and gaps

The historical County parcel snapshot does **not** include buyer identities, deed histories or individual sale prices. Its sales-count fields cannot establish acquisition prices or common control. Current ownership coverage, transaction-level price comparisons and a complete acquisition feed have not been established by this change.

A source-linked user entry is a claim with a citation, not an automatic verification of that claim. Even a deed requires review of instrument type, property identity, parties, transaction terms, dates and nominal/multi-property consideration. Assessments are not sale prices. Corporate registrations identify legal entities but may not establish beneficial ownership or parent control. A development agenda does not establish approval, issuance of a permit, an acquisition or a completed change in use.

For a defensible acquisition-price comparison, the next data need is verified transaction-level evidence plus comparables with dates, condition, size and transaction terms. Further analysis must distinguish advertised rent from executed rent, assessment changes from actual tax liabilities, and development proposals from completed changes. The notebook does not infer causation from those records.

## Primary sources checked September 11, 2026

- [County property search](https://revenue.stlouisco.com/IAS/SearchInput.aspx): HTTP 200 on this review. The County Recorder website returned HTTP 403 from the research environment; no deed data were obtained from it.
- [Missouri Secretary of State corporations](https://www.sos.mo.gov/business/corporations): official starting point for entity filings and business search.
- [Overland Agenda Center](https://www.overlandmo.org/AgendaCenter): observed links were followed to the documents below.
- [September 29 meeting entry](https://www.overlandmo.org/AgendaCenter/ViewFile/Agenda/_09292026-879): the linked PDF is a September 3 memorandum cancelling that meeting for lack of an agenda. Its first page was rendered and visually checked.
- [August 25 amended agenda](https://www.overlandmo.org/AgendaCenter/ViewFile/Agenda/_08252026-873): hearings listed for 9509 Lackland Road and 2554 Woodson Road. Outcomes were not established by this document.
- [July 28 minutes](https://www.overlandmo.org/AgendaCenter/ViewFile/Minutes/_07282026-865): the 9025 Page Avenue item concerns a replacement dumpster enclosure/tire shed and records approval with stipulations. It does not establish a property transfer or residential conversion.

Tests cover missing/unsafe sources, affiliation evidence, exact-ID grouping, unresolved and future transactions, corrections, portable import boundaries, storage failure, rendering escapes and rent-scenario mathematics. The initial dataset has zero acquisition records connected: unknown coverage must not be presented as zero acquisitions in the neighborhood. Internal module names, storage keys and schema identifiers are unchanged for compatibility with existing notebooks.
