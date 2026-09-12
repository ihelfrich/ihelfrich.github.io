import { PUBLIC_LRA_SOURCE } from './city-public-listings.mjs';
import { PROPERTY_ATLAS_LIMIT } from './city-property-atlas.mjs';

const freeze = object => { for (const value of Object.values(object)) if (value && typeof value === 'object') freeze(value); return Object.freeze(object); };
/** Configuration describes supported sources, never successful retrieval. Use
 * propertyLayerStatus with the current result before claiming a layer is ready. */
export const PROPERTY_LAYER_CATALOG = freeze([
  { id:'assessments', label:'Assessed values', group:'property', access:'public', geometry:'property-points',
    jurisdictions:['st-louis-city','st-louis-county'], sourceIds:['st-louis-city-regional-records-2026-09','st-louis-county-current'],
    capabilities:['assessed-value','county-appraised-value'], amountKind:'assessor-value',
    coverage:'Connected City and County source records. City assessment vintage is unknown; County tax year is a separate field.',
    meaning:'Assessor values are not asking prices or an independent market valuation.' },
  { id:'recorded-transfers', label:'Recorded transfers', group:'property', access:'public', geometry:'property-points',
    jurisdictions:['st-louis-city','st-louis-county'], sourceIds:['st-louis-city-regional-records-2026-09','st-louis-county-current'],
    capabilities:['latest-available-transfer','transfer-year-filter'], amountKind:'recorded-transfer-price',
    coverage:'One latest available source transfer per mapped record; historical coverage varies by jurisdiction.',
    meaning:'Includes non-market transfers. Withheld, conflicting, missing and zero prices remain distinct. This is not a complete transaction-volume series.' },
  { id:'public-inventory', label:'Public sale inventory', group:'availability', access:'public', geometry:'source-parcel-centroids',
    jurisdictions:['st-louis-city'], sourceIds:[PUBLIC_LRA_SOURCE.id], capabilities:['source-available-status'], amountKind:'asking-price', color:'#61d5a5',
    coverage:'City LRA parcels explicitly marked Available in the connected public inventory snapshot.',
    meaning:'Public land-bank inventory only. Parcel asking prices are not published by this connection; current availability must be checked with LRA.' },
  { id:'imported-listings', label:'Your listing import', group:'availability', access:'local-import', geometry:'user-supplied-points',
    jurisdictions:[], sourceIds:[], capabilities:['asking-price','reported-listing-status'], amountKind:'asking-price', color:'#e98648',
    coverage:'Only records supplied in the browser-local CSV import. No automatic refresh or jurisdiction verification.',
    meaning:'An imported asking price is not a recorded sale. Supplied parcel IDs do not establish an exact public-record match.' },
  { id:'market-listings', label:'Licensed market listings', group:'availability', access:'licensed', geometry:'not-connected',
    jurisdictions:[], sourceIds:[], capabilities:[], amountKind:'asking-price',
    coverage:'No MLS or comprehensive private-market feed is connected.',
    meaning:'Public MLS display requires the relevant data license, participating brokerage and permitted record/use-case scope. An API subscription alone does not establish those permissions.' },
  { id:'permits', label:'Building permits', group:'development', access:'public', geometry:'source-permit-points',
    jurisdictions:['st-louis-city'], sourceIds:['st-louis-city-building-permits-2025'], capabilities:['issued-permit-cohort','source-date-status'], amountKind:'estimated-project-cost', color:'#88bdf0',
    coverage:'City permits issued in 2025; applications may be older and later dated events may appear. County permits are not connected.',
    meaning:'Permit status is derived from supplied dates, not a live construction inspection. Source duplicates and date anomalies require explicit handling.' },
  { id:'zoning-petitions', label:'Zoning petition records', group:'development', access:'public', geometry:'source-petition-points',
    jurisdictions:['st-louis-county'], sourceIds:['st-louis-county-zoning-petitions'], capabilities:['source-petition-location','source-case-identifiers'], color:'#c3a3e7',
    coverage:'Historical County zoning-petition locations from their own official source; coverage and dates belong to that dataset.',
    meaning:'A petition point or procedure code does not establish approval, a current proposal, or construction.' },
  { id:'planning-notices', label:'Official planning notices', group:'development', access:'public', geometry:'documents',
    jurisdictions:['st-louis-city','st-louis-county'], sourceIds:[], capabilities:['official-notices','source-described-areas'],
    coverage:'Selected official notices and planning documents; not a complete development pipeline.',
    meaning:'Source-described areas remain documents until a defensible map location is available. Hearing-listed and approved are different states.' },
  { id:'ownership-signals', label:'Organization-name indicators', group:'ownership', access:'public', geometry:'property-points',
    jurisdictions:['st-louis-county'], sourceIds:['st-louis-county-business-name-indicators'], capabilities:['explicit-legal-designator-pattern','literal-name-search'], color:'#d9a6bf', evidenceType:'name-pattern',
    coverage:'Selected current public owner strings containing explicit legal designators, under a documented matching rule.',
    meaning:'A name pattern is not a verified owner classification, a buyer-at-sale record, or evidence of private-equity ownership. No classification from names is performed by this catalog.' },
]);

