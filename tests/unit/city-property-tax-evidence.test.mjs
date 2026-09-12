import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTaxEvidence,normalizeAssumptionSources} from '../../src/lib/property-tax-evidence.mjs';
import {illustrativeProForma} from '../../src/lib/property-proforma.mjs';
import {scenarioDocument,parseScenario,proFormaReport,createProFormaWorkbook} from '../../src/lib/property-proforma-export.mjs';

const property={recordKey:'synthetic-county:parcel-A:record-1',parcelId:'parcel-A',jurisdiction:'st-louis-county',address:'Synthetic fixture address'};
const bill={status:'matched',...property,taxYear:2025,amountUSD:2345.67,amountKind:'annual-property-tax',sourceUrl:'https://example.org/synthetic-tax-bill',retrievedAt:'2026-09-12T12:00:00Z'};

test('only an exact annual base bill can be offered for the currently linked parcel',()=>{
 const safe=normalizeTaxEvidence({...bill,owner:'Must not persist',balanceUSD:9999},property);
 assert.equal(safe.amountUSD,2345.67);assert.equal(safe.taxYear,2025);
 assert.equal('owner' in safe,false);assert.equal('balanceUSD' in safe,false);
 for(const patch of [{status:'unresolved'},{amountKind:'balance-due'},{amountKind:'payments'},{amountKind:'penalties'},{recordKey:'synthetic-county:parcel-A:record-2'},{parcelId:'parcel-B'},{jurisdiction:'st-louis-city'},{amountUSD:null},{amountUSD:'2345.67'},{amountUSD:Infinity},{amountUSD:-1},{taxYear:null},{taxYear:2025.5},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://user:password@example.org/'},{retrievedAt:'not-a-date'}])assert.throws(()=>normalizeTaxEvidence({...bill,...patch},property),RangeError);
 assert.throws(()=>normalizeTaxEvidence(bill,null),/linked property/);
 assert.equal(normalizeTaxEvidence({...bill,amountUSD:0},property).amountUSD,0,'A source-reported zero must remain distinct from a missing bill');
});

test('scenario JSON retains exact tax provenance and rejects changed input amounts or property identities',()=>{
 const assumptions={...illustrativeProForma(),taxAnnual:bill.amountUSD};
 const doc=scenarioDocument({name:'Sourced tax fixture',origin:'illustrative',property,assumptions,assumptionSources:{taxAnnual:bill,unrelated:'not persisted'}});
 const parsed=parseScenario(JSON.stringify(doc));
 assert.deepEqual(parsed.assumptionSources,{taxAnnual:normalizeTaxEvidence(bill,property)});
 assert.equal(parsed.origin,'illustrative');assert.equal(parsed.assumptions.taxAnnual,2345.67);
 assert.deepEqual(parseScenario(JSON.stringify({...doc,assumptionSources:undefined})).assumptionSources,{});
 assert.throws(()=>parseScenario(JSON.stringify({...doc,assumptions:{...assumptions,taxAnnual:9999}})),/no longer matches/);
 assert.throws(()=>parseScenario(JSON.stringify({...doc,property:{...property,recordKey:'different-record'}})),/linked property/);
 assert.deepEqual(normalizeAssumptionSources(null,property,assumptions),{});
});

test('printable and Excel exports include source vintage and exact amount without changing tax formulas',async()=>{
 const doc=scenarioDocument({name:'Sourced tax fixture',origin:'user assumptions',property,assumptions:{...illustrativeProForma(),taxAnnual:bill.amountUSD},assumptionSources:{taxAnnual:bill}});
 const report=proFormaReport(doc);assert.match(report,/tax year 2025; annual base bill USD 2345\.67/);assert.match(report,/https:\/\/example\.org\/synthetic-tax-bill/);assert.match(report,/Future taxes follow the entered expense-growth scenario/);
 const workbook=await createProFormaWorkbook(doc),notes=workbook.getWorksheet('Read me').getColumn(1).values.join('\n');
 assert.match(notes,/tax year 2025; annual base bill USD 2345\.67/);assert.match(notes,/retrieved: 2026-09-12T12:00:00Z/);
 const taxRow=workbook.getWorksheet('Inputs').getRows(1,45).find(row=>row.getCell(1).value==='Annual property taxes');
 assert.equal(taxRow.getCell(2).value,2345.67);
 assert.match(workbook.getWorksheet('CashFlow').getCell('F3').value.formula,new RegExp(`Inputs!\\$B\\$${taxRow.number}`));
});
