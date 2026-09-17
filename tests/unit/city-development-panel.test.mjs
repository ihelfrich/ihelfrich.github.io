import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createDevelopmentPanel} from '../../src/scripts/city/city-development-panel.mjs';
const source={url:'https://example.org/official-parcels',retrievedAt:'2026-09-08T12:00:00Z'};
const evidence=id=>({point:{longitude:-90.193,latitude:38.628},parcels:{status:'found',source,parcel:{properties:{recordKey:id,parcelId:'parcel-'+id,address:'Fixture '+id,areaSqFt:10000,assessedValueUSD:900000}}}});
function fixture(t,{selected=evidence('one'),scenario=null}={}) {
 const window=new Window(),root=window.document.createElement('section');window.document.body.append(root);
 const urls={create:URL.createObjectURL,revoke:URL.revokeObjectURL},blobs=[];
 URL.createObjectURL=b=>{blobs.push(b);return 'blob:test-development'};URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=function(){};
 const panel=createDevelopmentPanel(root,{getEvidence:()=>selected,getScenario:()=>scenario});
 const $=id=>root.querySelector('#'+id),input=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new window.Event('input',{bubbles:true}))},submit=id=>$(id).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 t.after(async()=>{panel.dispose();await window.happyDOM.abort();URL.createObjectURL=urls.create;URL.revokeObjectURL=urls.revoke});
 return {window,root,panel,$,input,submit,blobs};
}
test('source lot area and calculated rental NOI import only by explicit action and retain their provenance',async t=>{
 const scenario={label:'User rental assumptions',scenarioKind:'official-parcel',result:{noiAnnual:25000},selectedPropertyEvidence:{parcel:{properties:{recordKey:'one'}}}};
 const f=fixture(t,{scenario});
 assert.equal(f.$('development-lotAreaSqFt').value,'');assert.equal(f.$('valuation-currentNoiAnnual').value,'');
 f.$('development-use-area').click();assert.equal(f.$('development-lotAreaSqFt').value,'10000');
 f.$('valuation-use-noi').click();assert.equal(f.$('valuation-currentNoiAnnual').value,'25000');assert.match(f.$('valuation-basis').textContent,/User rental assumptions/);
 for(const [key,value] of Object.entries({growthPct:0,discountRatePct:10,terminalCapPct:5,horizonYears:5,exitCostsPct:2,lowGrowthPct:-2,highGrowthPct:3}))f.input('valuation-'+key,value);
 f.submit('valuation-form');assert.equal(f.$('valuation-results').hidden,false);f.$('development-export').click();
 const output=JSON.parse(await f.blobs.at(-1).text());
 assert.equal(output.income.basis.importedScenario.result.noiAnnual,25000);assert.equal(output.income.basis.importedScenario.label,scenario.label);
 assert.equal(output.validationStatus.empiricalValuation,'Not trained');assert.equal(output.income.output.scenarios[1].currentNoiAnnual,25000);
});
test('unknown area never becomes zero; invalidated inputs and changed selection remove stale outputs',t=>{
 const f=fixture(t,{selected:{point:{longitude:-90.193,latitude:38.628},parcels:{status:'not-found'}}});
 assert.equal(f.$('development-use-area').disabled,true);assert.equal(f.$('development-lotAreaSqFt').value,'');
 f.$('development-example').click();assert.equal(f.$('development-results').hidden,false);assert.equal(f.$('valuation-results').hidden,false);
 assert.ok(f.panel.getEnvelopeInputs());f.input('development-far','');assert.equal(f.$('development-results').hidden,true);assert.equal(f.panel.getEnvelopeInputs(),null);
 f.panel.setEvidence(evidence('new'));assert.equal(f.$('valuation-results').hidden,true);assert.equal(f.$('development-export').hidden,true);assert.equal(f.$('development-lotAreaSqFt').value,'');
});
test('illustrative exports exclude the selected property and show signed values on a labeled sensitivity chart',async t=>{
 const f=fixture(t);f.$('development-example').click();f.$('development-export').click();
 let output=JSON.parse(await f.blobs.at(-1).text());assert.equal(output.envelope.basis.kind,'illustrative');assert.equal(output.envelope.basis.sourceArea,null);assert.equal(output.selectedProperty,null);
 f.input('valuation-currentNoiAnnual',-25000);f.submit('valuation-form');assert.match(f.$('valuation-results').textContent,/-\$/);
 assert.equal(f.$('valuation-results').querySelectorAll('svg').length,1);assert.match(f.$('valuation-results').textContent,/not confidence/i);
 f.$('development-export').click();output=JSON.parse(await f.blobs.at(-1).text());assert.equal(output.income.basis.kind,'illustrative-modified');assert.ok(output.income.output.scenarios[1].incomeValueUSD<0);
});
test('dispose detaches actions and malicious source strings stay literal',t=>{
 const e=evidence('one');e.parcels.parcel.properties.address='<img src=x onerror=alert(1)>';
 const f=fixture(t,{selected:e});assert.equal(f.root.querySelector('img'),null);assert.match(f.$('development-selection').textContent,/<img/);
 f.panel.dispose();f.$('development-example').click();assert.equal(f.$('development-results').hidden,true);
});
test('mixing explicit source area into a fixture retains the invented status of remaining inputs',async t=>{
 const f=fixture(t);f.$('development-example').click();f.$('development-use-area').click();f.submit('development-form');f.$('development-export').click();
 const output=JSON.parse(await f.blobs.at(-1).text());
 assert.equal(output.envelope.basis.kind,'illustrative-modified');assert.equal(output.envelope.basis.sourceArea.recordKey,'one');
 assert.equal(output.envelope.basis.illustrativeFields.includes('lotAreaSqFt'),false);assert.equal(output.envelope.basis.illustrativeFields.includes('hardCostPerGrossSqFt'),true);
 assert.equal(output.selectedProperty.recordKey,'one');
});
