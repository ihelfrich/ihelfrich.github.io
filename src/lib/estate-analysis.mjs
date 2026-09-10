/** Explicit rental-scenario arithmetic and browser-local listing CSV handling.
 * No prices, rents, financing terms or market forecasts are inferred.
 */
export const MAX_LISTING_ROWS = 5000;
export const MAX_CSV_BYTES = 5000000;
export const LISTING_STATUSES = Object.freeze(['active', 'pending', 'sold', 'withdrawn']);
const COST_FIELDS = ['purchasePrice', 'rehab', 'closingCosts', 'rentMonthly', 'otherIncomeMonthly', 'operatingExpensesAnnual', 'capexReserveAnnual'];
const PCT_FIELDS = ['vacancyPct', 'ltvPct', 'interestPct'];
const REQUIRED_HEADERS = ['listing_id', 'address', 'latitude', 'longitude', 'asking_price', 'status', 'source', 'as_of'];
const KNOWN_HEADERS = new Set([...REQUIRED_HEADERS, 'parcel_id']);
const MAX_CSV_COLUMNS = 256;
function inputError(errors) {
  const error = new RangeError(errors.map(e => `${e.field}: ${e.message}`).join('; '));
  error.errors = errors;
  return error;
}

/** Annual stabilized cash flow. Return rates are percentages; DSCR is a ratio.
 * Debt service includes principal and interest only. The user must include all
 * relevant property operating costs in operatingExpensesAnnual.
 */
export function calculateProForma(input) {
  const errors = [];
  const check = (field, predicate, message) => {
    if (typeof input?.[field] !== 'number' || !Number.isFinite(input[field]) || !predicate(input[field])) errors.push({ field, message });
  };
  for (const field of COST_FIELDS) check(field, n => n >= 0, 'Enter a finite, nonnegative USD amount.');
  for (const field of PCT_FIELDS) check(field, n => n >= 0 && n <= 100, 'Enter a percentage from 0 through 100.');
  check('loanYears', n => n > 0 && n * 12 >= 1 && Number.isSafeInteger(Math.round(n * 12)) && Math.abs(n * 12 - Math.round(n * 12)) < 1e-8, 'Enter a positive loan term containing a whole number of monthly payments.');
  if (errors.length) throw inputError(errors);
  const assumptions = Object.fromEntries([...COST_FIELDS, ...PCT_FIELDS, 'loanYears'].map(k => [k, input[k]]));
  const loanPrincipal = input.purchasePrice * input.ltvPct / 100;
  const months = Math.round(input.loanYears * 12), monthlyRate = input.interestPct / 1200;
  // expm1/log1p avoid catastrophic cancellation as the interest rate approaches 0.
  const monthlyPayment = loanPrincipal === 0 ? 0 : monthlyRate === 0 ? loanPrincipal / months : loanPrincipal * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate));
  const grossPotentialAnnual = (input.rentMonthly + input.otherIncomeMonthly) * 12;
  const effectiveGrossIncomeAnnual = grossPotentialAnnual * (1 - input.vacancyPct / 100);
  const operatingExpensesAnnual = input.operatingExpensesAnnual;
  const noiAnnual = effectiveGrossIncomeAnnual - operatingExpensesAnnual;
  const debtServiceAnnual = monthlyPayment * 12, reservesAnnual = input.capexReserveAnnual;
  const cashFlowAnnual = noiAnnual - reservesAnnual - debtServiceAnnual;
  const totalProjectCost = input.purchasePrice + input.rehab + input.closingCosts;
  const equityRequired = totalProjectCost - loanPrincipal;
  const ratio = (numerator, denominator, multiplier = 1) => denominator === 0 ? null : numerator / denominator * multiplier;
  const result = {
    grossPotentialAnnual, effectiveGrossIncomeAnnual, operatingExpensesAnnual, noiAnnual,
    debtServiceAnnual, reservesAnnual, cashFlowAnnual, equityRequired, totalProjectCost,
    loanPrincipal, monthlyPayment, loanMonths: months,
    capRate: ratio(noiAnnual, input.purchasePrice, 100),
    cashOnCash: ratio(cashFlowAnnual, equityRequired, 100),
    dscr: ratio(noiAnnual, debtServiceAnnual),
    breakEvenOccupancy: ratio(operatingExpensesAnnual + reservesAnnual + debtServiceAnnual, grossPotentialAnnual, 100),
  };
  for (const [field, value] of Object.entries(result)) if (value !== null && !Number.isFinite(value)) throw inputError([{ field, message: 'The entered magnitudes overflow the calculation.' }]);
  return { ...result, assumptions, conventions: {
    currency: 'USD', period: 'annual stabilized scenario', rates: 'percent; DSCR is a ratio',
    vacancyBasis: 'rent plus other potential income', loanBasis: 'purchase price only',
    noiBasis: 'effective income less operating expenses; before reserves and debt',
    breakEvenBasis: 'occupancy needed to cover operating expenses, reserves and debt',
    equityBasis: 'purchase price plus rehab and closing costs less loan principal',
    expenseScope: 'user-entered operating costs; excludes reserves and debt service',
    forecast: false,
  } };
}

