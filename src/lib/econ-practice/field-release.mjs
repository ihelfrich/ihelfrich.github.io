import {auditFieldExpansions} from './field-expansions.mjs';
const reviewed='content-reviewed-provisional';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const sameUniqueIds=(ids,expected)=>Array.isArray(ids)&&ids.length===expected.length&&new Set(ids).size===ids.length&&expected.every(id=>ids.includes(id));
// Browser-safe inventory gate. Build-time checks separately verify exact file bytes.
export function auditFieldRelease(items,release,extensions=[]){
 const errors=[];
 if(!Array.isArray(items)||!items.length||!release||typeof release!=='object')return ['Missing field release inventory'];
 if(release.reviewStatus!==reviewed||!hash(release.sourceSHA256))errors.push('Invalid base review status or source hash');
 if(items.length!==release.itemCount||new Set(items.map(q=>q.id)).size!==items.length||!sameUniqueIds(release.reviewedIds,items.map(q=>q.id)))errors.push('Base review membership mismatch');
 if(items.some(q=>q.course!==release.course))errors.push('Base review course mismatch');
 if(!Array.isArray(extensions))return [...errors,'Invalid extension inventory'];
 if(extensions.length){
  const audit=auditFieldExpansions(items,extensions),review=release.extensions;
  errors.push(...audit.errors);
  if(!review||review.reviewStatus!==reviewed||!hash(review.sourceSHA256)||review.itemCount!==audit.items||!sameUniqueIds(review.reviewedBaseIds,extensions.map(e=>e.baseId)))errors.push('Extension review membership, status or hash mismatch');
 }else if(release.extensions)errors.push('Missing released extensions');
 return errors;
}
