import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadPropertyMarketContext} from '../../src/lib/property-market-context.mjs';
const original=JSON.parse(await readFile(new URL('../../public/st-louis/valuation/market-context.json',import.meta.url),'utf8'));
const fixture=()=>structuredClone(original);
const response=data=>new Response(JSON.stringify(data));
test('published purchase-only NSA observations reproduce exact same-quarter trailing growth',async()=>{
 const calls=[],fetchImpl=async(...args)=>{calls.push(args);return response(original);};const result=await loadPropertyMarketContext({fetchImpl});assert.equal(calls.length,1);assert.equal(calls[0][0],'/st-louis/valuation/market-context.json');assert.equal(result.source.cbsa,'41180');assert.equal(result.source.forecast,false);assert.equal(result.source.seasonalAdjustment,'not-seasonally-adjusted');assert.equal(result.latest.period,original.observations.at(-1).period);assert.equal(result.observations.length,original.observations.length);
 for(const [field,years]of[['oneYearPct',1],['threeYearAnnualizedPct',3],['fiveYearAnnualizedPct',5]]){const prior=result.observations.find(x=>x.year===result.latest.year-years&&x.quarter===result.latest.quarter);assert.equal(result.changes[field],((result.latest.index/prior.index)**(1/years)-1)*100);}
 assert.equal(await loadPropertyMarketContext({fetchImpl}),result);assert.equal(calls.length,1);assert.ok(Object.isFrozen(result.observations));
});
test('all-transactions, seasonally-adjusted, foreign-geography and unsafe source claims fail',async()=>{
 for(const change of [r=>r.source.cbsa='12345',r=>r.source.measure='all-transactions',r=>r.source.seasonalAdjustment='seasonally-adjusted',r=>r.source.sourceFields.index='index_sa',r=>r.source.url='https://www.fhfa.gov.evil.test/data',r=>r.source.forecast=true]){const value=fixture();change(value);await assert.rejects(loadPropertyMarketContext({fetchImpl:async()=>response(value)}),/cannot be verified/);}
});
test('missing/duplicated quarters, invalid indices, fabricated growth and future observations fail',async()=>{
 for(const change of [r=>r.observations.splice(10,1),r=>r.observations.splice(10,0,r.observations[10]),r=>r.observations[10].index=null,r=>r.observations[10].index='120',r=>r.observations[10].index=0,r=>r.latest.index++,r=>r.changes.oneYearPct++,r=>r.source.retrievedAt='1991-01-01T00:00:00Z',r=>r.source.retrievedAt='2026-02-30T00:00:00Z']){const value=fixture();change(value);await assert.rejects(loadPropertyMarketContext({fetchImpl:async()=>response(value)}));}
});
test('a rejected response and a malformed successful response both retry on the next call',async()=>{
 for(const first of [new Response('',{status:503}),response({...fixture(),schema:'wrong'})]){let calls=0;const fetchImpl=async()=>++calls===1?first:response(original);await assert.rejects(loadPropertyMarketContext({fetchImpl}));assert.equal((await loadPropertyMarketContext({fetchImpl})).source.cbsa,'41180');assert.equal(calls,2);}
});
test('caller abort returns immediately while another caller can finish the shared request',async()=>{
 let deliver;const fetchImpl=()=>new Promise(resolve=>deliver=resolve);const controller=new AbortController();const pending=loadPropertyMarketContext({fetchImpl,signal:controller.signal});const other=loadPropertyMarketContext({fetchImpl});controller.abort();await assert.rejects(pending,{name:'AbortError'});deliver(response(original));assert.equal((await other).source.cbsa,'41180');
});
test('an already aborted request performs no retrieval and payload size is bounded',async()=>{
 let called=false;const controller=new AbortController();controller.abort();await assert.rejects(loadPropertyMarketContext({fetchImpl:async()=>{called=true;},signal:controller.signal}),{name:'AbortError'});assert.equal(called,false);await assert.rejects(loadPropertyMarketContext({fetchImpl:async()=>new Response('x'.repeat(100001))}),/size budget/);
});
test('unexpected property estimates and future scenarios are not exposed by the whitelist',async()=>{
 const value=fixture();value.currentHomeValue=800000;value.forecast={year:2030,value:2000000};value.source.salesRecommendation='sell';value.observations[0].forecast=9999;const result=await loadPropertyMarketContext({fetchImpl:async()=>response(value)});assert.equal(result.currentHomeValue,undefined);assert.equal(result.forecast,undefined);assert.equal(result.source.salesRecommendation,undefined);assert.equal(result.observations[0].forecast,undefined);
});