function numeric(text) {
  if (typeof text !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return Number.isFinite(value) ? value : null;
}
function asOfDate(text) {
  if (typeof text !== 'string') return null;
  const s = text.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2}))?$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return null;
  if (m[4] && (Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59)) return null;
  const ms = Date.parse(m[4] ? s : `${s}T00:00:00Z`);
  return Number.isFinite(ms) ? { text: s, ms, precision: m[4] ? 'timestamp' : 'date' } : null;
}

// RFC4180 character-state parser; rows retain their starting physical line.
function csvRecords(text) {
  const records = [];
  let fields = [], field = '', state = 'start', line = 1, startLine = 1, recordNumber = 0, syntaxError = null, truncated = false;
  const appendField = () => {
    if (fields.length >= MAX_CSV_COLUMNS) syntaxError ||= 'Record exceeds the 256 column limit.';
    else fields.push(field);
  };
  const finish = () => {
    appendField();
    if (fields.every(v => v.trim() === '') && !syntaxError) {
      fields = []; field = ''; state = 'start'; startLine = line + 1; return true;
    }
    recordNumber++;
    if (recordNumber > MAX_LISTING_ROWS + 1) { truncated = true; return false; }
    records.push({ values: fields, row: recordNumber, line: startLine, syntaxError });
    fields = []; field = ''; state = 'start'; syntaxError = null; startLine = line + 1;
    return true;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === 'quoted') {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else state = 'closed';
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') { field += '\r\n'; i++; }
        else field += c;
        line++;
      } else field += c;
      continue;
    }
    if (c === ',') { appendField(); field = ''; state = 'start'; continue; }
    if (c === '\r' || c === '\n') {
      if (!finish()) break;
      if (c === '\r' && text[i + 1] === '\n') i++;
      line++;
      continue;
    }
    if (c === '"') {
      if (state === 'start') state = 'quoted';
      else { syntaxError ||= 'Unexpected quote in an unquoted field.'; field += c; state = 'unquoted'; }
    } else {
      if (state === 'closed') syntaxError ||= 'Unexpected characters after a closing quote.';
      field += c; state = 'unquoted';
    }
  }
  if (!truncated && (field !== '' || fields.length || state !== 'start')) {
    if (state === 'quoted') syntaxError ||= 'Quoted field is not closed before end of file.';
    finish();
  }
  return { records, truncated };
}
const identity = (source, listingId) => `${encodeURIComponent(source.trim().toLowerCase())}::${encodeURIComponent(listingId.trim())}`;
function listingSignature(p) {
  return JSON.stringify([p.address, p.latitude, p.longitude, p.askingPrice, p.status, p.parcelId, p.metadata]);
}

