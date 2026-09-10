import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDevelopmentEnvelope,calculateIncomeValue,calculateGrowthSensitivity,MODEL_VERSION} from '../../src/lib/city-development.mjs';
const envelope={lotAreaSqFt:10000,far:2,coveragePct:50,stories:3,efficiencyPct:80,averageUnitSqFt:900,hardCostPerGrossSqFt:200,softCostPct:20,contingencyPct:10};
const income={currentNoiAnnual:100000,growthPct:0,discountRatePct:10,terminalCapPct:5,horizonYears:5,exitCostsPct:2};
const close=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} ≠ ${b}`);
test('envelope respects both constraints, whole-unit remainder and explicit budget conservation',()=>{
 const r=calculateDevelopmentEnvelope(envelope);
 assert.equal(r.grossAreaSqFt,15000);assert.equal(r.usableAreaSqFt,12000);assert.equal(r.wholeUnits,13);assert.equal(r.residualUsableAreaSqFt,300);
 assert.equal(r.hardCostUSD,3000000);assert.equal(r.softCostUSD,600000);assert.equal(r.contingencyUSD,360000);assert.equal(r.constructionBudgetUSD,3960000);
 assert.equal(r.constructionBudgetUSD,r.hardCostUSD+r.softCostUSD+r.contingencyUSD);
 assert.equal(r.grossAreaSqFt,Math.min(r.farLimitSqFt,r.coverageHeightLimitSqFt));assert.equal(r.modelVersion,MODEL_VERSION);
});
test('zero constraints and zero costs yield zero without inventing a floor, and area/cost scaling is linear',()=>{
 const base=calculateDevelopmentEnvelope(envelope),twice=calculateDevelopmentEnvelope({...envelope,lotAreaSqFt:20000});
 assert.equal(twice.grossAreaSqFt,2*base.grossAreaSqFt);assert.equal(twice.constructionBudgetUSD,2*base.constructionBudgetUSD);
 for(const key of ['far','coveragePct','stories']){const r=calculateDevelopmentEnvelope({...envelope,[key]:0});assert.equal(r.grossAreaSqFt,0);assert.equal(r.constructionBudgetUSD,0);assert.equal(r.wholeUnits,0)}
 assert.equal(calculateDevelopmentEnvelope({...envelope,hardCostPerGrossSqFt:0}).constructionBudgetUSD,0);
});
test('zero growth matches finite annuity plus terminal discount; terminal NOI is year H+1',()=>{
 const r=calculateIncomeValue(income),expected=100000*(1-1.1**-5)/0.1+(100000/0.05*0.98)/1.1**5;
 close(r.incomeValueUSD,expected);assert.equal(r.currentNoiAnnual,100000);assert.equal(r.nextYearNoiAnnual,100000);assert.equal(r.terminalNoiAnnual,100000);
 const growth=calculateIncomeValue({...income,growthPct:5,horizonYears:2});close(growth.nextYearNoiAnnual,105000);close(growth.terminalNoiAnnual,100000*1.05**3);
 close(growth.incomeValueUSD,growth.annualNoiPresentValueUSD+growth.terminalPresentValueUSD);
});
test('zero discount, complete exit costs, negative NOI and zero/negative growth limits preserve identities',()=>{
 assert.equal(calculateIncomeValue({...income,discountRatePct:0,exitCostsPct:100}).incomeValueUSD,500000);
 assert.equal(calculateIncomeValue({...income,currentNoiAnnual:0}).incomeValueUSD,0);
 assert.equal(calculateIncomeValue({...income,growthPct:-100}).incomeValueUSD,0);
 const base=calculateIncomeValue(income),loss=calculateIncomeValue({...income,currentNoiAnnual:-100000}),scale=calculateIncomeValue({...income,currentNoiAnnual:300000});
 close(loss.incomeValueUSD,-base.incomeValueUSD);assert.ok(loss.incomeValueUSD<0);close(scale.incomeValueUSD,3*base.incomeValueUSD);
});
test('sensitivity labels explicit growth choices and never implies confidence bands',()=>{
 const r=calculateGrowthSensitivity({...income,lowGrowthPct:-2,highGrowthPct:4});
 assert.deepEqual(r.scenarios.map(s=>[s.label,s.growthPct]),[['Low',-2],['Base',0],['High',4]]);
 assert.ok(r.scenarios[0].incomeValueUSD<r.scenarios[1].incomeValueUSD);assert.ok(r.scenarios[1].incomeValueUSD<r.scenarios[2].incomeValueUSD);
 assert.equal(r.classification,'user-controlled-sensitivity');
 assert.throws(()=>calculateGrowthSensitivity({...income,lowGrowthPct:1,highGrowthPct:4}),/Low growth/);
});
test('missing input, invalid rates/domains, fractional years and overflow fail explicitly',()=>{
 for(const patch of [{lotAreaSqFt:null},{far:NaN},{coveragePct:101},{efficiencyPct:-1},{stories:1.5},{averageUnitSqFt:0},{hardCostPerGrossSqFt:-1}])assert.throws(()=>calculateDevelopmentEnvelope({...envelope,...patch}));
 for(const patch of [{currentNoiAnnual:''},{growthPct:-101},{discountRatePct:-100},{terminalCapPct:0},{horizonYears:1.5},{horizonYears:101},{exitCostsPct:101}])assert.throws(()=>calculateIncomeValue({...income,...patch}));
 assert.throws(()=>calculateDevelopmentEnvelope({...envelope,lotAreaSqFt:Number.MAX_VALUE}),/numeric range/);
 assert.throws(()=>calculateIncomeValue({...income,growthPct:100000,horizonYears:100}),/numeric range/);
});