export const getPropertyLayer = id => PROPERTY_LAYER_CATALOG.find(layer => layer.id === id) || null;
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
const webUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
const sourceSummary = value => value ? { id:text(value.id), name:text(value.name), url:webUrl(value.url), retrievedAt:timestamp(value.retrievedAt) } : null;

export function propertyLayerStatus(id, facts = {}) {
  const layer = getPropertyLayer(id);
  if (!layer) throw new RangeError('Unknown property layer.');
  const counts = Object.fromEntries(['records','eligible','matched','mapped','unlocated','invalid','duplicates','omitted','outsideView','filtered'].map(key => [key, integer(facts.counts?.[key])]));
  let state;
  if (layer.access === 'licensed') state = 'license-required';
  else if (facts.error) state = 'unavailable';
  else if (!facts.loaded) state = layer.access === 'local-import' ? 'import-required' : 'not-loaded';
  else if (facts.stale) state = 'stale';
  else if (facts.partial || counts.invalid || counts.duplicates || counts.omitted) state = 'partial';
  else if (!counts.mapped && counts.unlocated) state = 'unmapped';
  else if (!counts.mapped) state = 'empty';
  else state = 'ready';
  const labels = { 'license-required':'Licensed feed not connected', unavailable:'Source unavailable', 'import-required':'Import required',
    'not-loaded':'Not loaded', stale:'Older snapshot', partial:'Partial map coverage', unmapped:'Records without mapped locations', empty:'No matching map records', ready:'Source records ready' };
  const canBrowse = Boolean(facts.loaded) && !facts.error && layer.access !== 'licensed' && counts.records > 0;
  return { layerId:id, state, label:labels[state], canBrowse, canMap:canBrowse && counts.mapped > 0,
    partial:Boolean(facts.partial || counts.invalid || counts.duplicates || counts.omitted || counts.unlocated),
    counts, retrievedAt:timestamp(facts.retrievedAt), coverage:layer.coverage, meaning:layer.meaning };
}