/** No network or storage access. Unsupported/ambiguous records are not invented. */
export function parseListingsCsv(text) {
  const listings = [], errors = [], warnings = [];
  const output = () => ({ listings, errors, warnings });
  if (typeof text !== 'string') { errors.push({ row: null, code: 'invalid-file', message: 'CSV input must be text.' }); return output(); }
  if (text.length > MAX_CSV_BYTES || new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    warnings.push({ code: 'file-size-limit', message: `File exceeds ${MAX_CSV_BYTES} UTF-8 bytes; nothing was imported.` }); return output();
  }
  const parsed = csvRecords(text.replace(/^\uFEFF/, ''));
  if (parsed.truncated) warnings.push({ code: 'row-limit', message: `Only the first ${MAX_LISTING_ROWS} data records were processed. Split the file to review the remainder.` });
  const header = parsed.records.shift();
  if (!header) { errors.push({ row: 1, code: 'missing-header', message: 'CSV must contain a header row.' }); return output(); }
  if (header.syntaxError) { errors.push({ row: 1, line: header.line, code: 'csv-syntax', message: header.syntaxError }); return output(); }
  const rawHeaders = header.values.map(h => h.trim()), headers = rawHeaders.map(h => h.toLowerCase());
  const seenHeaders = new Set();
  for (const name of headers) {
    if (!name || seenHeaders.has(name)) errors.push({ row: 1, line: header.line, field: name || null, code: 'invalid-header', message: 'Header names must be nonempty and unique.' });
    seenHeaders.add(name);
  }
  for (const name of REQUIRED_HEADERS) if (!seenHeaders.has(name)) errors.push({ row: 1, line: header.line, field: name, code: 'missing-header', message: `Required column ${name} is missing.` });
  if (errors.length) return output();
  const groups = new Map();
  for (const record of parsed.records) {
    const fail = (field, code, message) => errors.push({ row: record.row, line: record.line, field, code, message });
    if (record.syntaxError) { fail(null, 'csv-syntax', record.syntaxError); continue; }
    let values = record.values;
    if (values.length === headers.length - 1 && headers.at(-1) === 'parcel_id') values = [...values, ''];
    if (values.length !== headers.length) { fail(null, 'column-count', `Expected ${headers.length} fields, received ${values.length}.`); continue; }
    const raw = Object.fromEntries(headers.map((name, i) => [name, values[i]]));
    const before = errors.length;
    const listingId = raw.listing_id.trim(), source = raw.source.trim(), status = raw.status.trim().toLowerCase();
    const latitude = numeric(raw.latitude), longitude = numeric(raw.longitude), askingPrice = numeric(raw.asking_price), date = asOfDate(raw.as_of);
    if (!listingId) fail('listing_id', 'required-value', 'A listing ID is required.');
    if (!source) fail('source', 'required-value', 'An explicit data source is required.');
    if (latitude === null || latitude < -90 || latitude > 90) fail('latitude', 'invalid-coordinate', 'Latitude must be a finite number from -90 through 90.');
    if (longitude === null || longitude < -180 || longitude > 180) fail('longitude', 'invalid-coordinate', 'Longitude must be a finite number from -180 through 180.');
    if (askingPrice === null || askingPrice <= 0) fail('asking_price', 'invalid-price', 'Asking price must be a positive finite USD number, without currency symbols or thousands separators.');
    if (!LISTING_STATUSES.includes(status)) fail('status', 'invalid-status', 'Status must explicitly be active, pending, sold or withdrawn.');
    if (!date) fail('as_of', 'invalid-date', 'Use a valid YYYY-MM-DD date or an ISO timestamp with an explicit UTC offset.');
    if (errors.length !== before) continue;
    const metadata = Object.fromEntries(headers.flatMap((name, i) => KNOWN_HEADERS.has(name) ? [] : [[rawHeaders[i], values[i]]]));
    const listing = { id: identity(source, listingId), listingId, address: raw.address.trim(), latitude, longitude, askingPrice, status, source,
      asOf: date.text, asOfTimestampMs: date.ms, asOfPrecision: date.precision, parcelId: raw.parcel_id?.trim() || null, metadata,
      importRow: record.row, importLine: record.line };
    if (!listing.address) warnings.push({ row: record.row, code: 'address-missing', message: 'Address is not supplied; the listing ID and provided coordinates are retained.' });
    if (!groups.has(listing.id)) groups.set(listing.id, []);
    groups.get(listing.id).push(listing);
  }
  let removedDuplicates = 0;
  for (const [key, records] of groups) {
    const latestTime = Math.max(...records.map(p => p.asOfTimestampMs));
    const latest = records.filter(p => p.asOfTimestampMs === latestTime);
    // A date-only record has no ordering within its reported day. Never assume
    // that a timestamp from that same day supersedes a conflicting daily record.
    for (const p of records) if (p.asOfPrecision === 'date' && p.asOfTimestampMs < latestTime && latestTime < p.asOfTimestampMs + 86400000) latest.push(p);
    const signatures = new Set(latest.map(listingSignature));
    if (signatures.size > 1) {
      for (const p of latest) errors.push({ row: p.importRow, line: p.importLine, field: null, code: 'conflicting-latest-records', message: 'The latest records for this source and listing ID disagree; none was imported.' });
      warnings.push({ code: 'review-required', listingKey: key, rows: latest.map(p => p.importRow), message: 'Resolve the conflicting latest records before using this listing.' });
      removedDuplicates += records.length;
      continue;
    }
    listings.push(latest[0]);
    removedDuplicates += records.length - 1;
    if (new Set(records.map(p => p.asOfPrecision)).size > 1) warnings.push({ code: 'mixed-date-precision', listingKey: key, message: 'This identity mixes date-only and timestamp records; date-only entries sort at midnight UTC.' });
  }
  listings.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (removedDuplicates) warnings.push({ code: 'deduplicated-records', count: removedDuplicates, message: `${removedDuplicates} duplicate, older or conflicting records were not retained.` });
  return output();
}

