import { lookupZoning } from "./city-zoning.mjs";
import { lookupParcel } from './city-parcels.mjs';
import { loadPublicListings } from './city-public-listings.mjs';

/** A listing joins a selected source record on both identifiers, never geometry or address alone. */
export function matchPublicInventory(parcelResult, snapshot) {
  const p=parcelResult?.parcel?.properties;
  if (!p) return {status:'unresolved',listings:[],reason:'Select an exact parcel record first.'};
  if (!snapshot) return {status:'unavailable',listings:[],reason:'Public inventory could not be loaded.'};
  const listings=snapshot.listings.filter(l=>l.parcelKey===p.parcelKey && l.parcelId===p.parcelId);
  return {
    status:listings.length?'matched':'not-in-public-inventory',listings,
    source:snapshot.source,retrievedAt:snapshot.retrievedAt,snapshotStatus:snapshot.snapshotStatus,
    reason:listings.length?'The selected record matches the City land-bank inventory. Verify availability with the official record.':'No matching record in this public land-bank snapshot. Private sale status is unknown.',
  };
}

export function createPropertyLookup({parcelLookup=lookupParcel,zoningLookup=lookupZoning,inventoryLoader=loadPublicListings}={}) {
  let inventoryPromise;
  const inventory=()=>inventoryPromise ||= inventoryLoader().catch(error=>{inventoryPromise=null;throw error;});
  return async function inspectProperty(point,{signal}={}) {
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const [parcelResult,saleResult]=await Promise.allSettled([parcelLookup(point,{signal}),inventory()]);
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const parcels=parcelResult.status==='fulfilled'?parcelResult.value:{status:'unavailable',parcel:null};
    let zoning={status:'unavailable',districts:[],limitations:['Zoning lookup unavailable.']};
    if(zoningLookup)try{zoning=await zoningLookup(point,{parcelResult:parcels,signal});}catch{ /* Preserve parcel evidence when a zoning service fails. */ }
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    return {point:{...point},parcels,zoning,inventory:matchPublicInventory(parcels,saleResult.status==='fulfilled'?saleResult.value:null)};
  };
}
