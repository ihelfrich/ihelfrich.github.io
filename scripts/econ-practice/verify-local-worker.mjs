// Run against an isolated Wrangler --local service, never production.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
const origin='http://127.0.0.1:8788',bank=new Map(buildBank().map(q=>[q.id,q]));
async function call(path,data,token,status=200){
 const r=await fetch(origin+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});
 const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b;
}
const health=await call('/health');
const p=await call('/profiles',{accepted:true,consentVersion:health.consentVersion});
const other=await call('/profiles',{accepted:true,consentVersion:health.consentVersion});
const session=await call('/sessions',{course:'ap-micro',unit:1,topic:'1.1',mode:'assessment'},p.token);
let count=0,terminal;
for(let i=0;i<37;i++){
 const next=await call(`/sessions/${session.sessionId}/next`,{},p.token);if(next.done){terminal=next;break;}
 const repeat=await call(`/sessions/${session.sessionId}/next`,{},p.token);assert.equal(repeat.presentationId,next.presentationId);
 const q=bank.get(next.item.id),response=q.format==='choice'?q.answerIndex:q.format==='multipart'?Object.fromEntries(q.parts.map(p=>[p.id,p.answer])):q.answer;
 const event={eventId:crypto.randomUUID(),presentationId:next.presentationId,attemptNumber:1,response,elapsedMs:5000,activeMs:4500,submittedAt:new Date().toISOString()};
 await call(`/sessions/${session.sessionId}/answers`,event,other.token,404);
 const receipt=await call(`/sessions/${session.sessionId}/answers`,event,p.token);assert.equal(receipt.persisted,true);assert.equal(receipt.correct,undefined);
 const retry=await call(`/sessions/${session.sessionId}/answers`,event,p.token);assert.equal(receipt.receipt,retry.receipt);count++;
}
assert.ok(terminal);assert.equal(terminal.reason,'maximum-length');
await call(`/sessions/${session.sessionId}/complete`,{},p.token);
const report=await call(`/sessions/${session.sessionId}/report`,null,p.token);
assert.equal(report.rows.length,count);assert.ok(report.rows.every(r=>r.correct));assert.equal(report.terminalReason,'maximum-length');assert.equal(report.stoppingPolicy.kind,'unit-precision');
await call('/admin/summary',null,p.token,403);
const out={verifiedAt:new Date().toISOString(),runtime:'Wrangler local workerd + D1',bankVersion:health.bankVersion,assessmentReceipts:count,checks:['Worker entrypoint starts','bank archive and model/stopping pin creation','outstanding presentation idempotency','cross-participant write denied','durable receipt and duplicate retry','assessment feedback withheld until completion','terminal maximum length persisted','report rows equal receipt count','instructor route denied to anonymous'],passed:true,limits:['Local emulation only; no remote D1 verification','No live Google identity or account linking exercised']};
writeFileSync(new URL('../../docs/econ-practice/audits/wrangler-local-verification.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
