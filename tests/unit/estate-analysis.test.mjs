import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateProForma,parseListingsCsv,summarizeListings,filterListings,MAX_LISTING_ROWS,MAX_CSV_BYTES} from '../../src/lib/estate-analysis.mjs';
const assumptions={purchasePrice:125000,rehab:10000,closingCosts:5000,rentMonthly:1500,otherIncomeMonthly:100,vacancyPct:5,operatingExpensesAnnual:6000,capexReserveAnnual:1200,ltvPct:80,interestPct:6,loanYears:30};
const header='listing_id,address,latitude,longitude,asking_price,status,source,as_of,parcel_id';
const row=(extra={})=>({listing_id:'SYNTHETIC-1',address:'1 Fictional Fixture Way',latitude:'38.628',longitude:'-90.193',asking_price:'250000',status:'active',source:'Synthetic Test Feed',as_of:'2026-09-08',parcel_id:'TEST-PARCEL-1',...extra});
const escape=v=>/[",\r\n]/.test(String(v))?'"'+String(v).replaceAll('"','""')+'"':String(v);
const csv=(rows,columns=header.split(','))=>columns.join(',')+'\r\n'+rows.map(r=>columns.map(k=>escape(r[k]??'')).join(',')).join('\r\n')+'\r\n';
test('100k loan at 6 percent for 30 years matches a literal amortization fixture',()=>{
 const p=calculateProForma(assumptions);assert.equal(p.loanPrincipal,100000);assert.ok(Math.abs(p.monthlyPayment-599.5505251527528)<1e-9);assert.ok(Math.abs(p.debtServiceAnnual-7194.606301833034)<1e-8);
});
test('vacancy, NOI, reserves and equity are separated without a market-rent default',()=>{
 const p=calculateProForma(assumptions);assert.equal(p.grossPotentialAnnual,19200);assert.equal(p.effectiveGrossIncomeAnnual,18240);assert.equal(p.noiAnnual,12240);assert.equal(p.reservesAnnual,1200);assert.equal(p.equityRequired,40000);assert.equal(p.capRate,9.792);assert.ok(Math.abs(p.cashFlowAnnual-3845.393698166966)<1e-8);assert.ok(Math.abs(p.cashOnCash-9.613484245417415)<1e-9);assert.ok(Math.abs(p.breakEvenOccupancy-74.97190782204705)<1e-8);
});
test('zero and vanishing interest approach equal principal installments',()=>{
 const zero=calculateProForma({...assumptions,interestPct:0}),tiny=calculateProForma({...assumptions,interestPct:1e-10});assert.ok(Math.abs(zero.monthlyPayment-277.77777777777777)<1e-10);assert.ok(Math.abs(tiny.monthlyPayment-zero.monthlyPayment)<1e-6);
});
test('no debt, zero equity and zero income preserve undefined ratios as null',()=>{
 const debtFree=calculateProForma({...assumptions,ltvPct:0});assert.equal(debtFree.debtServiceAnnual,0);assert.equal(debtFree.dscr,null);assert.equal(debtFree.cashFlowAnnual,11040);
 const zeroEquity=calculateProForma({...assumptions,ltvPct:100,rehab:0,closingCosts:0});assert.equal(zeroEquity.equityRequired,0);assert.equal(zeroEquity.cashOnCash,null);
 const noIncome=calculateProForma({...assumptions,rentMonthly:0,otherIncomeMonthly:0});assert.equal(noIncome.effectiveGrossIncomeAnnual,0);assert.equal(noIncome.noiAnnual,-6000);assert.equal(noIncome.breakEvenOccupancy,null);
 assert.equal(calculateProForma({...assumptions,purchasePrice:0}).capRate,null);
});
test('invalid or omitted assumptions are rejected and impossible occupancy is not capped',()=>{
 for(const patch of [{rehab:-1},{rentMonthly:NaN},{closingCosts:undefined},{vacancyPct:101},{ltvPct:-1},{interestPct:Infinity},{loanYears:0},{loanYears:.01}])assert.throws(()=>calculateProForma({...assumptions,...patch}),RangeError);
 assert.ok(calculateProForma({...assumptions,rentMonthly:100,otherIncomeMonthly:0}).breakEvenOccupancy>100);
 assert.throws(()=>calculateProForma({...assumptions,rentMonthly:1e308}),RangeError);
});
test('RFC4180 quoted commas, escaped quotes, embedded CRLF, and extra source metadata survive',()=>{
 const address='1 Fictional, "Test" Way\r\nUnit A';const r=parseListingsCsv(csv([row({address,agent_note:'Synthetic only'})],[...header.split(','),'agent_note']));assert.equal(r.errors.length,0);assert.equal(r.listings.length,1);assert.equal(r.listings[0].address,address);assert.equal(r.listings[0].metadata.agent_note,'Synthetic only');assert.equal(r.listings[0].askingPrice,250000);
});
test('unknown status, missing coordinates/source and impossible dates are row errors',()=>{
 const r=parseListingsCsv(csv([row({listing_id:'1',status:'available'}),row({listing_id:'2',latitude:''}),row({listing_id:'3',source:''}),row({listing_id:'4',as_of:'2026-02-30'}),row({listing_id:'5',asking_price:'0'}),row({listing_id:'6',longitude:'-181'}),row({listing_id:'7',as_of:'2026-09-08T12:00:00'})]));assert.equal(r.listings.length,0);assert.equal(new Set(r.errors.map(e=>e.row)).size,7);assert.ok(r.errors.some(e=>e.field==='status'));
});
test('malformed quotes are reported without turning the broken record into a listing',()=>{
 const text=csv([row()])+'BROKEN,"unterminated';const r=parseListingsCsv(text);assert.equal(r.listings.length,1);assert.ok(r.errors.some(e=>e.code==='csv-syntax'));
});
test('dedup retains the latest source-plus-ID record, including a pending transition',()=>{
 const r=parseListingsCsv(csv([row({as_of:'2026-09-07'}),row({status:'pending',as_of:'2026-09-08'}),row({source:'Another Synthetic Feed',asking_price:'260000'})]));assert.equal(r.listings.length,2);const same=r.listings.find(p=>p.source==='Synthetic Test Feed');assert.equal(same.status,'pending');assert.equal(summarizeListings(r.listings).activeListingCount,1);assert.ok(r.warnings.some(w=>w.code==='deduplicated-records'));
});
test('equal latest timestamps with conflicting values are withheld for review',()=>{
 const r=parseListingsCsv(csv([row(),row({asking_price:'260000'})]));assert.equal(r.listings.length,0);assert.ok(r.errors.some(e=>e.code==='conflicting-latest-records'));assert.ok(r.warnings.some(w=>w.code==='review-required'));
 const same=parseListingsCsv(csv([row(),row()]));assert.equal(same.listings.length,1);assert.equal(same.errors.length,0);
});
test('UTC-equivalent timestamps conflict, while a genuinely newer timestamp wins',()=>{
 const conflict=parseListingsCsv(csv([row({as_of:'2026-09-08T12:00:00Z'}),row({as_of:'2026-09-08T07:00:00-05:00',asking_price:'260000'})]));assert.equal(conflict.listings.length,0);assert.ok(conflict.errors.length>0);
 const latest=parseListingsCsv(csv([row({as_of:'2026-09-08T12:00:00Z'}),row({as_of:'2026-09-08T12:01:00Z',asking_price:'260000'})]));assert.equal(latest.listings[0].askingPrice,260000);
});
test('active listing volume and unique parcel IDs use explicit different denominators',()=>{
 const r=parseListingsCsv(csv([row(),row({listing_id:'SYNTHETIC-2',asking_price:'260000'}),row({listing_id:'SYNTHETIC-3',parcel_id:'',asking_price:'100000'}),row({listing_id:'SYNTHETIC-4',status:'pending',parcel_id:'PENDING-PARCEL'})]));const s=summarizeListings(r.listings);assert.equal(s.activeListingCount,3);assert.equal(s.activeAskingVolumeUSD,610000);assert.equal(s.uniqueIdentifiedActiveParcels,1);assert.equal(s.activeListingsWithoutParcelId,1);assert.equal(s.possibleDuplicateParcelGroups.length,1);assert.ok(s.warnings.length>0);
});
test('filters are explicit about status, price, source, and map bounds',()=>{
 const r=parseListingsCsv(csv([row(),row({listing_id:'PENDING',status:'pending'}),row({listing_id:'OUTSIDE',latitude:'40',asking_price:'100000'})]));assert.equal(filterListings(r.listings).length,2);assert.equal(filterListings(r.listings,{statuses:['active'],bounds:[-90.3,38.5,-90.1,38.8],minPrice:200000,query:'fictional'}).length,1);assert.equal(filterListings(r.listings,{statuses:['pending']})[0].listingId,'PENDING');
});
test('optional parcel header, BOM and header-only files remain valid without fabricated rows',()=>{
 const columns=header.split(',').filter(k=>k!=='parcel_id');assert.equal(parseListingsCsv('\uFEFF'+csv([row()],columns)).listings[0].parcelId,null);assert.equal(parseListingsCsv(header+'\r\n').listings.length,0);assert.equal(parseListingsCsv(header+'\r\n').errors.length,0);
});
test('5000-row and 5 MB limits warn before unbounded processing',()=>{
 const r=parseListingsCsv(csv(Array.from({length:MAX_LISTING_ROWS+1},(_,i)=>row({listing_id:'LIMIT-'+i,parcel_id:''}))));assert.equal(r.listings.length,MAX_LISTING_ROWS);assert.ok(r.warnings.some(w=>w.code==='row-limit'));
 const large=parseListingsCsv('x'.repeat(MAX_CSV_BYTES+1));assert.equal(large.listings.length,0);assert.ok(large.warnings.some(w=>w.code==='file-size-limit'));
});
test('date-only and timed conflicts on the same day require review rather than guessed chronology',()=>{
 const r=parseListingsCsv(csv([row({as_of:'2026-09-08'}),row({as_of:'2026-09-08T15:00:00Z',asking_price:'260000'})]));assert.equal(r.listings.length,0);assert.ok(r.warnings.some(w=>w.code==='review-required'));
});
test('leap days are validated and a malformed field does not corrupt the following record',()=>{
 const dates=parseListingsCsv(csv([row({listing_id:'LEAP',as_of:'2024-02-29'}),row({listing_id:'NOT-LEAP',as_of:'2025-02-29'})]));assert.equal(dates.listings.length,1);assert.equal(dates.listings[0].listingId,'LEAP');
 const malformed=header+'\r\nBAD,"closed"junk,38.6,-90.2,200000,active,Synthetic,2026-09-08,P\r\n'+csv([row()]).split('\r\n').slice(1).join('\r\n');
 const r=parseListingsCsv(malformed);assert.equal(r.listings.length,1);assert.ok(r.errors.some(e=>e.code==='csv-syntax'));
});
test('a pathological wide CSV is bounded instead of allocating an error per header',()=>{
 const r=parseListingsCsv(Array.from({length:10000},()=> 'duplicate').join(',')+'\n');assert.equal(r.listings.length,0);assert.ok(r.errors.length>0&&r.errors.length<20);assert.ok(r.errors.some(e=>e.message.includes('column limit')));
});
