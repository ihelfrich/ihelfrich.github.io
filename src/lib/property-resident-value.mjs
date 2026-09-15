/** Seller-side what-if arithmetic in nominal, pre-tax USD.
 * No source price, assessment, appraisal, ownership classification or forecast is inferred.
 */
export const RESIDENT_VALUE_VERSION='1.0';
export const RESIDENT_VALUE_LIMITS=Object.freeze({minimumPriceUSD:.01,maximumMoneyUSD:1e9,maximumHoldingMonths:120,maximumCalculationUSD:1e13,minimumAnnualRatePct:-50,maximumAnnualRatePct:50,maximumForecastYears:10});
export const RESIDENT_OFFER_CONVENTIONS=Object.freeze([
 'Comparison against the entered benchmark only; the benchmark is not an appraisal or an independently estimated market value.',
 'Nominal, pre-tax USD. Every cost assumption must be entered explicitly; zero is valid. No taxes, costs or financing changes are supplied automatically.',
 'Selling fees are a percentage of gross price. Closing costs, repairs and concessions are fixed dollar amounts. Holding cost equals entered months times monthly holding cost; fractional months are prorated.',
 'The same entered mortgage payoff is deducted at closing for each route. Loan amortization, changing payoff dates and other liens are not modeled.',
 'Gross and net differences equal offer minus entered benchmark. The low and high keys refer to the corresponding benchmark endpoint, not the numerical ordering of the differences.',
 'Break-even offer prices solve for equal net proceeds using the entered offer costs and fee. Negative algebraic break-even prices are retained when benchmark expenses exceed receipts; they are not a suggested sale price.',
 'Proceeds rows use positive receipts and negative deductions. The net-proceeds row is a total, not an additional cash flow. Cost summaries contain positive expense amounts.',
 'Calculations do not round intermediate values. Format USD for display or export only after calculation. Amounts outside the supported calculation range are rejected.',
]);
export const RESIDENT_FORECAST_CONVENTIONS=Object.freeze([
 'User what-if paths from the entered benchmark only. These are not probability bands, confidence intervals, appraisals or predicted sale prices.',
 'Each path compounds both entered benchmark endpoints at its entered constant annual rate: future value = starting value × (1 + rate / 100)^year.',
 'Year 0 repeats the entered benchmark; years 1 through the requested whole-year horizon are year-end values. Equal scenario rates are permitted.',
 'Nominal gross values only. Inflation, selling costs, mortgage payoff, carrying costs, renovations and income are not included.',
 'Calculations retain fractional dollar values and do not round between years. No assessed value or external price is substituted for an explicit input.',
]);

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function validator(){
 const errors=[];
 const number=(record,key,label,{min=0,max=RESIDENT_VALUE_LIMITS.maximumMoneyUSD,exclusiveMax=false,integer=false}={})=>{
  const value=object(record)?record[key]:undefined;
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||(exclusiveMax?value>=max:value>max)||(integer&&!Number.isInteger(value))){errors.push(`${label}: enter an explicit ${integer?'whole ':''}number from ${min} to ${exclusiveMax?'less than ':''}${max}.`);return undefined;}
  return Object.is(value,-0)?0:value;
 };
 const finish=()=>{if(errors.length){const error=new RangeError(errors.join('\n'));error.errors=[...errors];throw error;}};
 return {number,errors,finish};
}
function benchmark(input,validation){
 const valueLow=validation.number(input,'valueLow','Entered benchmark low',{min:RESIDENT_VALUE_LIMITS.minimumPriceUSD});
 const valueHigh=validation.number(input,'valueHigh','Entered benchmark high',{min:RESIDENT_VALUE_LIMITS.minimumPriceUSD});
 if(valueLow!==undefined&&valueHigh!==undefined&&valueHigh<valueLow)validation.errors.push('Entered benchmark high must be at least the entered benchmark low.');
 return {valueLow,valueHigh};
}
function checkedAmount(value){
 if(!Number.isFinite(value)||Math.abs(value)>RESIDENT_VALUE_LIMITS.maximumCalculationUSD)throw new RangeError('Inputs produce an amount outside the supported calculation range of ±$10 trillion.');
 return Object.is(value,-0)?0:value;
}
function routeAssumptions(input,side,validation){
 const source=object(input)?input[side]:null,read=(key,options)=>validation.number(source,key,`${side}.${key}`,options);
 return {sellingFeePct:read('sellingFeePct',{max:100,exclusiveMax:true}),closingCosts:read('closingCosts'),repairs:read('repairs'),concessions:read('concessions'),holdingMonths:read('holdingMonths',{max:RESIDENT_VALUE_LIMITS.maximumHoldingMonths}),monthlyHoldingCost:read('monthlyHoldingCost')};
}
function proceeds(price,assumptions,mortgagePayoff){
 const sellingFeeUSD=price*assumptions.sellingFeePct/100,holdingCostsUSD=assumptions.holdingMonths*assumptions.monthlyHoldingCost;
 const fixedCostsUSD=assumptions.closingCosts+assumptions.repairs+assumptions.concessions+holdingCostsUSD;
 const totalSellingCostsUSD=sellingFeeUSD+fixedCostsUSD,totalDeductionsUSD=totalSellingCostsUSD+mortgagePayoff;
 const costs={sellingFeeUSD,closingCostsUSD:assumptions.closingCosts,repairsUSD:assumptions.repairs,concessionsUSD:assumptions.concessions,holdingCostsUSD,fixedCostsUSD,totalSellingCostsUSD,mortgagePayoffUSD:mortgagePayoff,totalDeductionsUSD};
 for(const value of Object.values(costs))checkedAmount(value);
 return {price,net:checkedAmount(price-totalDeductionsUSD),costs};
}

