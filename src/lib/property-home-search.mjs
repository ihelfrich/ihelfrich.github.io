import {LISTING_PROPERTY_TYPES,MAX_LISTING_ROWS} from './estate-analysis.mjs';
import {PROPERTY_REGION_BOUNDS} from './property-region-catalog.mjs';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const missing=value=>value===null||value===undefined||value==='';
const hasId=record=>object(record)&&typeof record.id==='string'&&record.id.trim()!=='';
const criteriaKeys=new Set(['minPrice','maxPrice','minBeds','minBaths','minLivingArea','propertyType']);

/** Pure candidate screening, not verification of availability or a property join.
 *
 * Criteria: minPrice/maxPrice (asking USD), minBeds (integer 0..100),
 * minBaths (0..100), minLivingArea (0..1e7 square feet), and propertyType
 * ('any' or a LISTING_PROPERTY_TYPES value). Null/undefined means unset.
 * Only explicit active/available statuses and points within the inclusive
 * City+County bounding box qualify; the box does not assert jurisdiction.
 *
 * Unknown housing fields and unpublished prices remain eligible when their
 * criterion is unset. No value is inferred from assessment, usage or zoning.
 * Raw source types such as 'Structure' are unknown for a specific type filter.
 * All duplicate exact IDs are withheld, not merged. Successful rows are the
 * original objects in input order, retaining source IDs and dates unchanged.
 *
 * Each excluded row has one primary reason, in validation/filter order.
 * counts.unknown is the subset excluded for missing/unrecognized required
 * evidence, not all rows with any missing optional field. Thus exclusions sum
 * to excluded, matched+excluded=input, and unknown<=excluded. More than 5000
 * records is an explicit error, never a silently partial candidate result.
 */
export function filterHomeCandidates(listings,criteria={}){
 if(!Array.isArray(listings))throw new TypeError('Listings must be an array.');
 if(listings.length>MAX_LISTING_ROWS)throw new RangeError(`Home search supports at most ${MAX_LISTING_ROWS} listing records per request.`);
 if(!object(criteria))throw new TypeError('Home criteria must be an object.');
 for(const key of Object.keys(criteria))if(!criteriaKeys.has(key))throw new RangeError(`Unsupported home criterion: ${key}.`);
 const active=key=>criteria[key]!==undefined&&criteria[key]!==null;
 for(const[key,max,integer]of [['minPrice',Infinity,false],['maxPrice',Infinity,false],['minBeds',100,true],['minBaths',100,false],['minLivingArea',10000000,false]]){
  const value=criteria[key];if(active(key)&&(!finite(value)||value<0||value>max||(integer&&!Number.isInteger(value))))throw new RangeError(`Invalid ${key} criterion.`);
 }
 if(active('minPrice')&&active('maxPrice')&&criteria.minPrice>criteria.maxPrice)throw new RangeError('Minimum asking price cannot exceed maximum asking price.');
 const type=criteria.propertyType??'any';
 if(type!=='any'&&!LISTING_PROPERTY_TYPES.includes(type))throw new RangeError('Use any or an explicit supported property type.');
 const frequencies=new Map();for(const record of listings)if(hasId(record))frequencies.set(record.id,(frequencies.get(record.id)||0)+1);
 const candidates=[],exclusions={},counts={input:listings.length,matched:0,excluded:0,unknown:0};
 const reject=(reason,unknown=false)=>{exclusions[reason]=(exclusions[reason]||0)+1;counts.excluded++;if(unknown)counts.unknown++;};
 const[w,s,e,n]=PROPERTY_REGION_BOUNDS;
 for(const record of listings){
  if(!object(record)){reject('invalid-record');continue;}
  if(!hasId(record)){reject('unknown-listing-id',true);continue;}
  if(frequencies.get(record.id)>1){reject('duplicate-listing-id');continue;}
  if(missing(record.status)){reject('unknown-status',true);continue;}
  if(record.status!=='active'&&record.status!=='available'){reject('not-available');continue;}
  if(missing(record.longitude)||missing(record.latitude)){reject('unknown-location',true);continue;}
  if(!finite(record.longitude)||!finite(record.latitude)||Math.abs(record.longitude)>180||Math.abs(record.latitude)>90){reject('invalid-location');continue;}
  if(record.longitude<w||record.longitude>e||record.latitude<s||record.latitude>n){reject('outside-supported-area');continue;}
  const price=record.askingPrice;
  if(!missing(price)&&(!finite(price)||price<=0)){reject('invalid-price');continue;}
  if(active('minPrice')||active('maxPrice')){
   if(missing(price)){reject('unknown-price',true);continue;}
   if(active('minPrice')&&price<criteria.minPrice){reject('below-min-price');continue;}
   if(active('maxPrice')&&price>criteria.maxPrice){reject('above-max-price');continue;}
  }
  let excluded=false;
  for(const[key,field,reason,max,integer,positive]of [['minBeds','beds','beds',100,true,false],['minBaths','baths','baths',100,false,false],['minLivingArea','livingAreaSqFt','living-area',10000000,false,true]]){
   if(!active(key))continue;
   const value=record[field];
   if(missing(value)){reject(`unknown-${reason}`,true);excluded=true;break;}
   if(!finite(value)||value<0||(positive&&value===0)||value>max||(integer&&!Number.isInteger(value))){reject(`invalid-${reason}`);excluded=true;break;}
   if(value<criteria[key]){reject(`below-min-${reason}`);excluded=true;break;}
  }
  if(excluded)continue;
  if(type!=='any'){
   if(!LISTING_PROPERTY_TYPES.includes(record.propertyType)){reject('unknown-property-type',true);continue;}
   if(record.propertyType!==type){reject('different-property-type');continue;}
  }
  candidates.push(record);
 }
 counts.matched=candidates.length;
 return {candidates,counts,exclusions};
}
