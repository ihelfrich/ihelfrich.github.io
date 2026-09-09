const radians=value=>value*Math.PI/180;
export function distanceMeters(a,b) {
  const lat=radians(b.latitude-a.latitude),lon=radians(b.longitude-a.longitude);
  const h=Math.sin(lat/2)**2+Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(lon/2)**2;
  return 6371008.8*2*Math.atan2(Math.sqrt(Math.max(0,Math.min(1,h))),Math.sqrt(Math.max(0,1-h)));
}
/** Counts cover all matches; the display budget is explicit and never a coverage estimate. */
export function inventoryView(listings,{point,query='',radiusMeters=2000,markerLimit=250}={}) {
  if(!point||!Number.isFinite(point.longitude)||!Number.isFinite(point.latitude)||Math.abs(point.longitude)>180||Math.abs(point.latitude)>90)throw new RangeError('A map center is required.');
  if(!Number.isFinite(radiusMeters)||radiusMeters<0||!Number.isSafeInteger(markerLimit)||markerLimit<0||markerLimit>1000)throw new RangeError('Invalid inventory display bounds.');
  const words=String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matching=listings.filter(l=>words.every(w=>[l.address,l.parcelId,l.usage,l.propertyType].filter(Boolean).join(' ').toLowerCase().includes(w))).map(listing=>({listing,distance:Number.isFinite(listing.longitude)&&Number.isFinite(listing.latitude)?distanceMeters(point,listing):null})).filter(r=>r.distance!==null && (radiusMeters===0 || r.distance<=radiusMeters)).sort((a,b)=>a.distance-b.distance||String(a.listing.id).localeCompare(String(b.listing.id)));
  const priced=matching.filter(r=>Number.isFinite(r.listing.askingPrice)&&r.listing.askingPrice>0);
  return {matchingCount:matching.length,markers:matching.slice(0,markerLimit).map(r=>r.listing),records:matching.slice(0,50),hiddenMarkerCount:Math.max(0,matching.length-markerLimit),pricedCount:priced.length,unknownPriceCount:matching.length-priced.length,knownAskingVolumeUSD:priced.length?priced.reduce((sum,r)=>sum+r.listing.askingPrice,0):null};
}
