import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {calculateResidentOffer,forecastResidentValue} from '../../src/lib/property-resident-value.mjs';
import {residentValueReport,residentValueCsv} from '../../src/lib/property-resident-value-report.mjs';
const marketContext=JSON.parse(await readFile(new URL('../../public/st-louis/valuation/market-context.json',import.meta.url),'utf8'));
const inputs=()=>({valueLow:200000,valueHigh:250000,offerPrice:210000,mortgagePayoff:120000,market:{sellingFeePct:6,closingCosts:3000,repairs:10000,concessions:2000,holdingMonths:3,monthlyHoldingCost:1500},offer:{sellingFeePct:1,closingCosts:1000,repairs:0,concessions:500,holdingMonths:1,monthlyHoldingCost:1000}});
const source=()=>({id:'stlco-real-billing-2025-sales',name:'County administrative transfer archive',jurisdiction:'st-louis-county',role:'transfer',url:'https://revenue.stlouisco.com/pdfs/2025/STLCOMO_ASMTROLL_REAL_BILLING_2025.zip',retrievedAt:'2026-09-12T17:29:42Z',sourceDataEditedAt:null,archiveEntryTimestamp:'2025-11-17T09:16:38',maxObservedSaleDateISO:'2025-10-29',limitations:['Fixture source limit: no independent contract or condition verification.']});
function fixture(input=inputs()){
 return {schema:'resident-property-value-report-v1',createdAt:'2026-09-13T20:00:00Z',subject:{address:'9419 FIXTURE AVE',parcelId:'16L640291',recordKey:'st-louis-county-current:16L640291:100'},benchmark:{valueLow:input.valueLow,valueHigh:input.valueHigh,basis:'working-estimate',note:'Resident estimate, revised September 13.'},offer:calculateResidentOffer(input),forecast:forecastResidentValue({valueLow:input.valueLow,valueHigh:input.valueHigh,years:2,rates:{lower:-10,steady:0,higher:10}}),marketContext:structuredClone(marketContext),saleEvidence:{valuation:{status:'not-estimated',reason:'Current value is not established from these transfers.'},coverage:{radiusKm:1.5,fromDate:'2023-09-13',toDate:'2026-09-13',latestObservedSaleDateISO:'2025-10-29',warnings:['Fixture coverage warning: recent transfers may be absent.']},candidates:[{address:'9421 FIXTURE AVE',parcelId:'16L640292',recordKey:'st-louis-county-current:16L640292:101',saleDateISO:'2025-08-12',priceUSD:201000,distanceKm:.125,latestSalePriceStatus:'recorded',latestSaleValidityCode:'V',latestSaleMarketValidityCode:null,latestSaleDateCenturyInferred:true,source:source()}],totalCandidates:3,omittedByLimit:2,exclusionCounts:{'multi-parcel-total':2,'conflicting-price':1},sources:[source()],partial:true},limitations:['Fixture report limitation: benchmark remains unverified.','Fixture report limitation: income taxes are excluded.']};
}
function document(html){const win=new Window();return {win,doc:new win.DOMParser().parseFromString(html,'text/html')};}
function section(doc,title){return [...doc.querySelectorAll('section')].find(node=>node.querySelector('h2')?.textContent===title);}
function csvRows(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\r'&&text[i+1]==='\n'&&!quoted){row.push(field);rows.push(row);row=[];field='';i++;}else field+=c;}assert.equal(quoted,false,'CSV quote state must close');row.push(field);rows.push(row);return rows;}

test('HTML and CSV reproduce independent net-sheet fixture arithmetic and every entered route cost',()=>{
 const data=fixture(),{win,doc}=document(residentValueReport(data));const net=section(doc,'Seller’s pro forma');assert.ok(net);const rows=[...net.querySelectorAll('table:first-of-type tbody tr')].map(tr=>[...tr.children].map(c=>c.textContent));
 assert.deepEqual(rows.find(r=>r[0]==='Net proceeds / cash shortfall'),['Net proceeds / cash shortfall','$48,500','$95,500','$85,400']);
 assert.deepEqual(rows.find(r=>r[0]==='Mortgage payoff'),['Mortgage payoff','-$120,000','-$120,000','-$120,000']);
 const assumptionRows=[...net.querySelectorAll('table')[1].querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(c=>c.textContent));
 const labels={sellingFeePct:'Selling fee (%)',closingCosts:'Other closing costs ($)',repairs:'Repairs ($)',concessions:'Buyer credits ($)',holdingMonths:'Months until closing',monthlyHoldingCost:'Monthly carrying costs ($)'};
 for(const key of Object.keys(inputs().market))assert.deepEqual(assumptionRows.find(r=>r[0]===labels[key]),[labels[key],String(inputs().market[key]),String(inputs().offer[key])]);
 const csv=csvRows(residentValueCsv(data));assert.deepEqual(csv.find(r=>r[0]==='Net proceeds / cash shortfall'),['Net proceeds / cash shortfall','48500','95500','85400']);assert.equal(Number(csv.find(r=>r[0]==='Buyer price matching lower net')[1]),171000/.99);assert.equal(Number(csv.find(r=>r[0]==='Buyer price matching upper net')[1]),218000/.99);win.close();
});
test('print report preserves entered benchmark, scenario endpoints, assumptions and explicit scope limitations',()=>{
 const data=fixture(),{win,doc}=document(residentValueReport(data)),body=doc.body.textContent;
 for(const note of [data.benchmark.note,...data.limitations,...data.offer.conventions,...data.forecast.conventions,...data.saleEvidence.coverage.warnings])assert.ok(body.includes(note),`Missing report assumption or limitation: ${note}`);
 const future=section(doc,'Future-value scenarios');assert.match(future.textContent,/lower -10%, middle 0%, higher 10%/);const row=[...future.querySelectorAll('tbody tr')].find(tr=>tr.children[0].textContent==='2');assert.deepEqual([...row.children].map(c=>c.textContent),['2','$162,000–$202,500','$200,000–$250,000','$242,000–$302,500']);assert.ok(body.includes(data.createdAt));win.close();
});
test('HTML carries source retrieval, archive and observed-sale dates plus source-specific limitations',()=>{
 const data=fixture(),{win,doc}=document(residentValueReport(data)),body=doc.body.textContent;
 for(const note of [data.saleEvidence.sources[0].retrievedAt,data.saleEvidence.sources[0].archiveEntryTimestamp,data.saleEvidence.sources[0].maxObservedSaleDateISO,...data.saleEvidence.sources[0].limitations,...data.marketContext.limitations])assert.ok(body.includes(note),`Source evidence was lost: ${note}`);
 assert.ok([...doc.querySelectorAll('a')].some(a=>a.href===data.saleEvidence.sources[0].url));assert.ok(body.includes(data.marketContext.source.retrievedAt));win.close();
});
test('recorded-transfer export retains qualification codes and exclusion reasons instead of only a price',()=>{
 const data=fixture(),{win,doc}=document(residentValueReport(data)),evidence=section(doc,'Nearby recorded-transfer evidence');assert.ok(evidence.textContent.includes(data.saleEvidence.candidates[0].recordKey));assert.match(evidence.textContent,/unverified|validity|source code/i);assert.match(evidence.textContent,/two.digit|century|interpreted/i);assert.match(evidence.textContent,/multi.parcel.total|multi.parcel/i);assert.match(evidence.textContent,/conflicting.price/i);assert.match(evidence.textContent,/2.*omitted|omitted.*2|1 of 3/i);win.close();
});
test('user notes, source names, property labels and limitations remain text in HTML and safe cells in CSV',()=>{
 const data=fixture();const hostile='=HYPERLINK("https://evil.test/", "click"),\n<img src=x onerror=alert(1)><script>alert(2)</script>&';data.benchmark.note=hostile;data.subject.address='<svg onload=alert(3)>Quoted "house"</svg>';data.limitations.push('<iframe src="https://evil.test/"></iframe>');data.saleEvidence.sources[0].name='<img src=x onerror=alert(4)>';
 const {win,doc}=document(residentValueReport(data));assert.equal(doc.querySelectorAll('script,img,svg,iframe').length,0);assert.ok(doc.body.textContent.includes(hostile));assert.ok(doc.body.textContent.includes(data.subject.address));const parsed=csvRows(residentValueCsv(data));assert.equal(parsed.find(row=>row[0]==='Range note')[1],"'"+hostile);assert.equal(parsed.find(row=>row[0]==='Property')[1],data.subject.address);
 for(const prefix of ['=1+2',' +1','\t@SUM(1,2)','  -1+2']){data.benchmark.note=prefix;assert.equal(csvRows(residentValueCsv(data)).find(row=>row[0]==='Range note')[1],"'"+prefix);}win.close();
});
test('negative proceeds remain signed numbers in CSV and cash-shortfall amounts in HTML',()=>{
 const data=fixture({...inputs(),mortgagePayoff:300000}),csv=residentValueCsv(data),rows=csvRows(csv);assert.deepEqual(rows.find(r=>r[0]==='Net proceeds / cash shortfall'),['Net proceeds / cash shortfall','-131500','-84500','-94600']);assert.ok(csv.includes('"Net proceeds / cash shortfall",-131500,-84500,-94600'));const {win,doc}=document(residentValueReport(data));assert.match(doc.body.textContent,/-\$94,600/);win.close();
});
test('unsafe source URLs never become active links',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','https://user:pass@example.org/']){const data=fixture();data.saleEvidence.sources[0].url=url;data.saleEvidence.candidates[0].source.url=url;data.marketContext.source.url=url;const {win,doc}=document(residentValueReport(data));assert.equal(doc.querySelectorAll('a').length,0);win.close();}
});
test('unsupported report schemas and absent net-sheet calculations are rejected',()=>{
 for(const data of [null,{},[],{...fixture(),schema:'resident-property-value-report-v2'}])for(const render of [residentValueReport,residentValueCsv])assert.throws(()=>render(data),/Unsupported resident report/);
 const data=fixture();data.offer=null;assert.throws(()=>residentValueCsv(data),/Calculate a seller net sheet first/);assert.match(residentValueReport(data),/No seller net sheet was calculated/);
});
test('wrong nested calculation schema and tampered arithmetic are rejected rather than published as results',()=>{
 for(const mutate of [d=>d.offer.schema='foreign-offer-v1',d=>d.offer.offer.net=999999999,d=>d.offer.rows.find(r=>r.id==='net-proceeds').offer=1,d=>d.forecast.schema='foreign-forecast-v1',d=>d.forecast.paths.lower[0].year='<img src=x onerror=alert(1)>']){const data=fixture();mutate(data);assert.throws(()=>residentValueReport(data),/invalid|unsupported|verify|mismatch|calculation/i);}
});
test('an unavailable regional change remains unknown instead of becoming zero percent',()=>{
 const data=fixture();data.marketContext.changes.oneYearPct=null;const {win,doc}=document(residentValueReport(data));const market=section(doc,'Regional market context');assert.doesNotMatch(market.textContent,/latest.year change 0\.00%/i);assert.match(market.textContent,/not supplied|not available|unavailable|unknown/i);win.close();
});
