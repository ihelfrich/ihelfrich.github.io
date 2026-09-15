const FILE='/st-louis/valuation/market-context.json';
const SOURCE='https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_po_metro.txt';
const NAME='FHFA purchase-only HPI — St. Louis, MO-IL — not seasonally adjusted';
const DEFAULT_FETCH=(...args)=>fetch(...args),cache=new WeakMap();
const ordinal=r=>r.year*4+r.quarter-1;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function timestamp(value){if(typeof value!=='string')return false;const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);if(!m)return false;const[y,month,day,hour,minute,second]=m.slice(1).map(Number);return month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(y,month,0)).getUTCDate()&&hour<24&&minute<60&&second<60&&Number.isFinite(Date.parse(value));}
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
function withSignal(promise,signal){aborted(signal);if(!signal)return promise;return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}
function validate(raw){
 const s=raw?.source;
 if(raw?.schema!=='property-market-context-v1'||s?.id!=='fhfa-hpi-purchase-only-st-louis-metro'||s.url!==SOURCE||s.catalogUrl!=='https://www.fhfa.gov/data/hpi/datasets'||s.methodologyUrl!=='https://www.fhfa.gov/faqs/hpi'||s.cbsa!=='41180'||s.seriesName!==NAME||s.geography!=='St. Louis, MO-IL metropolitan statistical area'||s.measure!=='purchase-only'||s.seasonalAdjustment!=='not-seasonally-adjusted'||s.nominal!==true||s.forecast!==false||s.sourcePublishedAt!==null||s.indexBase?.period!=='1991Q1'||s.indexBase.value!==100||s.sourceFields?.year!=='yr'||s.sourceFields?.quarter!=='qtr'||s.sourceFields?.index!=='index_nsa'||!timestamp(s.retrievedAt)||!Number.isSafeInteger(s.sourceBytes)||s.sourceBytes<1||s.sourceBytes>2000000||!/^[a-f0-9]{64}$/.test(s.sourceSha256)||!Array.isArray(raw.observations)||!raw.observations.length||raw.observations.length>500)throw Error('Historical market context source cannot be verified.');
 const observations=raw.observations.map((r,i)=>{if(!Number.isInteger(r?.year)||r.year<1991||r.year>2100||!Number.isInteger(r.quarter)||r.quarter<1||r.quarter>4||r.period!==`${r.year}Q${r.quarter}`||!finite(r.index)||r.index<=0||i>0&&ordinal(r)!==ordinal(raw.observations[i-1])+1)throw Error('Historical market index quarter is invalid or incomplete.');return Object.freeze({period:r.period,year:r.year,quarter:r.quarter,index:r.index});});
 if(observations[0].period!=='1991Q1'||observations[0].index!==100)throw Error('Historical market index base cannot be verified.');
 const latest=observations.at(-1),retrieved=new Date(s.retrievedAt);
 if(['period','year','quarter','index'].some(k=>raw.latest?.[k]!==latest[k])||ordinal(latest)>retrieved.getUTCFullYear()*4+Math.floor(retrieved.getUTCMonth()/3))throw Error('Latest historical market period differs from its observations.');
 const byPeriod=new Map(observations.map(r=>[r.period,r.index])),changes={};
 for(const[key,years]of[['oneYearPct',1],['threeYearAnnualizedPct',3],['fiveYearAnnualizedPct',5]]){const prior=byPeriod.get(`${latest.year-years}Q${latest.quarter}`),value=prior===undefined?null:((latest.index/prior)**(1/years)-1)*100;if(value===null?raw.changes?.[key]!==null:!finite(raw.changes?.[key])||Math.abs(raw.changes[key]-value)>1e-9)throw Error('Historical market growth calculation cannot be verified.');changes[key]=value;}
 if(!Array.isArray(raw.limitations)||raw.limitations.length<3||raw.limitations.length>20||raw.limitations.some(x=>typeof x!=='string'||x.length>2000))throw Error('Historical market context limitations are missing.');
 // Explicit allowlisting prevents fetched data from adding a house estimate or
 // forecast to the market-context model returned to the interface.
 const source=Object.freeze({id:s.id,url:s.url,catalogUrl:s.catalogUrl,methodologyUrl:s.methodologyUrl,retrievedAt:s.retrievedAt,sourcePublishedAt:null,httpLastModified:typeof s.httpLastModified==='string'?s.httpLastModified:null,sourceBytes:s.sourceBytes,sourceSha256:s.sourceSha256,seriesName:s.seriesName,cbsa:s.cbsa,geography:s.geography,measure:s.measure,seasonalAdjustment:s.seasonalAdjustment,nominal:true,forecast:false,indexBase:Object.freeze({period:'1991Q1',value:100})});
 return Object.freeze({source,observations:Object.freeze(observations),latest,changes:Object.freeze(changes),limitations:Object.freeze([...raw.limitations])});
}
/** Lazy historical context only. A failed fetch or validation is evicted so a
 * subsequent call retries. Caller cancellation does not cancel another reader. */
export async function loadPropertyMarketContext({fetchImpl=DEFAULT_FETCH,signal}={}){
 aborted(signal);if(typeof fetchImpl!=='function')throw TypeError('A fetch function is required.');
 let pending=cache.get(fetchImpl);
 if(!pending){const controller=new AbortController();let timer;
  const work=(async()=>{const response=await fetchImpl(FILE,{signal:controller.signal});if(!response.ok)throw Error('Historical market context is unavailable.');if(Number(response.headers?.get?.('content-length'))>100000)throw Error('Historical market context exceeds its size budget.');const body=await response.text();if(new TextEncoder().encode(body).length>100000)throw Error('Historical market context exceeds its size budget.');return validate(JSON.parse(body));})();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Historical market context timed out.'));},8000);});
  pending=Promise.race([work,deadline]).catch(error=>{if(cache.get(fetchImpl)===pending)cache.delete(fetchImpl);throw error;}).finally(()=>clearTimeout(timer));cache.set(fetchImpl,pending);
 }
 return withSignal(pending,signal);
}