/** Volume is listing-based, never a sum of unique property market values. */
export function summarizeListings(listings) {
  if (!Array.isArray(listings)) throw new TypeError('Listings must be an array.');
  const active = listings.filter(p => p.status === 'active');
  const byStatus = Object.fromEntries(LISTING_STATUSES.map(s => [s, listings.filter(p => p.status === s).length]));
  const parcels = new Map();
  for (const p of active) {
    if (!Number.isFinite(p.askingPrice) || p.askingPrice <= 0) throw new RangeError('Summary requires validated positive asking prices.');
    if (p.parcelId) { if (!parcels.has(p.parcelId)) parcels.set(p.parcelId, []); parcels.get(p.parcelId).push(p); }
  }
  const possibleDuplicateParcelGroups = [...parcels].filter(([, group]) => group.length > 1).map(([parcelId, group]) => ({ parcelId, listingIds: group.map(p => p.id), count: group.length }));
  const activeListingsWithoutParcelId = active.filter(p => !p.parcelId).length;
  const warnings = [];
  if (possibleDuplicateParcelGroups.length) warnings.push({ code: 'possible-duplicate-parcels', message: 'Multiple active listing records share supplied parcel IDs. Listing asking volume may count the same property more than once.' });
  if (activeListingsWithoutParcelId) warnings.push({ code: 'missing-parcel-identifiers', message: `${activeListingsWithoutParcelId} active listings lack parcel identifiers; a unique-property total cannot be established.` });
  const activeAskingVolumeUSD = active.reduce((sum, p) => sum + p.askingPrice, 0);
  if (!Number.isFinite(activeAskingVolumeUSD)) throw new RangeError('Asking-price volume overflows numeric precision.');
  return { listingCount: listings.length, byStatus, activeListingCount: active.length, activeAskingVolumeUSD,
    uniqueIdentifiedActiveParcels: parcels.size, activeListingsWithoutParcelId, possibleDuplicateParcelGroups, warnings,
    askingVolumeBasis: 'sum of active listing asking prices; not unique property value or realized sales',
    parcelCountBasis: 'distinct supplied parcel_id strings among active listings; jurisdiction and identity unverified',
    inventoryCoverage: 'unknown; no population coverage percentage is calculated',
  };
}

/** Default scope is active listings; coordinates remain in source lon/lat. */
export function filterListings(listings, { statuses = ['active'], minPrice, maxPrice, source, query = '', bounds } = {}) {
  if (!Array.isArray(listings)) throw new TypeError('Listings must be an array.');
  if (!Array.isArray(statuses) || statuses.some(s => !LISTING_STATUSES.includes(s))) throw new RangeError('Use explicit supported listing statuses.');
  if ([minPrice, maxPrice].some(v => v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) || (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)) throw new RangeError('Invalid asking-price filter bounds.');
  if (bounds !== undefined && (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[0] > bounds[2] || bounds[1] > bounds[3] || bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90)) throw new RangeError('Use [west,south,east,north] coordinate bounds.');
  const term = String(query).trim().toLowerCase(), sourceKey = source == null ? null : String(source).trim().toLowerCase();
  return listings.filter(p => statuses.includes(p.status)
    && (minPrice === undefined || p.askingPrice >= minPrice) && (maxPrice === undefined || p.askingPrice <= maxPrice)
    && (sourceKey === null || p.source.toLowerCase() === sourceKey)
    && (!term || [p.address, p.listingId, p.parcelId, p.source].some(v => String(v || '').toLowerCase().includes(term)))
    && (!bounds || (p.longitude >= bounds[0] && p.longitude <= bounds[2] && p.latitude >= bounds[1] && p.latitude <= bounds[3])));
}