function optionsFor(options = {}) {
  const limit = options.limit ?? PROPERTY_ATLAS_LIMIT, bounds = options.bounds;
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > PROPERTY_ATLAS_LIMIT) throw new RangeError('Use a map limit from 0 to 10,000.');
  if (bounds != null && (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(finite) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3] ||
    bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90)) throw new RangeError('Use valid geographic map bounds.');
  return { ...options, limit, bounds };
}
function unavailable(layerId, source = null) {
  const status = propertyLayerStatus(layerId, { error:true });
  return { layerId, features:[], status, counts:status.counts, source:sourceSummary(source), coverage:status.coverage };
}
function project(layerId, records, normalize, options = {}, facts = {}) {
  const settings = optionsFor(options), candidates = [], unmapped = [], identities = new Map();
  const counts = { records:records.length, eligible:0, matched:0, mapped:0, unlocated:0, invalid:0, duplicates:0, omitted:0, outsideView:0, filtered:0 };
  for (const row of records) {
    const normalized = normalize(row);
    if (normalized === false) { counts.filtered++; continue; }
    if (!normalized || !text(normalized.id)) { counts.invalid++; continue; }
    counts.eligible++;
    identities.set(normalized.id, (identities.get(normalized.id) || 0) + 1);
    if (normalized.longitude == null && normalized.latitude == null) { counts.unlocated++; unmapped.push(normalized); continue; }
    if (!finite(normalized.longitude) || !finite(normalized.latitude) || Math.abs(normalized.longitude) > 180 || Math.abs(normalized.latitude) > 90) { counts.invalid++; continue; }
    const bounds = settings.bounds;
    if (bounds && (normalized.longitude < bounds[0] || normalized.longitude > bounds[2] || normalized.latitude < bounds[1] || normalized.latitude > bounds[3])) { counts.outsideView++; continue; }
    candidates.push(normalized);
  }
  const unique = candidates.filter(row => { if (identities.get(row.id) > 1) { counts.duplicates++; return false; } return true; });
  counts.matched = unique.length; counts.mapped = Math.min(unique.length, settings.limit); counts.omitted = unique.length - counts.mapped;
  const status = propertyLayerStatus(layerId, { ...facts, counts, loaded:true });
  return { layerId, features:unique.slice(0, settings.limit), records:[...unique,...unmapped.filter(row=>identities.get(row.id)===1)], status, counts, source:sourceSummary(facts.source), coverage:status.coverage };
}

/** Public inventory has no asking-price field. Its LRA identifier must not be
 * promoted to a parcel-GIS recordKey; a shared handle is not an exact join. */
export function projectPublicInventory(snapshot, options = {}) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.source?.id !== PUBLIC_LRA_SOURCE.id || !Array.isArray(snapshot.listings) || !timestamp(snapshot.retrievedAt))
    return unavailable('public-inventory', snapshot?.source);
  const ageHours = finite(options.now) ? (options.now - Date.parse(snapshot.retrievedAt)) / 3600000 : null;
  return project('public-inventory', snapshot.listings, row => {
    if (!text(row?.id) || !text(row.parcelKey) || !text(row.parcelId) || row.sourceId !== PUBLIC_LRA_SOURCE.id || row.status !== 'available' ||
      row.sourceStatus !== 'Available' || row.askingPrice !== null || row.priceStatus !== 'not-published') return null;
    return { id:`public-inventory:${row.id}`, layerId:'public-inventory', kind:'public-listing', sourceListingId:row.id,
      parcelKey:row.parcelKey, parcelId:row.parcelId, handle:text(row.handle), recordKey:null,
      address:text(row.address), jurisdiction:'st-louis-city', longitude:row.longitude, latitude:row.latitude,
      coordinateBasis:text(row.coordinateBasis), parcelJoinStatus:text(row.parcelJoinStatus),
      value:null, askingPrice:null, amountKind:'asking-price', priceStatus:'not-published', status:'available', sourceStatus:'Available',
      sourceId:PUBLIC_LRA_SOURCE.id, sourceUrl:webUrl(row.sourceUrl), retrievedAt:timestamp(row.retrievedAt) || snapshot.retrievedAt,
      propertyType:text(row.propertyType), usage:text(row.usage), color:getPropertyLayer('public-inventory').color, pixelSize:8 };
  }, options, { source:{ ...snapshot.source, retrievedAt:snapshot.retrievedAt }, retrievedAt:snapshot.retrievedAt,
    stale:snapshot.snapshotStatus === 'stale' || (ageHours !== null && ageHours > 48), partial:ageHours !== null && ageHours < -0.0833 });
}

