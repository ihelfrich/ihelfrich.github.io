// Records are a snapshot: replace the array if its contents change. Cached search
// text and sort orders belong to that immutable array; source records are never edited.
const prepared = new WeakMap();
const normalize = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const addressOrder = new Intl.Collator('en', {numeric: true, sensitivity: 'base'});
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const sortable = ['address', 'yearBuilt', 'livingAreaSqFt', 'assessedValueUSD'];

function prepare(records) {
  let cached = prepared.get(records);
  if (cached) return cached;
  if (!Array.isArray(records)) throw new TypeError('Parcel records must be an array.');
  cached = {
    rows: records.map((record, position) => ({record, position, text: normalize([record.address, record.parcelId, record.municipality, record.postalCode].join(' '))})),
    scopes: new Map(),
    orders: new Map(),
  };
  prepared.set(records, cached);
  return cached;
}

function bound(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!numeric(value) || value < 0) throw new RangeError('Parcel bounds must be finite, nonnegative numbers.');
  return value;
}

function range(minimum, maximum, field) {
  const min = bound(minimum), max = bound(maximum);
  if (min !== undefined && max !== undefined && min > max) throw new RangeError('Parcel minimum cannot exceed its maximum.');
  return min === undefined && max === undefined ? null : {field, min: min ?? -Infinity, max: max ?? Infinity};
}

/**
 * All tokens match address/parcel ID/municipality/ZIP, ignoring punctuation and
 * case. Bounds are inclusive: built* = yearBuilt, area* = livingAreaSqFt, units*
 * = dwellingUnits. Null/empty/undefined means no bound; numeric strings are not
 * accepted. Missing/nonfinite numeric values never satisfy an active bound.
 * Omitted sort retains source order. Explicit sorts are stable, numeric-aware for
 * addresses, and put missing values last in either direction. Pagination and CSV
 * export use this same query (use limit:30000 for the complete snapshot).
 */
export function filterCountyParcels(records, {
  scope = 'overland', query = '', residential = true, offset = 0, limit = 20,
  builtMin, builtMax, areaMin, areaMax, unitsMin, unitsMax, sort, direction = 'asc',
} = {}) {
  if (!['overland', 'page-i170', 'all'].includes(scope) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 30000 || (sort != null && sort !== '' && !sortable.includes(sort)) || !['asc', 'desc'].includes(direction)) throw new RangeError('Invalid parcel filter.');
  const ranges = [range(builtMin, builtMax, 'yearBuilt'), range(areaMin, areaMax, 'livingAreaSqFt'), range(unitsMin, unitsMax, 'dwellingUnits')].filter(Boolean);
  const tokens = normalize(query).split(' ').filter(Boolean);
  const cache = prepare(records), scopeKey = `${scope}:${Boolean(residential)}`;
  let candidates = cache.scopes.get(scopeKey);
  if (!candidates) {
    candidates = cache.rows.filter(({record}) => (scope === 'all' || record.scope?.includes(scope)) && (!residential || record.dwellingUnits > 0));
    cache.scopes.set(scopeKey, candidates);
  }
  if (sort) {
    const orderKey = `${scopeKey}:${sort}:${direction}`;
    let ordered = cache.orders.get(orderKey);
    if (!ordered) {
      const sign = direction === 'asc' ? 1 : -1;
      ordered = candidates.slice().sort((a, b) => {
        const av = a.record[sort], bv = b.record[sort];
        const aKnown = sort === 'address' ? typeof av === 'string' && av.trim() !== '' : numeric(av);
        const bKnown = sort === 'address' ? typeof bv === 'string' && bv.trim() !== '' : numeric(bv);
        if (aKnown !== bKnown) return aKnown ? -1 : 1;
        if (!aKnown) return a.position - b.position;
        return sign * (sort === 'address' ? addressOrder.compare(av, bv) : av - bv) || a.position - b.position;
      });
      cache.orders.set(orderKey, ordered);
    }
    candidates = ordered;
  }
  const page = [];
  let total = 0;
  candidate: for (const {record, text} of candidates) {
    for (const token of tokens) if (!text.includes(token)) continue candidate;
    for (const {field, min, max} of ranges) {
      const value = record[field];
      if (!numeric(value) || value < min || value > max) continue candidate;
    }
    if (total >= offset && page.length < limit) page.push(record);
    total++;
  }
  return {total, records: page, offset, limit};
}
