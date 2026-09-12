# Refresh the public county tax evidence snapshots

These are dated evidence snapshots, not live browser fetches. The current GIS tax-roll year, historical assessment years, and billed tax year are separate vintages.

## Actual tax bills: public browser acquisition

1. Open the official county link `https://taxpayments.stlouiscountymo.gov/parcel/view/<parcelId>` using ordinary browser navigation. This URL pattern is exposed by the county legacy assessment portal's Tax Info & Receipt links. Let the page select its latest available year; record the final URL and the visibly selected tax year. Do not force the GIS tax-roll year into the tax URL.
2. Confirm the parcel ID displayed by the page matches the intended record exactly. Read **only the visible Current Year billing table** for that selected year. The page also contains hidden all-year tables in its DOM; unscoped text or table extraction can mix those historical charges into the current record. Capture **Tax Billed**, **Cost Billed**, **Penalty Billed**, **Interest Billed**, and **Total Billed**, preserving their separate meanings. If multiple billing sections appear, preserve their distinctions in the research evidence and review the annual total before publication. Never infer the annual charge from a payment, outstanding balance, or assessed-value calculation.
3. Record the page's data-updated label, retrieval date, and tax district. Preserve the update timestamp as displayed; if the page does not state its timezone, do not assign one. Only add assessed value and taxing-authority rows if those fields were separately reviewed; do not backfill them from the current GIS year. Do not retain owner names, mailing addresses, contacts, payment transactions, amounts paid, or unpaid/delinquency status in the public snapshot.
4. Write each reviewed record to `public/st-louis/county-bills/index.json` with schema `county-tax-bills-v1`, keyed by exact parcel ID. Its source method must state **Public browser page review**. Preserve the final official source URL and the retrieved tax year on every record. Set `amountKind` to `annual-property-tax` only for an actual annual Tax Billed amount.
5. Check that **tax + other fees + penalty + interest = total billed** to the cent, investigate any difference, and keep authority extensions distinct from fee lines. The annual property-tax amount is Tax Billed, even when other fields make the total billed larger. A missing record remains missing; do not create a zero bill or a proxy from the tax rate.
6. State the actual number of reviewed properties and retrieval date in source metadata. A bounded Page Avenue or Overland sample is not county-wide coverage.

Ordinary shell requests returned HTTP 403 challenges during the September 12, 2026 review while ordinary browser navigation worked. Do not extract/replay browser cookies, bypass a challenge, or describe browser-reviewed data as an automated HTTP API feed. Stop at authentication, human-verification, or payment actions. No payment action is needed to read a bill.

### Import a reviewed batch

The importer accepts an already reviewed JSON batch with `taxYear`, `sourceUpdatedLabel`, `fields`, `rows`, and `unavailable`. Column order is exactly `parcelId, amountUSD, otherFeesUSD, totalBilledUSD, penaltyUSD, interestUSD, district`. Unavailable entries identify the exact parcel, year, and source-visible reason. The importer performs no network acquisition: it validates parcel membership against the current county study index, duplicate identities, field types, and cent-level reconciliation, then writes the public allowlist with the actual import/retrieval timestamp.

```sh
node scripts/import-county-tax-bills.mjs path/to/reviewed-browser-batch.json
node --test tests/unit/city-county-bills-data.test.mjs tests/unit/city-county-assessment-history-data.test.mjs
```

The September 12, 2026 batch contains 68 reviewed parcels, 67 published 2025 bills, and one explicit unavailable 2025 record (`16K610558`). Its source label is `Data updated: 2026-09-12 12:15:01`, with timezone unspecified. The immutable reviewed input is retained at `tests/fixtures/county-bills-browser-review-2026-09-12.json` so tests verify the public output against the actual acquired evidence. No authority or assessed-value fields were acquired in this batch.

## Assessment histories: public locator form

Start at `https://revenue.stlouisco.com/RealEstate/SearchInput.aspx`, choose locator search, and open the exact parcel's Assessment view. Record its information-current-as-of label and each published appraised and assessed annual total. The September 2026 review found eleven years (2016–2026) for four nearby properties.

The direct `AsmtInfo.aspx?Locator=<parcelId>` URL alone may return an empty template in a fresh session; the search form sequence supplies the required state. The legacy response did not grant cross-origin reads to `https://ihelfrich.github.io`. A public static snapshot and an official source button are therefore distinct from a live in-page API request.

Use schema `county-assessment-history-v1` in `public/st-louis/county-assessment-history/index.json`. Keep the county's published assessed totals exactly, including its rounding. Do not regenerate them by multiplying appraised values by 19 percent. Each published record contains only parcel identity, source metadata, and annual appraised/assessed totals.

## Rate estimates are a separate reference

The county public file directory is `https://revenue.stlouisco.com/pdfs/`. Its 2025 Rate Book contains full district rates; the separate city levy is only a component. The 2025 billing assessment ZIP also includes `taxrate.txt`, documented as a district/authority/class rate table. Its assessment file is used to calculate billing; the archive name does not turn an assessment value into an actual charge.

Join rates using the **tax district** and property class. GIS `TAXCODE=A` means taxable, whereas the reviewed parcels' district is `127CH`. Keep rate year explicit. A 2026 assessment multiplied by a 2025 rate is an estimate even if it happens to match a prior actual bill. Keep flat fees outside the ad valorem rate.

## Verification

Run the snapshot tests and the property-tax evidence adapter tests after a refresh. Update expected source-year totals only after reading the changed official source; don't alter them just to make a test pass. Source URLs must identify the same parcel as the map record. Display the tax bill's own year, source date, and any fees separately from current assessment information.
