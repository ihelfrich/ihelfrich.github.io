/** Deterministic scenario arithmetic; contract: docs/st-louis-development-models.md. */
export const MODEL_VERSION='st-louis-development-models-v1';
export const VALIDATION_STATUS=Object.freeze({arithmetic:'Invariant-tested deterministic model',empiricalValuation:'Not trained',marketValuation:'Not validated'});
export class DevelopmentInputError extends RangeError {
  constructor(errors){super(errors.map(e=>e.message).join(' '));this.name='DevelopmentInputError';this.errors=errors}
}
const fail=(field,message)=>{throw new DevelopmentInputError([{field,message}])};
function number(input,key,label,{min=-Infinity,max=Infinity,exclusiveMin=false,integer=false}={}) {
  const value=input?.[key];
  if(typeof value!=='number'||!Number.isFinite(value))fail(key,`${label} must be entered as a finite number.`);
  if((exclusiveMin?value<=min:value<min)||value>max||(integer&&!Number.isSafeInteger(value)))fail(key,`${label} is outside the allowed domain${integer?' or is not a whole number':''}.`);
  return value;
}
function finite(value,field='result') {
  if(!Number.isFinite(value))fail(field,'The scenario exceeds the supported numeric range. Reduce the inputs or horizon.');
  return Object.is(value,-0)?0:value;
}
export function calculateDevelopmentEnvelope(input) {
  const lotAreaSqFt=number(input,'lotAreaSqFt','Lot area',{min:0,exclusiveMin:true}),far=number(input,'far','FAR',{min:0}),coveragePct=number(input,'coveragePct','Coverage',{min:0,max:100}),stories=number(input,'stories','Stories',{min:0,integer:true}),efficiencyPct=number(input,'efficiencyPct','Efficiency',{min:0,max:100}),averageUnitSqFt=number(input,'averageUnitSqFt','Average unit area',{min:0,exclusiveMin:true}),hardCostPerGrossSqFt=number(input,'hardCostPerGrossSqFt','Hard cost per gross ft²',{min:0}),softCostPct=number(input,'softCostPct','Soft cost',{min:0}),contingencyPct=number(input,'contingencyPct','Contingency',{min:0});
  const farLimitSqFt=finite(lotAreaSqFt*far),coverageHeightLimitSqFt=finite(lotAreaSqFt*(coveragePct/100)*stories),grossAreaSqFt=Math.min(farLimitSqFt,coverageHeightLimitSqFt),usableAreaSqFt=finite(grossAreaSqFt*(efficiencyPct/100)),wholeUnits=Math.floor(finite(usableAreaSqFt/averageUnitSqFt));
  if(!Number.isSafeInteger(wholeUnits))fail('averageUnitSqFt','The unit count exceeds the supported numeric range.');
  const residualUsableAreaSqFt=finite(usableAreaSqFt-wholeUnits*averageUnitSqFt),hardCostUSD=finite(grossAreaSqFt*hardCostPerGrossSqFt),softCostUSD=finite(hardCostUSD*(softCostPct/100)),contingencyUSD=finite((hardCostUSD+softCostUSD)*(contingencyPct/100)),constructionBudgetUSD=finite(hardCostUSD+softCostUSD+contingencyUSD);
  return {modelVersion:MODEL_VERSION,classification:'user-controlled-development-envelope',assumptions:{lotAreaSqFt,far,coveragePct,stories,efficiencyPct,averageUnitSqFt,hardCostPerGrossSqFt,softCostPct,contingencyPct},units:{area:'ft²',cost:'USD',hardCostRate:'USD/gross ft²',far:'dimensionless',rates:'percent'},farLimitSqFt,coverageHeightLimitSqFt,grossAreaSqFt,usableAreaSqFt,wholeUnits,residualUsableAreaSqFt,hardCostUSD,softCostUSD,contingencyUSD,constructionBudgetUSD,validationStatus:VALIDATION_STATUS};
}
export function calculateIncomeValue(input) {
  const currentNoiAnnual=number(input,'currentNoiAnnual','Current annual NOI'),growthPct=number(input,'growthPct','Annual growth',{min:-100}),discountRatePct=number(input,'discountRatePct','Discount rate',{min:-100,exclusiveMin:true}),terminalCapPct=number(input,'terminalCapPct','Terminal cap rate',{min:0,exclusiveMin:true}),horizonYears=number(input,'horizonYears','Horizon years',{min:1,max:100,integer:true}),exitCostsPct=number(input,'exitCostsPct','Exit costs',{min:0,max:100});
  const growth=1+growthPct/100,discount=1+discountRatePct/100,years=[];
  let annualNoiPresentValueUSD=0,noi=currentNoiAnnual;
  for(let year=1;year<=horizonYears;year++) {
    noi=finite(noi*growth);const discountFactor=finite(discount**year),presentValueUSD=finite(noi/discountFactor);
    annualNoiPresentValueUSD=finite(annualNoiPresentValueUSD+presentValueUSD);
    years.push({year,noiAnnual:noi,presentValueUSD,discountFactor});
  }
  const terminalNoiAnnual=finite(noi*growth),terminalGrossValueUSD=finite(terminalNoiAnnual/(terminalCapPct/100)),terminalNetValueUSD=finite(terminalGrossValueUSD*(1-exitCostsPct/100)),terminalPresentValueUSD=finite(terminalNetValueUSD/years.at(-1).discountFactor),incomeValueUSD=finite(annualNoiPresentValueUSD+terminalPresentValueUSD);
  return {modelVersion:MODEL_VERSION,classification:'user-controlled-income-value',assumptions:{currentNoiAnnual,growthPct,discountRatePct,terminalCapPct,horizonYears,exitCostsPct},units:{noi:'USD/year',value:'USD',time:'years',rates:'percent'},noiConvention:'current NOI is year 0; terminal NOI is year horizon + 1',currentNoiAnnual,nextYearNoiAnnual:years[0].noiAnnual,terminalNoiAnnual,annualNoiPresentValueUSD,terminalGrossValueUSD,terminalNetValueUSD,terminalPresentValueUSD,incomeValueUSD,years,validationStatus:VALIDATION_STATUS};
}
export function calculateGrowthSensitivity(input) {
  const lowGrowthPct=number(input,'lowGrowthPct','Low growth',{min:-100}),highGrowthPct=number(input,'highGrowthPct','High growth',{min:-100}),base=calculateIncomeValue(input);
  if(lowGrowthPct>input.growthPct)fail('lowGrowthPct','Low growth must be no greater than base growth.');
  if(highGrowthPct<input.growthPct)fail('highGrowthPct','High growth must be no less than base growth.');
  const scenarios=[['Low',lowGrowthPct],['Base',input.growthPct],['High',highGrowthPct]].map(([label,growthPct])=>({label,growthPct,...(label==='Base'?base:calculateIncomeValue({...input,growthPct}))}));
  return {modelVersion:MODEL_VERSION,classification:'user-controlled-sensitivity',assumptions:{...base.assumptions,lowGrowthPct,highGrowthPct},scenarios,validationStatus:VALIDATION_STATUS};
}
