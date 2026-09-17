/** Deterministic, pre-tax property underwriting. USD; year-end annual returns.
 * All economic inputs are scenarios, never inferred from an assessment.
 */
export const PROFORMA_VERSION='1.0';
export const PROFORMA_USE_LABELS={purchase:'Purchase price',renovation:'Renovation + contingency',closing:'Acquisition closing costs',loanFees:'Initial loan fees',cashReserve:'Initial cash reserve',total:'Total project uses'};
export const PROFORMA_FIELDS=[
 ['Acquisition','purchasePrice','Purchase price',0,1e10,185000],['Acquisition','rehab','Renovation budget',0,1e10,35000],['Acquisition','contingencyPct','Renovation contingency (%)',0,100,15],['Acquisition','closingCosts','Acquisition closing costs',0,1e9,6000],['Acquisition','cashReserve','Initial cash held in reserve',0,1e9,10000],
 ['Income','units','Rentable units',1,100000,1],['Income','rentMonthly','Monthly rent per unit',0,1e8,1900],['Income','otherIncomeMonthly','Other monthly property income',0,1e8,0],['Income','vacancyPct','Vacancy and collection loss (%)',0,100,7],['Income','downtimeMonths','Initial months without income',0,36,3],['Income','rentGrowthPct','Annual income growth (%)',-50,50,2],
 ['Operating costs','taxAnnual','Annual property taxes',0,1e9,2800],['Operating costs','insuranceAnnual','Annual insurance',0,1e9,1600],['Operating costs','maintenanceAnnual','Annual repairs and maintenance',0,1e9,1500],['Operating costs','utilitiesAnnual','Owner-paid utilities, annual',0,1e9,600],['Operating costs','hoaAnnual','HOA and association dues, annual',0,1e9,0],['Operating costs','otherExpensesAnnual','Other annual operating expenses',0,1e9,300],['Operating costs','managementPct','Management (% of collected income)',0,100,8],['Operating costs','capexAnnual','Annual capital replacement budget',0,1e9,1200],['Operating costs','expenseGrowthPct','Annual cost growth (%)',-50,50,3],
 ['Financing','loanAmount','Initial loan principal',0,1e10,148000],['Financing','interestPct','Initial annual interest (%)',0,50,7],['Financing','amortYears','Initial amortization (years)',1,40,30],['Financing','loanTermYears','Initial loan maturity (years)',1,40,30],['Financing','ioMonths','Initial interest-only months',0,360,0],['Financing','loanPointsPct','Initial loan fees (% of principal)',0,20,1],
 ['Exit and returns','holdYears','Hold period (whole years)',1,30,10],['Exit and returns','exitPrice','Assumed sale price at exit',0,1e11,280000],['Exit and returns','exitCapPct','Exit cap rate on next-year NOI (%)',0.1,50,6],['Exit and returns','sellingCostsPct','Sale costs (%)',0,100,7],['Exit and returns','discountPct','Annual discount rate (%)',0,100,10],
 ['Optional refinance','refiYear','Refinance at year end (0 = none)',0,29,0],['Optional refinance','refiValue','Assumed value at refinance',0,1e11,250000],['Optional refinance','refiLtvPct','Refinance loan / assumed value (%)',0,100,70],['Optional refinance','refiInterestPct','Refinance annual interest (%)',0,50,6.5],['Optional refinance','refiAmortYears','Refinance amortization (years)',1,40,30],['Optional refinance','refiTermYears','Refinance maturity (years)',1,40,30],['Optional refinance','refiCostsPct','Refinance fees (% of new loan)',0,20,2],
];
export const illustrativeProForma=()=>Object.fromEntries([...PROFORMA_FIELDS.map(f=>[f[1],f[5]]),['exitMethod','price']]);
export function payment(principal,annualRate,months){const r=annualRate/1200;return principal===0?0:r===0?principal/months:principal*r/-Math.expm1(-months*Math.log1p(r));}
export function npv(cashflows,rate){return cashflows.reduce((sum,x,t)=>sum+x/(1+rate)**t,0);}
export function annualIrr(flows){
 const signs=flows.filter(x=>Math.abs(x)>1e-8).map(Math.sign);const changes=signs.slice(1).filter((s,i)=>s!==signs[i]).length;
 if(changes!==1||flows[0]>=0)return {value:null,reason:changes>1?'Multiple cash-flow sign changes; IRR may not be unique.':'IRR requires initial equity and a later positive cash flow.'};
 let lo=-.9999,hi=1;while(npv(flows,hi)>0&&hi<1e6)hi*=2;
 if(npv(flows,lo)*npv(flows,hi)>0)return {value:null,reason:'No IRR bracket in the supported range.'};
 for(let i=0;i<180;i++){const mid=(lo+hi)/2;if(npv(flows,mid)>0)lo=mid;else hi=mid;}
 return {value:(lo+hi)/2*100,reason:null};
}
export function calculatePropertyProForma(input){
 const errors=[];const a={};
 for(const [,key,label,min,max] of PROFORMA_FIELDS){const v=input?.[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)errors.push(`${label}: enter a value from ${min} to ${max}.`);else a[key]=v;}
 for(const key of ['units','downtimeMonths','holdYears','refiYear','ioMonths','amortYears','loanTermYears','refiAmortYears','refiTermYears'])if(a[key]!==undefined&&!Number.isInteger(a[key]))errors.push(`${key} must be a whole number.`);
 a.exitMethod=input?.exitMethod;if(!['price','cap'].includes(a.exitMethod))errors.push('Choose an exit valuation method.');
 if(a.refiYear>=a.holdYears)errors.push('Refinance must precede the sale year.');
 if(a.ioMonths>=a.loanTermYears*12)errors.push('Interest-only period must end before loan maturity.');
 if(a.loanAmount>a.purchasePrice+a.rehab*(1+a.contingencyPct/100)+a.closingCosts)errors.push('Initial debt cannot exceed acquisition, renovation, and closing uses.');
 if(a.refiYear>0&&a.refiValue===0)errors.push('Enter the assumed refinance value.');
 if(errors.length){const e=new RangeError(errors.join('\n'));e.errors=errors;throw e;}
 const renovation=a.rehab*(1+a.contingencyPct/100),loanFees=a.loanAmount*a.loanPointsPct/100;
 const unleveredCost=a.purchasePrice+renovation+a.closingCosts+a.cashReserve,totalUses=unleveredCost+loanFees,equity=totalUses-a.loanAmount;
 const fixedBase=['taxAnnual','insuranceAnnual','maintenanceAnnual','utilitiesAnnual','hoaAnnual','otherExpensesAnnual'].reduce((sum,k)=>sum+a[k],0);
 const operating=(year)=>{
  const incomeFactor=(1+a.rentGrowthPct/100)**(year-1),expenseFactor=(1+a.expenseGrowthPct/100)**(year-1);
  const availableMonths=Math.max(0,Math.min(12,year*12-a.downtimeMonths));
  const potentialIncome=(a.units*a.rentMonthly+a.otherIncomeMonthly)*12*incomeFactor;
  const downtimeLoss=potentialIncome*(1-availableMonths/12),vacancyLoss=(potentialIncome-downtimeLoss)*a.vacancyPct/100;
  const effectiveIncome=potentialIncome-downtimeLoss-vacancyLoss,management=effectiveIncome*a.managementPct/100;
  const fixedExpenses=fixedBase*expenseFactor,operatingExpenses=fixedExpenses+management,noi=effectiveIncome-operatingExpenses,capex=a.capexAnnual*expenseFactor;
  return {year,potentialIncome,downtimeLoss,vacancyLoss,effectiveIncome,fixedExpenses,management,operatingExpenses,noi,capex,operatingCash:noi-capex,...Object.fromEntries(['taxAnnual','insuranceAnnual','maintenanceAnnual','utilitiesAnnual','hoaAnnual','otherExpensesAnnual'].map(k=>[k,a[k]*expenseFactor]))};
 };
 const annual=Array.from({length:a.holdYears},(_,i)=>({...operating(i+1),interest:0,principal:0,debtService:0,balloon:0,refinanceNet:0,refinanceLoan:0,refinancePayoff:0,refinanceFees:0}));
 const monthly=[];let balance=a.loanAmount,rate=a.interestPct,start=0,amort=a.amortYears*12,maturity=a.loanTermYears*12,io=a.ioMonths,scheduled=payment(balance,rate,amort);
 for(let month=1;month<=a.holdYears*12;month++){
  const row=annual[Math.floor((month-1)/12)],opening=balance,age=month-start,interest=balance*rate/1200;
  const paid=balance===0?0:age<=io?interest:Math.min(scheduled,interest+balance),principal=Math.max(0,paid-interest);
  balance=Math.max(0,balance-principal);let balloon=0,refinanceNet=0,refinanceLoan=0,refinancePayoff=0,refinanceFees=0;
  if(a.refiYear>0&&month===a.refiYear*12){
   refinanceLoan=a.refiValue*a.refiLtvPct/100;refinancePayoff=balance;refinanceFees=refinanceLoan*a.refiCostsPct/100;refinanceNet=refinanceLoan-refinancePayoff-refinanceFees;
   balance=refinanceLoan;start=month;rate=a.refiInterestPct;amort=a.refiAmortYears*12;maturity=a.refiTermYears*12;io=0;scheduled=payment(balance,rate,amort);
  }else if(age>=maturity){balloon=balance;balance=0;}
  Object.entries({interest,principal,debtService:paid,balloon,refinanceNet,refinanceLoan,refinancePayoff,refinanceFees}).forEach(([key,value])=>row[key]+=value);
  row.balance=balance;monthly.push({month,year:row.year,opening,interest,principal,payment:paid,balloon,refinanceLoan,refinancePayoff,refinanceFees,refinanceNet,balance});
 }
 const forwardNoi=operating(a.holdYears+1).noi,exitValue=a.exitMethod==='price'?a.exitPrice:Math.max(0,forwardNoi/(a.exitCapPct/100));
 const saleCosts=exitValue*a.sellingCostsPct/100,exitDebt=balance,saleNet=exitValue-saleCosts-exitDebt+a.cashReserve;
 const levered=[-equity],unlevered=[-unleveredCost];const ratio=(n,d,m=1)=>d>0?n/d*m:null;
 for(const row of annual){
  row.dscr=ratio(row.noi,row.debtService);row.cashBeforeCapital=row.operatingCash-row.debtService;
  row.saleNet=row.year===a.holdYears?saleNet:0;
  row.cashFlow=row.cashBeforeCapital-row.balloon+row.refinanceNet+row.saleNet;
  row.cashOnCashPct=ratio(row.cashBeforeCapital,equity,100);
  row.breakEvenOccupancyPct=ratio(row.fixedExpenses+row.capex+row.debtService,row.potentialIncome*(1-a.managementPct/100),100);
  levered.push(row.cashFlow);unlevered.push(row.operatingCash+(row.year===a.holdYears?exitValue-saleCosts+a.cashReserve:0));
 }
 const irr=annualIrr(levered),unleveredIrr=annualIrr(unlevered),contributions=-levered.filter(v=>v<0).reduce((s,v)=>s+v,0),distributions=levered.filter(v=>v>0).reduce((s,v)=>s+v,0);
 const warnings=[];if(a.exitMethod==='cap'&&forwardNoi<=0)warnings.push('Forward NOI is nonpositive; income-capitalized sale value is zero.');
 if(annual.some(r=>r.balloon>0))warnings.push('A loan matures during the hold: its balloon payoff is a cash requirement.');
 if(annual.some(r=>r.cashFlow<0))warnings.push('Some years require additional equity contributions.');
 if(irr.reason)warnings.push(irr.reason);
 return {version:PROFORMA_VERSION,assumptions:a,uses:{purchase:a.purchasePrice,renovation,closing:a.closingCosts,loanFees,cashReserve:a.cashReserve,total:totalUses},sources:{loan:a.loanAmount,equity},annual,monthly,levered,unlevered,exit:{value:exitValue,saleCosts,debtPayoff:exitDebt,reserveReturned:a.cashReserve,net:saleNet,forwardNoi},returns:{irrPct:irr.value,unleveredIrrPct:unleveredIrr.value,npv:npv(levered,a.discountPct/100),equityMultiple:ratio(distributions,contributions),totalProfit:levered.reduce((s,v)=>s+v,0),contributions,distributions},warnings};
}
export function proFormaSensitivity(input){return [-10,0,10].flatMap(rentChange=>[-10,0,10].map(exitChange=>{const a={...input,rentMonthly:input.rentMonthly*(1+rentChange/100),exitPrice:input.exitPrice*(1+exitChange/100),exitCapPct:input.exitCapPct/(1+exitChange/100)};try{const r=calculatePropertyProForma(a);return {rentChange,exitChange,npv:r.returns.npv,irrPct:r.returns.irrPct};}catch(error){if(!(error instanceof RangeError))throw error;return {rentChange,exitChange,npv:null,irrPct:null,reason:'Stress assumptions exceed supported input bounds.'};}}));}
export const PROFORMA_CONVENTIONS=[
 'Pre-tax USD model. All prices, rents, costs, growth, financing and exit values are user assumptions, not forecasts or appraisals.',
 'Rent is per unit; other income is per property. Vacancy applies after initial downtime. Fixed costs continue during downtime.',
 'NOI excludes financing and capital replacements. Capital replacement budgets are modeled as spent; initial cash reserves are held unchanged and recovered on sale.',
 'Debt uses monthly payments, annual nominal rates divided by 12, explicit interest-only periods and balloon maturity. Amortization begins after interest-only months; maturity does not extend.',
 'Refinance closes after that year’s scheduled payments, pays off the remaining old balance, and incurs fees on new principal. Exit occurs after the final year’s operations and scheduled debt payment.',
 'Income-capitalized exit uses next-year NOI. Entered resale price is a future exit assumption. Cash flows and NPV/IRR use year-end timing; IRR is withheld for multiple sign changes.',
 'No income tax, depreciation recapture, tax reassessment, transaction-specific lender covenants, construction draw schedule or partnership waterfall is modeled. Assessments never auto-fill price or taxes.',
];
