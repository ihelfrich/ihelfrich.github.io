import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateResidentOffer,forecastResidentValue} from '../../src/lib/property-resident-value.mjs';

const zero=()=>({sellingFeePct:0,closingCosts:0,repairs:0,concessions:0,holdingMonths:0,monthlyHoldingCost:0});
const fixture=()=>({valueLow:200000,valueHigh:250000,offerPrice:210000,mortgagePayoff:120000,market:{sellingFeePct:6,closingCosts:3000,repairs:10000,concessions:2000,holdingMonths:3,monthlyHoldingCost:1500},offer:{sellingFeePct:1,closingCosts:1000,repairs:0,concessions:500,holdingMonths:1,monthlyHoldingCost:1000}});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} must equal ${expected}`);

test('offer comparison reconciles all entered costs, endpoint differences and both break-even prices',()=>{
 const a=fixture(),r=calculateResidentOffer(a);
 near(r.market.lowNet,48500);near(r.market.highNet,95500);near(r.offer.net,85400);
 assert.deepEqual(r.grossDifference,{low:10000,high:-40000});near(r.netDifference.low,36900);near(r.netDifference.high,-10100);
 near(r.breakEvenOfferPrice.low,171000/.99);near(r.breakEvenOfferPrice.high,218000/.99);
 for(const endpoint of ['low','high'])near(calculateResidentOffer({...a,offerPrice:r.breakEvenOfferPrice[endpoint]}).offer.net,r.market[`${endpoint}Net`]);
 near(r.costs.market.low.holdingCostsUSD,4500);near(r.costs.market.low.totalSellingCostsUSD,31500);near(r.costs.offer.totalSellingCostsUSD,4600);
 for(const [column,net]of [['marketLow',48500],['marketHigh',95500],['offer',85400]])near(r.rows.filter(row=>row.kind!=='total').reduce((sum,row)=>sum+row[column],0),net);
 assert.equal(r.classification,'entered-benchmark-comparison');assert.match(r.conventions.join(' '),/entered benchmark/i);
});
test('negative equity remains a cash shortfall and does not alter relative offers when payoff is shared',()=>{
 const r=calculateResidentOffer({...fixture(),mortgagePayoff:300000});near(r.market.lowNet,-131500);near(r.market.highNet,-84500);near(r.offer.net,-94600);near(r.netDifference.low,36900);near(r.netDifference.high,-10100);
});
test('explicit zero costs are valid, holding fractions are prorated, and input objects are not mutated',()=>{
 const a={...fixture(),market:zero(),offer:zero(),mortgagePayoff:0},before=JSON.stringify(a),r=calculateResidentOffer(a);assert.equal(r.market.lowNet,200000);assert.equal(r.offer.net,210000);assert.equal(r.breakEvenOfferPrice.low,200000);assert.equal(JSON.stringify(a),before);
 const partial=calculateResidentOffer({...a,offer:{...zero(),holdingMonths:1.5,monthlyHoldingCost:125.25}});near(partial.costs.offer.holdingCostsUSD,187.875);
});
test('every assumption must be explicitly finite; null, blank, strings and booleans are never zero',()=>{
 for(const key of ['valueLow','valueHigh','offerPrice','mortgagePayoff'])for(const value of [undefined,null,'', '200000',false,NaN,Infinity,-Infinity])assert.throws(()=>calculateResidentOffer({...fixture(),[key]:value}),RangeError,`${key}: ${value}`);
 for(const side of ['market','offer'])for(const key of Object.keys(zero()))for(const value of [undefined,null,'',false,NaN,Infinity]){const a=fixture();a[side][key]=value;assert.throws(()=>calculateResidentOffer(a),RangeError,`${side}.${key}: ${value}`);}
 for(const input of [null,{},[],{...fixture(),market:null},{...fixture(),offer:[]}])assert.throws(()=>calculateResidentOffer(input),RangeError);
});
test('reversed or nonpositive benchmarks, invalid fees and unsupported assumptions fail rather than clamp',()=>{
 for(const input of [{...fixture(),valueLow:250001},{...fixture(),valueLow:0},{...fixture(),offerPrice:-1},{...fixture(),valueHigh:1e10},{...fixture(),mortgagePayoff:-1}])assert.throws(()=>calculateResidentOffer(input),RangeError);
 for(const key of Object.keys(zero()))assert.throws(()=>calculateResidentOffer({...fixture(),offer:{...zero(),[key]:-1}}),RangeError);
 for(const sellingFeePct of [100,101])assert.throws(()=>calculateResidentOffer({...fixture(),offer:{...zero(),sellingFeePct}}),RangeError);
 assert.throws(()=>calculateResidentOffer({...fixture(),offer:{...zero(),holdingMonths:121}}),RangeError);
 assert.throws(()=>calculateResidentOffer({...fixture(),offer:{...zero(),sellingFeePct:99.99999999999999}}),/calculation range/);
 const justBelow=calculateResidentOffer({...fixture(),offer:{...zero(),sellingFeePct:99}});assert.ok(Number.isFinite(justBelow.breakEvenOfferPrice.high));
});
test('an algebraically negative break-even price is preserved with an explicit convention',()=>{
 const r=calculateResidentOffer({...fixture(),valueLow:10000,valueHigh:12000,market:{...zero(),repairs:20000},offer:zero()});assert.equal(r.breakEvenOfferPrice.low,-10000);assert.equal(r.breakEvenOfferPrice.high,-8000);assert.match(r.conventions.join(' '),/negative.*break-even|break-even.*negative/i);
});

test('future-value paths compound entered bounds without probabilities or assessed-value substitution',()=>{
 const input={valueLow:200000,valueHigh:250000,years:2,rates:{lower:-10,steady:0,higher:10}},original=JSON.stringify(input),r=forecastResidentValue(input);
 assert.equal(r.classification,'user-what-if');assert.equal(JSON.stringify(input),original);assert.deepEqual(r.paths.lower[0],{year:0,low:200000,high:250000});
 near(r.paths.lower[2].low,162000);near(r.paths.lower[2].high,202500);near(r.paths.steady[2].low,200000);near(r.paths.higher[2].high,302500);
 assert.equal(r.paths.lower.length,3);assert.match(r.conventions.join(' '),/not.*confidence|no.*probabilit/i);
 const downside=forecastResidentValue({valueLow:100,valueHigh:200,years:10,rates:{lower:-50,steady:-25,higher:0}});near(downside.paths.lower[10].low,100/1024);near(downside.paths.higher[10].high,200);
});
test('future paths reject missing, nonfinite, unordered, fractional-year and excessive-rate inputs',()=>{
 const a={valueLow:100,valueHigh:200,years:2,rates:{lower:-5,steady:0,higher:5}};
 for(const years of [undefined,null,'2',0,1.5,11,NaN,Infinity])assert.throws(()=>forecastResidentValue({...a,years}),RangeError);
 for(const key of ['lower','steady','higher'])for(const value of [undefined,null,'',false,NaN,Infinity,-51,51])assert.throws(()=>forecastResidentValue({...a,rates:{...a.rates,[key]:value}}),RangeError);
 for(const rates of [{lower:5,steady:0,higher:10},{lower:-5,steady:10,higher:5},null,{}])assert.throws(()=>forecastResidentValue({...a,rates}),RangeError);
 assert.throws(()=>forecastResidentValue({...a,valueLow:201}),RangeError);assert.throws(()=>forecastResidentValue({...a,valueLow:0}),RangeError);
 assert.equal(forecastResidentValue({...a,rates:{lower:0,steady:0,higher:0}}).paths.higher[2].high,200);
});