export function calculateResidentOffer(input){
 const validation=validator(),{valueLow,valueHigh}=benchmark(input,validation);
 const offerPrice=validation.number(input,'offerPrice','Offer price',{min:RESIDENT_VALUE_LIMITS.minimumPriceUSD}),mortgagePayoff=validation.number(input,'mortgagePayoff','Mortgage payoff');
 const market=routeAssumptions(input,'market',validation),offer=routeAssumptions(input,'offer',validation);validation.finish();
 const marketLow=proceeds(valueLow,market,mortgagePayoff),marketHigh=proceeds(valueHigh,market,mortgagePayoff),offerResult=proceeds(offerPrice,offer,mortgagePayoff);
 const breakEven=reference=>checkedAmount((reference.net+mortgagePayoff+offerResult.costs.fixedCostsUSD)/(1-offer.sellingFeePct/100));
 const negative=value=>value===0?0:-value;
 const row=(id,label,kind,values)=>({id,label,kind,marketLow:values[0],marketHigh:values[1],offer:values[2]});
 const sides=[marketLow,marketHigh,offerResult];
 const rows=[row('gross-price','Gross sale price','proceeds',sides.map(s=>s.price)),
  ...[['sellingFeeUSD','Selling fee'],['closingCostsUSD','Closing costs'],['repairsUSD','Repairs'],['concessionsUSD','Concessions'],['holdingCostsUSD','Holding costs']].map(([key,label])=>row(key,label,'cost',sides.map(s=>negative(s.costs[key])))),
  row('mortgage-payoff','Mortgage payoff','payoff',sides.map(s=>negative(s.costs.mortgagePayoffUSD))),row('net-proceeds','Net proceeds / cash shortfall','total',sides.map(s=>s.net))];
 return {schema:'resident-offer-v1',version:RESIDENT_VALUE_VERSION,classification:'entered-benchmark-comparison',currency:'USD',
  assumptions:{valueLow,valueHigh,offerPrice,mortgagePayoff,market:{...market},offer:{...offer}},
  market:{lowNet:marketLow.net,highNet:marketHigh.net},offer:{net:offerResult.net},
  grossDifference:{low:checkedAmount(offerPrice-valueLow),high:checkedAmount(offerPrice-valueHigh)},
  netDifference:{low:checkedAmount(offerResult.net-marketLow.net),high:checkedAmount(offerResult.net-marketHigh.net)},
  breakEvenOfferPrice:{low:breakEven(marketLow),high:breakEven(marketHigh)},
  costs:{market:{low:marketLow.costs,high:marketHigh.costs},offer:offerResult.costs},rows,conventions:[...RESIDENT_OFFER_CONVENTIONS]};
}

export function forecastResidentValue(input){
 const validation=validator(),{valueLow,valueHigh}=benchmark(input,validation),years=validation.number(input,'years','Forecast years',{min:1,max:RESIDENT_VALUE_LIMITS.maximumForecastYears,integer:true});
 const rates=Object.fromEntries(['lower','steady','higher'].map(key=>[key,validation.number(object(input)?input.rates:null,key,`${key} annual rate (%)`,{min:RESIDENT_VALUE_LIMITS.minimumAnnualRatePct,max:RESIDENT_VALUE_LIMITS.maximumAnnualRatePct})]));
 if(rates.lower!==undefined&&rates.steady!==undefined&&rates.higher!==undefined&&(rates.lower>rates.steady||rates.steady>rates.higher))validation.errors.push('Annual scenario rates must be ordered lower ≤ steady ≤ higher.');
 validation.finish();
 const paths=Object.fromEntries(Object.entries(rates).map(([name,rate])=>[name,Array.from({length:years+1},(_,year)=>{const factor=(1+rate/100)**year;return {year,low:checkedAmount(valueLow*factor),high:checkedAmount(valueHigh*factor)};})]));
 return {schema:'resident-value-paths-v1',version:RESIDENT_VALUE_VERSION,classification:'user-what-if',currency:'USD',assumptions:{valueLow,valueHigh,years,rates:{...rates}},paths,conventions:[...RESIDENT_FORECAST_CONVENTIONS]};
}
