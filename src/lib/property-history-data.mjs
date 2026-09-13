import {aggregatePropertyActivities} from './property-activity-data.mjs';

const manifestURL='/st-louis/history/manifest.json';
const located=r=>Number.isFinite(r.longitude)&&Number.isFinite(r.latitude);
const day=value=>typeof value==='string'?value.slice(0,10):'';
const validObservationTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(day(value)+'T00:00:00Z').toISOString().slice(0,10)===day(value);
const inside=(r,b)=>!located(r)||r.longitude>=b[0]&&r.longitude<=b[2]&&r.latitude>=b[1]&&r.latitude<=b[3];
const localURL=url=>typeof url==='string'&&/^\/st-louis\/(history|entities)\/[\w./-]+\.json$/.test(url)&&!url.includes('..');

/** A bounded browser reader of immutable observation deltas. A baseline is
 * deliberately never downloaded here and never converted into acquisitions. */
export function createPropertyHistoryData({fetchImpl=(...args)=>fetch(...args),maxPartitions=12,maxEvents=5000,maxBytes=8000000}={}) {
  let disposed=false;const lifecycle=new AbortController();
  async function read(url,signal,sha256=null){
    if(!localURL(url))throw Error('Invalid observation source path.');
    const response=await fetchImpl(url,{signal,cache:'no-cache'});
    if(!response.ok)throw Error('Observation source unavailable.');
    if(Number(response.headers?.get?.('content-length'))>maxBytes)throw Error('Observation partition exceeds the browser budget.');
    const raw=await response.text(),bytes=new TextEncoder().encode(raw);
    if(bytes.length>maxBytes)throw Error('Observation partition exceeds the browser budget.');
    if(sha256){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(digest!==sha256)throw Error('Observation partition checksum mismatch.');}
    return JSON.parse(raw);
  }
  async function query({bounds,level='areas',query='',fromDate=null,toDate=null,signal}={}){
    if(disposed)throw new DOMException('Aborted','AbortError');
    signal=AbortSignal.any([lifecycle.signal,...(signal?[signal]:[]),AbortSignal.timeout(20000)]);
    const manifest=await read(manifestURL,signal);
    if(manifest.schema!=='property-observation-history-v1'||!Array.isArray(manifest.sources))throw Error('Unrecognized observation manifest.');
    const sources=manifest.sources.filter(s=>s.id==='st-louis-county-business-name-indicators');
    if(!sources.length)throw Error('County observation baseline unavailable.');
    const candidates=sources.flatMap(s=>(s.events||[]).map(p=>({...p,source:s})))
      .filter(p=>(!fromDate||day(p.observedAt)>=fromDate)&&(!toDate||day(p.observedAt)<=toDate))
      .sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
    let partial=candidates.length>maxPartitions,scanned=0;const records=[],failures=[];
    const words=query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
    for(const part of candidates.slice(0,maxPartitions)){
      if(scanned>=maxEvents){partial=true;break;}
      try{
        const value=await read(part.url,signal,part.sha256);
        if(value.schema!=='property-observation-events-v1'||value.sourceId!==part.source.id||!Array.isArray(value.events)||value.events.length!==part.eventCount||!validObservationTime(part.observedAt)||value.observedAt!=null&&Date.parse(value.observedAt)!==Date.parse(part.observedAt))throw Error('Observation partition did not reconcile.');
        // Verify every event before allowing any record from this partition to
        // reach the map, even when its display will hit the event budget.
        const identities=new Set();
        for(const event of value.events){
          if(event.sourceId!==part.source.id||!/^owner-observation-(added|changed|removed)$/.test(event.kind)||typeof event.id!=='string'||identities.has(event.id)||
            !Number.isSafeInteger(event.sourceObjectId)||event.sourceObjectId<0||typeof event.parcelId!=='string'||!/^[A-Za-z0-9-]{1,40}$/.test(event.parcelId)||
            event.recordKey!==`st-louis-county-current:${event.parcelId}:${event.sourceObjectId}`||event.parcelKey!==`st-louis-county:${event.parcelId}`||
            event.jurisdiction!=null&&event.jurisdiction!=='st-louis-county'||!event.before&&!event.after||!validObservationTime(event.observedAt)||Date.parse(event.observedAt)!==Date.parse(part.observedAt)||
            (event.longitude!=null||event.latitude!=null)&&(!located(event)||Math.abs(event.longitude)>180||Math.abs(event.latitude)>90))throw Error('Unrecognized observation identity.');
          for(const row of [event.before,event.after].filter(Boolean))for(const key of ['recordKey','parcelKey','parcelId','sourceObjectId'])if(row[key]!=null&&row[key]!==event[key])throw Error('Observation identity changed within a record.');
          identities.add(event.id);
        }
        for(const event of value.events){
          if(++scanned>maxEvents){partial=true;break;}
          if(event.sourceId!==part.source.id||!/^owner-observation-(added|changed|removed)$/.test(event.kind)||typeof event.id!=='string')throw Error('Unrecognized observation identity.');
          const row=event.after||event.before||{},date=day(event.observedAt);
          const record={...event,layerId:'ownership-history',kind:'ownership-observation',date,dateBasis:'observation-date-not-transaction',
            title:event.kind==='owner-observation-changed'?`${event.before?.ownerName||'Previous name'} → ${event.after?.ownerName||'New name'}`:
              `${event.kind.endsWith('added')?'Newly observed indicator':'Indicator no longer observed'} · ${row.ownerName||event.parcelId||event.recordKey}`,
            ownerName:row.ownerName,address:event.address||row.address||null,value:null,color:'#e6bc77',pixelSize:9,original:event};
          if(!inside(record,bounds)||fromDate&&date<fromDate||toDate&&date>toDate)continue;
          if(!words.every(w=>[record.title,record.address,record.parcelId,record.recordKey].join(' ').toLowerCase().includes(w)))continue;
          records.push(record);
        }
      }catch(error){if(signal.aborted)throw error;partial=true;failures.push(error.message);}
    }
    const features=aggregatePropertyActivities(records.filter(located),{level});
    const unhealthy=sources.some(s=>!['healthy','ready','success','baseline'].includes(s.status));
    return {records,features,partial:partial||unhealthy,health:manifest.sources,layers:[{id:'ownership-history',label:'Ownership observations',
      count:records.length,mappedCount:records.filter(located).length,unmappedCount:records.filter(r=>!located(r)).length,
      status:failures.length?'partial':unhealthy?'collection-needs-attention':!candidates.length?(sources.some(s=>s.events?.length)?'no-matching-observations':'baseline-only'):'ready',
      source:{url:manifestURL,retrievedAt:sources[0].lastSuccessAt},baselineObservedAt:sources[0].baselineObservedAt,
      coverage:'Observed name-indicator changes since the saved baseline. Dates refer to collection, not deeds or purchases.',
      partial:partial||unhealthy,historyWindow:{availablePartitions:candidates.length,partitionLimit:maxPartitions,eventLimit:maxEvents,scanned},
      error:failures.join(' '),limitations:sources.flatMap(s=>s.limitations||[])}],counts:{records:records.length}};
  }
  return {query,health:signal=>read(manifestURL,signal),entities:signal=>read('/st-louis/entities/registry.json',signal),dispose(){disposed=true;lifecycle.abort();}};
}
