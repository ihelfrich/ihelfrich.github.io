import {createParcelSearch} from './city-parcels.mjs';

export const COUNTY_ADDRESS_SOURCE = Object.freeze({
  id: 'st-louis-county-address-points', jurisdiction: 'st-louis-county',
  name: 'St. Louis County GIS address points',
  url: 'https://maps.stlouisco.com/hosting/rest/services/Maps/ASR_Address_Points/FeatureServer/0',
  catalogUrl: 'https://www.arcgis.com/home/item.html?id=e5728d926a8a4a20ac511d3698f88917',
  termsUrl: 'https://www.arcgis.com/home/item.html?id=e5728d926a8a4a20ac511d3698f88917',
  coverage: 'County address locations; no parcel boundaries or assessment records',
  vintage: null, method: 'Bounded query of current-status address points; source dates are not survey or assessment dates.',
});
const CITY_SOURCE = Object.freeze({id:'st-louis-city-parcels',jurisdiction:'st-louis-city',name:'City of St. Louis public parcel data',url:'https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0'});
const MAX_ROWS = 64, MAX_BYTES = 1024 * 1024;
const FIELDS = 'OBJECTID,ADRNO,ADRDIR,ADRSTR,ADRSUF,UNITDESC,UNITNO,MUNI,MAILINGCITY,ZIPCODE,STATE,COUNTY,FULL_ADDRESS,PROP_ADD,STATUS,DATE_PUBLIC,last_edited_date';
const ABBREVIATIONS = Object.freeze({STREET:'ST',SAINT:'ST',AVENUE:'AVE',AV:'AVE',ROAD:'RD',BOULEVARD:'BLVD',DRIVE:'DR',LANE:'LN',COURT:'CT',PLACE:'PL',PARKWAY:'PKWY',HIGHWAY:'HWY',TERRACE:'TER',CIRCLE:'CIR',TRAIL:'TRL',NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W',NORTHEAST:'NE',NORTHWEST:'NW',SOUTHEAST:'SE',SOUTHWEST:'SW',APARTMENT:'APT',SUITE:'STE'});
const SUFFIXES = new Set(['ST','AVE','RD','BLVD','DR','LN','CT','PL','PKWY','HWY','TER','CIR','TRL']);
const normalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/gu,'').toUpperCase().replace(/[’‘]/gu,"'").replace(/&/gu,' AND ').replace(/[^A-Z0-9' -]+/gu,' ').replace(/\s+/gu,' ').trim();
const canonical = value => normalize(value).split(' ').map(word => ABBREVIATIONS[word] || word).join(' ');
const safeText = (value,max=160) => typeof value==='string' && value.trim().length && value.length<=max && !/[\u0000-\u001f\u007f]/u.test(value) ? value.trim() : null;
const sqlString = value => `'${value.replace(/'/gu,"''")}'`;
const pointValid = row => typeof row?.longitude==='number' && typeof row?.latitude==='number' && Number.isFinite(row.longitude) && Number.isFinite(row.latitude) && row.longitude>=-91 && row.longitude<=-90.05 && row.latitude>=38.35 && row.latitude<=38.95;
const abortError = () => Object.assign(new Error('Address search canceled.'), {name:'AbortError'});
class SearchFailure extends Error {}

function parseQuery(query) {
  if (!safeText(query) || query.length>160) return null;
  let normalized=canonical(query);
  if (normalized.length<3) return null;
  normalized=normalized.replace(/\s+(?:USA|UNITED STATES)$/u,'');
  const postal=normalized.match(/(?:^|\s)(\d{5})(?:-\d{4})?$/u);
  const postalCode=postal && /^63\d{3}$/u.test(postal[1]) ? postal[1] : null;
  if (postalCode) normalized=normalized.slice(0,postal.index).trim();
  normalized=normalized.replace(/(?:^|\s)(?:MISSOURI|MO)$/u,'').trim();
  let municipalityCode=null;
  for (const [code,name] of Object.entries(MUNICIPALITIES).sort((a,b)=>b[1].length-a[1].length)) {
    const place=canonical(name),isWhole=normalized===place,isSuffix=normalized.endsWith(` ${place}`);
    const prefix=isSuffix?normalized.slice(0,-place.length).trim():'';
    // A bare street such as "123 Clayton" must not be mistaken for a municipality suffix.
    if (isWhole || (isSuffix && /[A-Z]/u.test(prefix))) {
      municipalityCode=code==='STL'?null:code;
      normalized=isWhole?'':prefix;
      break;
    }
  }
  const tokens=normalized.split(' ').filter(Boolean);
  if (tokens.length>16 || tokens.some(token=>token.length>50)) return null;
  const number=tokens[0] && /^\d{1,6}$/u.test(tokens[0]) ? Number(tokens.shift()) : null;
  if (!tokens.length && number!==null && !municipalityCode && !postalCode) return null;
  if (!tokens.length && number===null && !municipalityCode && !postalCode) return null;
  const street=[number,...tokens].filter(value=>value!==null).join(' ');
  return {number,tokens,street,postalCode,municipalityCode};
}

function countyQuery(plan) {
  const clauses=["UPPER(COUNTY) = 'SAINT LOUIS COUNTY'", "STATE = 'MO'", "STATUS = 'Current'"];
  if (plan.number!==null) clauses.push(`ADRNO = ${plan.number}`);
  if (plan.postalCode) clauses.push(`ZIPCODE = ${sqlString(plan.postalCode)}`);
  if (plan.municipalityCode) clauses.push(`MUNI = ${sqlString(plan.municipalityCode)}`);
  for (const token of plan.tokens) {
    const alternatives=[token,...Object.entries(ABBREVIATIONS).filter(([,short])=>short===token).map(([long])=>long)];
    clauses.push(`(${alternatives.map(word=>`UPPER(FULL_ADDRESS) LIKE ${sqlString(`%${word}%`)}`).join(' OR ')})`);
  }
  const url=new URL(`${COUNTY_ADDRESS_SOURCE.url}/query`);
  url.search=new URLSearchParams({f:'json',where:clauses.join(' AND '),outFields:FIELDS,outSR:'4326',returnGeometry:'true',resultRecordCount:String(MAX_ROWS),orderByFields:'ADRNO,ADRSTR,OBJECTID'}).toString();
  return url.href;
}

/** A deadline also settles requests whose fetch or body reader ignores abort. */
async function withDeadline(action,{signal,timeoutMs}) {
  const controller=new AbortController();let timer,onAbort;
  const stopped=new Promise((_,reject)=>{
    onAbort=()=>{controller.abort();reject(abortError());};
    if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(()=>{controller.abort();reject(new SearchFailure('Address source timed out. Try again.'));},timeoutMs);
  });
  try {
    if(signal?.aborted)throw abortError();
    return await Promise.race([Promise.resolve().then(()=>action(controller.signal)),stopped]);
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}

async function countyJson(url,{fetchImpl,signal}) {
  const response=await fetchImpl(url,{signal,mode:'cors',credentials:'omit',headers:{Accept:'application/json'}});
  if(!response.ok)throw new SearchFailure(response.status===429?'County address source is rate limited. Please pause and try again.':`County address source unavailable (HTTP ${response.status}).`);
  const length=Number(response.headers?.get('content-length'));
  if(Number.isFinite(length)&&length>MAX_BYTES)throw new SearchFailure('County address response exceeded the size limit.');
  if(!response.body?.getReader)throw new SearchFailure('County address response could not be read safely.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,body='';
  try {
    while(true) {
      if(signal.aborted)throw abortError();
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>MAX_BYTES)throw new SearchFailure('County address response exceeded the size limit.');
      body+=decoder.decode(value,{stream:true});
    }
    body+=decoder.decode();
  } catch(error) {void reader.cancel().catch(()=>{});throw error;}
  finally {reader.releaseLock();}
  let payload;try{payload=JSON.parse(body);}catch{throw new SearchFailure('County address source returned invalid data.');}
  if(payload?.error)throw new SearchFailure(Number(payload.error.code)===429?'County address source is rate limited. Please pause and try again.':'County address source rejected the query.');
  if(!Array.isArray(payload?.features)||payload.features.length>MAX_ROWS||![payload.spatialReference?.wkid,payload.spatialReference?.latestWkid].includes(4326))throw new SearchFailure('County address source returned an unsupported response.');
  return payload;
}

const sourceDate = value => typeof value==='number' && Number.isFinite(value) && value>0 && Number.isFinite(new Date(value).valueOf()) ? new Date(value).toISOString() : null;
function countyRows(payload,source) {
  const seen=new Set(),results=[];let invalidCount=0;
  for(const feature of payload.features) {
    const a=feature?.attributes,row={longitude:feature?.geometry?.x,latitude:feature?.geometry?.y};
    // County/state attributes establish provenance; the envelope is only a coordinate corruption guard.
    if(!a || normalize(a.COUNTY)!=='SAINT LOUIS COUNTY'||a.STATE!=='MO'||a.STATUS!=='Current'||!pointValid(row)||!Number.isSafeInteger(a.OBJECTID)||a.OBJECTID<0) {invalidCount++;continue;}
    let address=safeText(a.FULL_ADDRESS)||safeText(a.PROP_ADD);
    if(!address) {invalidCount++;continue;}
    const unit=safeText(a.UNITNO,16),unitDescription=safeText(a.UNITDESC,20)||'UNIT';
    if(unit && (canonical(address)===canonical(a.PROP_ADD||'') || !canonical(address).endsWith(` ${canonical(unit)}`)))address+=` ${unitDescription} ${unit}`;
    const key=`${canonical(address)}:${row.longitude.toFixed(7)}:${row.latitude.toFixed(7)}`;
    if(seen.has(key))continue;seen.add(key);
    results.push({...row,address,jurisdiction:'st-louis-county',resultKind:'address',sourceAddressId:`st-louis-county-address:${a.OBJECTID}`,municipality:MUNICIPALITIES[a.MUNI]||null,municipalityCode:safeText(a.MUNI,5),mailingCity:safeText(a.MAILINGCITY,80),postalCode:typeof a.ZIPCODE==='string'&&/^\d{5}$/u.test(a.ZIPCODE)?a.ZIPCODE:null,sourceRecordUpdatedAt:sourceDate(a.last_edited_date),sourceRecordPublishedAt:sourceDate(a.DATE_PUBLIC),source});
  }
  return {results,invalidCount};
}

function score(row,plan) {
  const address=canonical(row.address),query=plan.street;
  const addressTokens=address.split(' ');
  return (query&&address===query?1000:query&&address.startsWith(`${query} `)?700:0)+(plan.number!==null&&addressTokens[0]===String(plan.number)?300:0)+plan.tokens.filter(token=>addressTokens.includes(token)).length*10;
}
function mergeResults(city,county,plan,limit) {
  const compare=(a,b)=>score(b,plan)-score(a,plan)||a.address.localeCompare(b.address)||String(a.recordKey||a.sourceAddressId).localeCompare(String(b.recordKey||b.sourceAddressId));
  const groups=[city.sort(compare),county.sort(compare)];
  const selected=groups.flat().sort(compare).slice(0,limit);
  // Reserve representation for each responding source when both have matches.
  if(limit>=2)for(const group of groups)if(group.length&&!selected.some(row=>row.jurisdiction===group[0].jurisdiction))selected[selected.length-1]=group[0];
  return selected.sort(compare);
}

/** City exact records plus live County address locations. An address point is never a parcel. */
export function createRegionalAddressSearch({fetchImpl=(...args)=>fetch(...args),citySearch=createParcelSearch({fetchImpl}),timeoutMs=12000,now=()=>new Date(),cacheTtlMs=60000}={}) {
  if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new RangeError('Search timeout must be from 1 through 30000 milliseconds.');
  const cache=new Map();
  async function searchCounty(plan,signal) {
    const url=countyQuery(plan),timestamp=new Date(now()).valueOf(),existing=cache.get(url);
    if(existing&&timestamp-existing.timestamp<cacheTtlMs)return existing.value;
    const value=await withDeadline(async requestSignal=>{
      const payload=await countyJson(url,{fetchImpl,signal:requestSignal});
      const source={...COUNTY_ADDRESS_SOURCE,retrievedAt:new Date(now()).toISOString()};
      const parsed=countyRows(payload,source),truncated=payload.exceededTransferLimit===true;
      return {...parsed,source,truncated};
    },{signal,timeoutMs});
    if(signal?.aborted)throw abortError();
    cache.delete(url);cache.set(url,{timestamp,value});while(cache.size>24)cache.delete(cache.keys().next().value);
    return value;
  }
  return async function searchRegionalAddresses(query,{limit=12,signal}={}) {
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new RangeError('Search limit must be from 1 through 50.');
    if(signal?.aborted)throw abortError();
    const plan=parseQuery(query);
    if(!plan)return {results:[],sources:[],partial:false,reason:'Enter a street name, municipality, or ZIP code using 3–160 characters.'};
    const cityQuery=plan.street.split(' ').map(token=>token==='AVE'?'AV':token).join(' ');
    const skipCity=Boolean(plan.municipalityCode || !cityQuery);
    const jobs=[withDeadline(async requestSignal=>{
      if(plan.municipalityCode || !cityQuery)return [];
      let rows=await citySearch(cityQuery,{limit:50,signal:requestSignal});
      // Suffixes vary in the retained source (AV/AVE); a bounded fallback preserves exact source IDs.
      if(!rows.length&&SUFFIXES.has(plan.tokens.at(-1)))rows=await citySearch([plan.number,...plan.tokens.slice(0,-1)].filter(value=>value!==null).join(' '),{limit:50,signal:requestSignal});
      if(!Array.isArray(rows))throw new SearchFailure('City address index returned invalid data.');
      return rows.filter(row=>pointValid(row)&&safeText(row.address)&&row.jurisdiction==='st-louis-city'&&typeof row.recordKey==='string'&&typeof row.parcelKey==='string').map(row=>({...row,resultKind:'parcel'}));
    },{signal,timeoutMs}),searchCounty(plan,signal)];
    const settled=await Promise.allSettled(jobs);
    if(signal?.aborted||settled.some(result=>result.status==='rejected'&&result.reason?.name==='AbortError'))throw abortError();
    const city=settled[0].status==='fulfilled'?settled[0].value:[],county=settled[1].status==='fulfilled'?settled[1].value:null;
    const sources=settled.map((result,index)=>{
      const source=index===0?(city[0]?.source||CITY_SOURCE):(county?.source||COUNTY_ADDRESS_SOURCE);
      if(result.status==='rejected')return {jurisdiction:source.jurisdiction||(index?'st-louis-county':'st-louis-city'),status:'unavailable',source,reason:result.reason instanceof SearchFailure?result.reason.message:`${index?'County address service':'City parcel index'} is unavailable. Try again.`};
      return {jurisdiction:index?'st-louis-county':'st-louis-city',status:'ready',source,...(index&&county.truncated?{truncated:true,reason:'More County matches exist. Add a street number, municipality, or ZIP code.'}:{}),...(index&&county.invalidCount?{rejectedCount:county.invalidCount}:{}),...(!index&&skipCity?{skipped:true,reason:plan.municipalityCode?'City search was not queried for a County municipality.':'City search was not queried: the snapshot has no ZIP search field; enter a street address.'}:{}),...(!index&&plan.postalCode&&!skipCity?{reason:'City matches use street address only; ZIP is unavailable in the snapshot.'}:{})};
    });
    return {results:mergeResults(city,county?.results||[],plan,limit),sources,partial:sources.some(source=>source.status==='unavailable'||source.truncated||source.rejectedCount>0)};
  };
}
export const searchRegionalAddresses=createRegionalAddressSearch();
// MUNITEXT coded values from the County layer metadata, verified 2026-09-09.
// Mailing city is separate from municipal jurisdiction; it is never substituted.
const MUNICIPALITIES = Object.freeze({"BAL":"BALLWIN","BLV":"BELLA VILLA","BFN":"BELLEFONTAINE NEIGHBORS","BLN":"BEL-NOR","BLR":"BEL-RIDGE","BRK":"BERKELEY","BEV":"BEVERLY HILLS","BKJ":"BLACK JACK","BRH":"BRECKENRIDGE HILLS","BRW":"BRENTWOOD","BRG":"BRIDGETON","CAL":"CALVERTON PARK","CMP":"CHAMP","CHA":"CHARLACK","CHF":"CHESTERFIELD","CLK":"CLARKSON VALLEY","CLY":"CLAYTON","COV":"COOL VALLEY","CCH":"COUNTRY CLUB HILLS","CLA":"COUNTRY LIFE ACRES","CRE":"CRESTWOOD","CLP":"CRYSTAL LAKE PARK","DEL":"DELLWOOD","DES":"DES PERES","EDM":"EDMUNDSON","ELV":"ELLISVILLE","EUR":"EUREKA","FEN":"FENTON","FER":"FERGUSON","FLH":"FLORDELL HILLS","FLO":"FLORISSANT","FRT":"FRONTENAC","GEP":"GLEN ECHO PARK","GLN":"GLENDALE","GWV":"GRANTWOOD VILLAGE","GPK":"GREEN PARK","GRN":"GREENDALE","HLH":"HANLEY HILLS","HAZ":"HAZELWOOD","HLD":"HILLSDALE","HUN":"HUNTLEIGH","JEN":"JENNINGS","KRW":"KIRKWOOD","LAD":"LADUE","LAK":"LAKESHIRE","MAC":"MACKENZIE","MAN":"MANCHESTER","MPL":"MAPLEWOOD","MRB":"MARLBOROUGH","MRH":"MARYLAND HEIGHTS","MOL":"MOLINE ACRES","NOR":"NORMANDY","NTH":"NORTHWOODS","NWC":"NORWOOD COURT","OAK":"OAKLAND","OLV":"OLIVETTE","OVR":"OVERLAND","PAC":"PACIFIC","PGD":"PAGEDALE","PAH":"PASADENA HILLS","PAP":"PASADENA PARK","PIN":"PINE LAWN","RMH":"RICHMOND HEIGHTS","RIV":"RIVERVIEW","RKH":"ROCK HILL","SHR":"SHREWSBURY","STA":"ST ANN","STJ":"ST JOHN","SUN":"SUNSET HILLS","SYC":"SYCAMORE HILLS","TAC":"TOWN & COUNTRY","TWO":"TWIN OAKS","UNI":"UNINCORPORATED","UCT":"UNIVERSITY CITY","UPL":"UPLANDS PARK","VEL":"VELDA CITY","VEH":"VELDA VILLAGE HILLS","VIP":"VINITA PARK","WAR":"WARSON WOODS","WEB":"WEBSTER GROVES","WEL":"WELLSTON","WES":"WESTWOOD","WIL":"WILBUR PARK","WWD":"WILDWOOD","WIN":"WINCHESTER","WOD":"WOODSON TERRACE","CCR":"CREVE COEUR","VAL":"VALLEY PARK","KIN":"KINLOCH","STL":"SAINT LOUIS","BRV":"BELLERIVE ACRES","WPD":"WASHINGTON UNIVERSITY","OFA":"OFALLON","JEF":"JEFFERSON COUNTY","FRA":"FRANKLIN COUNTY","MAD":"MADISON COUNTY","SCC":"ST CHARLES COUNTY","STP":"ST PETERS"});
