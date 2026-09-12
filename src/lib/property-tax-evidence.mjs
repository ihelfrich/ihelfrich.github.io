/** A fetched annual base bill is a candidate input, never an automatic forecast. */
export function normalizeTaxEvidence(bill, property) {
  if (!bill || bill.status !== 'matched' || bill.amountKind !== 'annual-property-tax') throw new RangeError('An exact annual property-tax bill is required. Balances, payments and penalties cannot supply annual taxes.');
  for (const key of ['recordKey', 'parcelId', 'jurisdiction']) {
    if (typeof bill[key] !== 'string' || !bill[key].trim() || bill[key].length > 500 || bill[key] !== property?.[key]) throw new RangeError('The tax bill does not match the linked property.');
  }
  if (!Number.isInteger(bill.taxYear) || bill.taxYear < 1900 || bill.taxYear > 2100) throw new RangeError('The annual tax bill needs a valid tax year.');
  if (typeof bill.amountUSD !== 'number' || !Number.isFinite(bill.amountUSD) || bill.amountUSD < 0 || bill.amountUSD > 1e9) throw new RangeError('The annual tax bill needs a finite, nonnegative amount within model bounds.');
  let url;
  try {url = new URL(bill.sourceUrl);} catch {throw new RangeError('The annual tax bill needs its source URL.');}
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2000) throw new RangeError('The annual tax bill needs a public HTTP source URL.');
  if (typeof bill.retrievedAt !== 'string' || bill.retrievedAt.length > 80 || !Number.isFinite(Date.parse(bill.retrievedAt))) throw new RangeError('The annual tax bill needs a valid retrieval date.');
  return {status:'matched',recordKey:bill.recordKey,parcelId:bill.parcelId,jurisdiction:bill.jurisdiction,taxYear:bill.taxYear,amountUSD:bill.amountUSD,amountKind:'annual-property-tax',sourceUrl:url.href,retrievedAt:bill.retrievedAt};
}

/** Only source claims that still equal the entered assumption can be exported. */
export function normalizeAssumptionSources(sources, property, assumptions) {
  if (sources?.taxAnnual == null) return {};
  const taxAnnual = normalizeTaxEvidence(sources.taxAnnual, property);
  if (taxAnnual.amountUSD !== assumptions?.taxAnnual) throw new RangeError('The annual tax input no longer matches its source bill. Remove the source claim or restore the sourced amount.');
  return {taxAnnual};
}

export function taxEvidenceLines(sources, property, assumptions) {
  const bill = normalizeAssumptionSources(sources, property, assumptions).taxAnnual;
  if (!bill) return [];
  return [
    `Annual property-tax input source: tax year ${bill.taxYear}; annual base bill USD ${bill.amountUSD.toFixed(2)}.`,
    `Tax bill parcel: ${bill.parcelId}; jurisdiction: ${bill.jurisdiction}; exact source record: ${bill.recordKey}.`,
    `Tax bill source: ${bill.sourceUrl}; retrieved: ${bill.retrievedAt}.`,
    'This bill supplies the starting annual tax assumption only. Future taxes follow the entered expense-growth scenario; reassessment is not modeled. Editing the workbook tax input does not update this dated source note.',
  ];
}
