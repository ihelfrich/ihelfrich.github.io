export const collectionFor=place=>place?.frames?'satellite':'ocean';

// Former folio URLs remain useful: a depth image now opens the live field.
// The other print studies keep their original selection in the Prints tab.
export function atlasQuery(search){
  const q=new URLSearchParams(search);
  if(q.has('study')&&!q.has('place')&&!q.has('region')){
    const depth=/^agulhas-(0|500|1000|2000)$/.exec(q.get('image')||'');
    if(q.get('study')==='depth'){
      q.set('place','agulhas');q.set('depth',depth?.[1]||'0');q.set('layer','currents');q.set('date','2026-10-01T00:00:00Z');
    }else q.set('tab','prints');
  }
  if(q.get('tab')==='satellite'&&!q.has('place')&&!q.has('region')){q.set('place','manaus');q.set('layer','pca');}
  return q;
}
