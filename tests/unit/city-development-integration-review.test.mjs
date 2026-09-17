import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createEstatePanel} from '../../src/scripts/city/city-estate.mjs';
import {createDevelopmentPanel} from '../../src/scripts/city/city-development-panel.mjs';
import {createPropertyPanel} from '../../src/scripts/city/city-property-panel.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const point={longitude:-90.193,latitude:38.628};
const parcel={type:'Feature',properties:{recordKey:'fixture:one',parcelId:'fixture',parcelKey:'st-louis-city:h',areaSqFt:10000,address:'Fixture parcel'}};

test('imported rental NOI carries listing source, date and import file through the development export',async t=>{
 const window=new Window(),doc=window.document,priorDocument=globalThis.document,priorCreate=URL.createObjectURL,priorRevoke=URL.revokeObjectURL,blobs=[];
 globalThis.document=doc;URL.createObjectURL=b=>{blobs.push(b);return 'blob:integration-review'};URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=function(){};
 const estateRoot=doc.createElement('section'),developmentRoot=doc.createElement('section');doc.body.append(estateRoot,developmentRoot);
 const estate=createEstatePanel(estateRoot,{onMarkers(){}}),development=createDevelopmentPanel(developmentRoot,{getScenario:()=>estate.getScenario()});
 t.after(async()=>{development.dispose();await window.happyDOM.abort();globalThis.document=priorDocument;URL.createObjectURL=priorCreate;URL.revokeObjectURL=priorRevoke});
 const file=estateRoot.querySelector('#estate-file');Object.defineProperty(file,'files',{configurable:true,value:[{name:'source-feed.csv',size:200,text:async()=>
  'listing_id,address,latitude,longitude,asking_price,status,source,as_of,parcel_id\nreview,Source fixture,38.628,-90.193,225000,active,Licensed Fixture Source,2026-09-08,fixture\n'}]});
 file.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();estateRoot.querySelector('#estate-list button').click();
 for(const [key,value] of Object.entries({rehab:10000,closingCosts:5000,rentMonthly:2500,otherIncomeMonthly:0,vacancyPct:5,operatingExpensesAnnual:9000,capexReserveAnnual:1000,ltvPct:75,interestPct:6,loanYears:30}))estateRoot.querySelector('#estate-'+key).value=String(value);
 estateRoot.querySelector('#estate-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 developmentRoot.querySelector('#valuation-use-noi').click();
 for(const [key,value] of Object.entries({growthPct:0,discountRatePct:10,terminalCapPct:5,horizonYears:5,exitCostsPct:2,lowGrowthPct:-2,highGrowthPct:3}))developmentRoot.querySelector('#valuation-'+key).value=String(value);
 developmentRoot.querySelector('#valuation-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));developmentRoot.querySelector('#development-export').click();
 const imported=JSON.parse(await blobs.at(-1).text()).income.basis.importedScenario;
 assert.equal(imported.selectedListing?.source,'Licensed Fixture Source');
 assert.equal(imported.selectedListing?.asOf,'2026-09-08');assert.equal(imported.importFile,'source-feed.csv');
});

test('public inventory recovery supplies a separate snapshot callback without republishing the selected property',async t=>{
 const window=new Window(),doc=window.document,root=doc.createElement('section');doc.body.append(root);const published=[],snapshots=[];
 const snapshot={listings:[{id:'lra:one',parcelKey:'st-louis-city:h',parcelId:'fixture',...point}],source:{url:'https://example.org/fixture'},retrievedAt:'2026-09-08T12:00:00Z'};
 const panel=createPropertyPanel(root,{estate:{selectPoint(){},setPropertyEvidence(){return true}},onEvidence:e=>published.push(e),onInventory:s=>snapshots.push(s),getCity:()=>({controls:{target:{x:0,z:0}},setParcel(){}}),
  lookup:async p=>({point:p,parcels:{status:'found',parcel,candidates:[parcel]},zoning:{status:'unknown'},inventory:{status:'unavailable',listings:[]}}),inventoryLoader:async()=>snapshot});
 t.after(async()=>{panel.clearSelection();await window.happyDOM.abort()});
 await panel.inspectPoint(point);assert.equal(published.at(-1).inventorySnapshot,null);const selectionEvents=published.length;
 root.querySelector('#property-public-load').click();await tick();
 assert.match(root.querySelector('#property-public-status').textContent,/1 records in the public snapshot/);
 assert.equal(snapshots.at(-1),snapshot);assert.equal(published.length,selectionEvents,'Inventory recovery must not reset model or height-study consumers');
});