/** Input is the existing parseListingsCSV output. Arbitrary CSV metadata is
 * deliberately excluded; a supplied parcel_id is not a jurisdictional join. */
export function projectImportedListings(listings, options = {}) {
  if (!Array.isArray(listings)) { const status = propertyLayerStatus('imported-listings'); return { layerId:'imported-listings', features:[], status, counts:status.counts, source:null, coverage:status.coverage }; }
  const statuses = options.statuses ?? ['active'];
  if (!Array.isArray(statuses) || statuses.some(status => !['active','pending','sold','withdrawn'].includes(status))) throw new RangeError('Choose supported imported listing statuses.');
  return project('imported-listings', listings, row => {
    if (!text(row?.id) || !text(row.listingId) || !text(row.source) || !['active','pending','sold','withdrawn'].includes(row.status) || !timestamp(row.asOf) || !finite(row.askingPrice) || row.askingPrice <= 0) return null;
    if (!statuses.includes(row.status)) return false;
    return { id:`imported-listings:${row.id}`, layerId:'imported-listings', kind:'imported-listing', sourceListingId:row.id, listingId:row.listingId,
      sourceName:row.source, sourceId:'browser-local-import', recordKey:null, parcelKey:null, parcelId:text(row.parcelId), parcelJoinStatus:'unverified-import', jurisdiction:null,
      longitude:row.longitude, latitude:row.latitude, coordinateBasis:'user-supplied', address:text(row.address),
      value:row.askingPrice, askingPrice:row.askingPrice, amountKind:'asking-price', status:row.status, asOf:row.asOf,
      color:getPropertyLayer('imported-listings').color, pixelSize:8 };
  }, options);
}

/** Permit snapshots are already source-normalized. No approval/completion state
 * is inferred here, and source handles are never promoted to exact parcel joins. */
export function projectPermitRecords(snapshot, options = {}) {
  if (!snapshot || !Array.isArray(snapshot.records) || snapshot.source?.id !== 'st-louis-city-building-permits-2025' || !timestamp(snapshot.retrievedAt))
    return unavailable('permits', snapshot?.source);
  return project('permits', snapshot.records, row => {
    if (!text(row?.id) || row.jurisdiction !== 'st-louis-city' || row.sourceId !== snapshot.source.id) return null;
    return { id:`permits:${row.id}`, layerId:'permits', kind:'permit', sourceRecordId:row.id, permitId:text(row.permitId),
      sourceId:row.sourceId, sourceObjectId:finite(row.sourceObjectId) ? row.sourceObjectId : null,
      jurisdiction:row.jurisdiction, recordKey:null, parcelKey:null, parcelJoinStatus:'not-established',
      longitude:row.longitude, latitude:row.latitude, address:text(row.address),
      applicationTypeCode:text(row.applicationTypeCode), applicationNumber:text(row.applicationNumber), projectTypeCode:text(row.projectTypeCode),
      description:text(row.description), status:text(row.status), statusBasis:text(row.statusBasis),
      applicationDate:timestamp(row.applicationDate), issuedDate:timestamp(row.issuedDate), completedDate:timestamp(row.completedDate), cancelledDate:timestamp(row.cancelledDate),
      estimatedCostUSD:finite(row.estimatedCostUSD) && row.estimatedCostUSD >= 0 ? row.estimatedCostUSD : null,
      value:finite(row.estimatedCostUSD) && row.estimatedCostUSD >= 0 ? row.estimatedCostUSD : null, amountKind:'estimated-project-cost',
      sourceUrl:webUrl(row.sourceUrl) || webUrl(snapshot.source.url), retrievedAt:snapshot.retrievedAt,
      color:getPropertyLayer('permits').color, pixelSize:8 };
  }, options, { source:snapshot.source, retrievedAt:snapshot.retrievedAt, partial:snapshot.partial === true });
}
