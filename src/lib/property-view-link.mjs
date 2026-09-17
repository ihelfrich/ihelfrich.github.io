import {validAtlasBounds} from './property-region-data.mjs';
import {PROPERTY_LENSES,propertyPeriod} from './property-workspace-data.mjs';

const PREFIX='#evidence=',MAX_HASH_BYTES=4096;
const FIELDS=['version','lens','bounds','layers','query','fromDate','toDate','material','level'];
const MATERIALS=new Set(['all','lead','non-lead','unknown','galvanized-replacement']);
const bytes=value=>new TextEncoder().encode(value).byteLength;

/** Links store criteria only. Sources are queried again on opening; neither
 * observations, private notes nor a historical snapshot travel in the URL. */
function normalizedState(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||FIELDS.some(key=>!Object.hasOwn(input,key)))
    throw new RangeError('The evidence view is missing required filters.');
  const {version,lens,bounds,layers,query,fromDate,toDate,material,level}=input;
  if(version!==1)throw new RangeError('This evidence view version is not supported.');
  if(typeof lens!=='string'||!Object.hasOwn(PROPERTY_LENSES,lens))throw new RangeError('Choose a supported evidence question.');
  if(!validAtlasBounds(bounds))throw new RangeError('Choose a valid geographic area.');
  if(!Array.isArray(layers)||layers.length>PROPERTY_LENSES[lens].layers.length||new Set(layers).size!==layers.length||
    [...layers].some(id=>typeof id!=='string'||!PROPERTY_LENSES[lens].layers.includes(id)))
    throw new RangeError('The selected sources do not belong to this evidence question.');
  if(typeof query!=='string'||query.length>160)throw new RangeError('The evidence search must contain at most 160 characters.');
  if(![fromDate,toDate].every(value=>value===null||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)))
    throw new RangeError('Choose a valid calendar date range.');
  const dates=propertyPeriod('custom',fromDate,toDate);
  if(!MATERIALS.has(material)||lens!=='utilities'&&material!=='all')
    throw new RangeError('The material filter is not valid for this evidence question.');
  if(lens==='utilities'&&(dates.fromDate!==null||dates.toDate!==null))
    throw new RangeError('Utility inventory views cannot carry event-date filters.');
  if(level!=='areas'&&level!=='properties')throw new RangeError('Choose a supported map detail level.');
  // Explicit construction prevents extra fields and custom toJSON methods from
  // adding records or notes to the public link. Arrays are copied as well.
  return {version:1,lens,bounds:[...bounds],layers:[...layers],query,...dates,material,level};
}

/** Return an absolute URL, or throw RangeError without returning a partial link. */
export function createPropertyViewUrl(state,baseURL){
  const normalized=normalizedState(state);
  let url;
  try{
    if(typeof baseURL!=='string'&&!(baseURL instanceof URL))throw new Error();
    if(typeof baseURL==='string'&&/[\u0000-\u0020\u007f]/.test(baseURL))throw new Error();
    url=new URL(baseURL);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error();
  }catch{throw new RangeError('Choose an HTTP or HTTPS site URL without credentials.');}
  const hash=PREFIX+encodeURIComponent(JSON.stringify(normalized));
  if(bytes(hash)>MAX_HASH_BYTES)throw new RangeError('The evidence view link is too large.');
  url.pathname='/st-louis/';url.search='?area=region&workspace=activity';url.hash=hash;
  return url.href;
}

/** Ignore other app fragments; an owned but invalid link is an explicit error. */
export function readPropertyViewHash(hash){
  if(typeof hash!=='string'||!hash.startsWith(PREFIX))return null;
  if(bytes(hash)>MAX_HASH_BYTES)return {ok:false,error:'The evidence view link is too large.'};
  try{
    const state=normalizedState(JSON.parse(decodeURIComponent(hash.slice(PREFIX.length))));
    return {ok:true,state};
  }catch(error){
    return {ok:false,error:error instanceof RangeError?error.message:'The evidence view link is malformed.'};
  }
}
