import {PROFORMA_USE_LABELS,PROFORMA_FIELDS,PROFORMA_CONVENTIONS,PROFORMA_VERSION,calculatePropertyProForma,proFormaSensitivity} from './property-proforma.mjs';
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
const pct=v=>v==null?'Not reported':`${v.toFixed(2)}%`;
export function scenarioDocument({name,origin,assumptions,property=null}) {
 calculatePropertyProForma(assumptions);
 // Persist only these public, descriptive fields; never an entire evidence/provider response.
 const safeProperty=property?Object.fromEntries(['address','parcelId','recordKey','jurisdiction','assessmentYear','sourceUrl','retrievedAt','sourceDataEditedAt'].filter(k=>['string','number'].includes(typeof property[k])).map(k=>[k,String(property[k]).slice(0,1000)])):null;
 return {schema:'property-proforma-v1',modelVersion:PROFORMA_VERSION,name:String(name||'Property scenario').slice(0,120),origin:origin==='illustrative'?'illustrative':'user assumptions',createdAt:new Date().toISOString(),assumptions:{...assumptions},property:safeProperty};
}
export function parseScenario(text){
 if(text.length>100000)throw Error('Scenario file is too large.');
 const doc=JSON.parse(text);if(doc.schema!=='property-proforma-v1')throw Error('Unsupported scenario format.');
 const assumptions=Object.fromEntries([...PROFORMA_FIELDS.map(f=>[f[1],doc.assumptions?.[f[1]]]),['exitMethod',doc.assumptions?.exitMethod]]);
 return scenarioDocument({...doc,assumptions});
}
const reportRows=[['Potential income','potentialIncome'],['Initial downtime loss','downtimeLoss'],['Vacancy / collection loss','vacancyLoss'],['Collected income','effectiveIncome'],['Operating expenses','operatingExpenses'],['Net operating income','noi'],['Capital replacements','capex'],['Scheduled debt payments','debtService'],['Maturity balloon','balloon'],['Net refinance proceeds','refinanceNet'],['Net sale proceeds + reserve','saleNet'],['Equity cash flow','cashFlow']];
export function proFormaCsv(doc){const r=calculatePropertyProForma(doc.assumptions);const safe=v=>'"'+String(v??'').replace(/^\s*[=+@\-]/,"'$&").replaceAll('"','""')+'"';return [['Scenario',doc.name],['Status',doc.origin],['Property',doc.property?.address||'No property linked'],['Initial equity',r.sources.equity],['Metric',...r.annual.map(x=>`Year ${x.year}`)],...reportRows.map(([label,key])=>[label,...r.annual.map(x=>x[key])])].map(row=>row.map(v=>typeof v==='number'?v:safe(v)).join(',')).join('\r\n');}
export function proFormaReport(doc){
 const r=calculatePropertyProForma(doc.assumptions),e=escapeHtml;
 const yearGroups=Array.from({length:Math.ceil(r.annual.length/5)},(_,i)=>r.annual.slice(i*5,i*5+5));
 const annualTables=yearGroups.map(years=>`<section class="annual-block"><h3>Years ${years[0].year}–${years.at(-1).year}</h3><table><thead><tr><th>USD</th>${years.map(y=>`<th>Year ${y.year}</th>`).join('')}</tr></thead><tbody>${reportRows.map(([label,key])=>`<tr><th>${label}</th>${years.map(y=>`<td>${money(y[key])}</td>`).join('')}</tr>`).join('')}<tr><th>DSCR (scheduled debt)</th>${years.map(y=>`<td>${y.dscr==null?'—':y.dscr.toFixed(2)+'×'}</td>`).join('')}</tr></tbody></table></section>`).join('');
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(doc.name)} — Property pro forma</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#182324;max-width:1100px;margin:40px auto;padding:0 24px}h1{font-size:36px;line-height:1.1}h2{margin-top:36px}small{color:#47565b}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{text-align:right;padding:8px;border-bottom:1px solid #d7dddf}th:first-child,td:first-child{text-align:left}thead{background:#edf1f1}.metrics{display:flex;gap:36px;flex-wrap:wrap}.metrics strong{display:block;font-size:24px}.scroll{overflow:auto}dt{font-weight:600}dd{margin:0 0 10px}a{color:#194f61}@media print{body{margin:0;font-size:10px}h1{font-size:26px}.scroll{overflow:visible}th,td{padding:4px}tr{break-inside:avoid}.annual-block{break-inside:avoid;margin-bottom:24px}@page{size:landscape;margin:12mm}</style><main><small>ST. LOUIS PROPERTY WORKSPACE · PRE-TAX USD · MODEL ${PROFORMA_VERSION}</small><h1>${e(doc.name)}</h1><p><strong>${e(doc.property?.address||'No property linked')}</strong><br>${e(doc.origin==='illustrative'?'ILLUSTRATIVE EXAMPLE — not property-specific underwriting':'USER-ENTERED ASSUMPTIONS — verify before making a decision')}</p><p>Generated ${e(doc.createdAt)}. Hold: ${r.assumptions.holdYears} years.</p><div class="metrics"><div>Initial equity<strong>${money(r.sources.equity)}</strong></div><div>Levered IRR<strong>${pct(r.returns.irrPct)}</strong></div><div>NPV<strong>${money(r.returns.npv)}</strong></div><div>Equity multiple<strong>${r.returns.equityMultiple?.toFixed(2)??'—'}×</strong></div></div>${r.warnings.map(w=>`<p><strong>${e(w)}</strong></p>`).join('')}<h2>Sources and uses</h2><table>${Object.entries(r.uses).map(([k,v])=>`<tr><th>${e(PROFORMA_USE_LABELS[k]||k)}</th><td>${money(v)}</td></tr>`).join('')}<tr><th>Initial debt</th><td>${money(r.sources.loan)}</td></tr><tr><th>Initial equity</th><td>${money(r.sources.equity)}</td></tr></table><h2>Annual cash flow</h2>${annualTables}<h2>Assumptions</h2><table>${PROFORMA_FIELDS.map(([group,key,label])=>`<tr><th>${e(group)} / ${e(label)}</th><td>${e(r.assumptions[key])}</td></tr>`).join('')}<tr><th>Exit method</th><td>${e(r.assumptions.exitMethod)}</td></tr></table><h2>Evidence and model conventions</h2><dl>${Object.entries(doc.property||{}).map(([k,v])=>`<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>${PROFORMA_CONVENTIONS.map(c=>`<p>${e(c)}</p>`).join('')}<p>Use your browser’s Print command to save a PDF. The XLSX export includes the editable assumptions and monthly debt formulas.</p></main></html>`;
}
/** Editable workbook: all cash flows and debt recalculate from the Inputs sheet. */
export async function createProFormaWorkbook(doc){
 const {default:ExcelJS}=await import('exceljs');const w=new ExcelJS.Workbook();w.creator='Ian Helfrich · St. Louis property workspace';w.created=new Date(doc.createdAt);w.calcProperties.fullCalcOnLoad=true;
 const r=calculatePropertyProForma(doc.assumptions),a=r.assumptions,full=calculatePropertyProForma({...a,holdYears:30});
 const sheets=Object.fromEntries(['Read me','Inputs','SourcesUses','Debt','CashFlow','Returns','Sensitivity'].map(name=>[name,w.addWorksheet(name)]));
 const input=sheets.Inputs;input.addRow(['Assumption','Value','Group']);const refs={};
 PROFORMA_FIELDS.forEach(([group,key,label,min,max])=>{const row=input.addRow([label,a[key],group]);refs[key]=`Inputs!$B$${row.number}`;row.getCell(2).font={color:{argb:'FF145CA0'}};row.getCell(2).dataValidation={type:'decimal',operator:'between',formulae:[min,max],showErrorMessage:true,error:'Enter a value within the documented bounds.'};});
 const exitRow=input.addRow(['Exit method (price or cap)',a.exitMethod]);refs.exitMethod=`Inputs!$B$${exitRow.number}`;exitRow.getCell(2).dataValidation={type:'list',allowBlank:false,formulae:['"price,cap"']};
 const I=k=>refs[k],F=(sheet,cell,formula,result)=>{sheet.getCell(cell).value={formula,result:result??''};};
 const su=sheets.SourcesUses;su.addRow(['Sources and uses','USD']);
 [['Purchase',I('purchasePrice'),r.uses.purchase],['Renovation + contingency',`${I('rehab')}*(1+${I('contingencyPct')}/100)`,r.uses.renovation],['Acquisition closing',I('closingCosts'),r.uses.closing],['Cash reserve',I('cashReserve'),r.uses.cashReserve],['Initial debt fees',`${I('loanAmount')}*${I('loanPointsPct')}/100`,r.uses.loanFees],['Total uses','SUM(B2:B6)',r.uses.total],['Initial loan',I('loanAmount'),r.sources.loan],['Initial equity','B7-B8',r.sources.equity]].forEach(([label,formula,value],i)=>{su.getCell(`A${i+2}`).value=label;F(su,`B${i+2}`,formula,value);});
 const debt=sheets.Debt;debt.addRow(['Month','Year','Opening balance','Interest','Payment','Principal','Balloon','Refinance loan','Refinance payoff','Refinance fees','Net refinance','Ending balance']);
 for(let month=1;month<=360;month++){
  const n=month+1,d=full.monthly[month-1],after=`AND(${I('refiYear')}>0,A${n}>${I('refiYear')}*12)`,event=`AND(${I('refiYear')}>0,A${n}=${I('refiYear')}*12)`,rate=`IF(${after},${I('refiInterestPct')},${I('interestPct')})/1200`,age=`A${n}-IF(${after},${I('refiYear')}*12,0)`,term=`IF(${after},${I('refiTermYears')},${I('loanTermYears')})*12`,principal=`IF(${after},${I('refiValue')}*${I('refiLtvPct')}/100,${I('loanAmount')})`,amort=`IF(${after},${I('refiAmortYears')},${I('amortYears')})*12`;
  debt.getCell(`A${n}`).value=month;debt.getCell(`B${n}`).value=d.year;
  F(debt,`C${n}`,month===1?I('loanAmount'):`L${n-1}`,d.opening);
  F(debt,`D${n}`,`C${n}*(${rate})`,d.interest);
  F(debt,`E${n}`,`IF(C${n}=0,0,IF(AND(NOT(${after}),A${n}<=${I('ioMonths')}),D${n},MIN(C${n}+D${n},-PMT(${rate},${amort},${principal}))))`,d.payment);
  F(debt,`F${n}`,`MAX(0,E${n}-D${n})`,d.principal);
  F(debt,`G${n}`,`IF(AND(NOT(${event}),${age}>=${term}),MAX(0,C${n}-F${n}),0)`,d.balloon);
  F(debt,`H${n}`,`IF(${event},${I('refiValue')}*${I('refiLtvPct')}/100,0)`,d.refinanceLoan);
  F(debt,`I${n}`,`IF(${event},MAX(0,C${n}-F${n}),0)`,d.refinancePayoff);
  F(debt,`J${n}`,`H${n}*${I('refiCostsPct')}/100`,d.refinanceFees);
  F(debt,`K${n}`,`H${n}-I${n}-J${n}`,d.refinanceNet);
  F(debt,`L${n}`,`MAX(0,C${n}-F${n}-G${n}+H${n}-I${n})`,d.balance);
 }
 const cf=sheets.CashFlow;cf.addRow(['Year','Potential income','Downtime loss','Vacancy loss','Collected income','Property taxes','Insurance','Maintenance','Utilities','HOA','Other expenses','Management','Operating expenses','NOI','Capital replacements','Scheduled debt','Balloon','Net refinance','Net exit + reserve','Cash before capital','Equity cash flow','Debt balance','DSCR','Cash-on-cash','Break-even occupancy','Carry sign','Sign change','Unlevered cash flow']);
 cf.getCell('A2').value=0;F(cf,'U2','-SourcesUses!B9',-r.sources.equity);F(cf,'AB2','-(SourcesUses!B7-SourcesUses!B6)',r.unlevered[0]);F(cf,'Z2','SIGN(U2)',Math.sign(-r.sources.equity));cf.getCell('AA2').value=0;
 let carry=Math.sign(-r.sources.equity),changes=0;
 for(let year=1;year<=30;year++){
  const n=year+2,y=full.annual[year-1],actual=r.annual[year-1],active=`A${n}<=${I('holdYears')}`;cf.getCell(`A${n}`).value=year;
  F(cf,`B${n}`,`(${I('units')}*${I('rentMonthly')}+${I('otherIncomeMonthly')})*12*(1+${I('rentGrowthPct')}/100)^(A${n}-1)`,y.potentialIncome);
  F(cf,`C${n}`,`B${n}*(1-MAX(0,MIN(12,A${n}*12-${I('downtimeMonths')}))/12)`,y.downtimeLoss);
  F(cf,`D${n}`,`(B${n}-C${n})*${I('vacancyPct')}/100`,y.vacancyLoss);F(cf,`E${n}`,`B${n}-C${n}-D${n}`,y.effectiveIncome);
  ['taxAnnual','insuranceAnnual','maintenanceAnnual','utilitiesAnnual','hoaAnnual','otherExpensesAnnual'].forEach((key,i)=>F(cf,`${String.fromCharCode(70+i)}${n}`,`${I(key)}*(1+${I('expenseGrowthPct')}/100)^(A${n}-1)`,y[key]));
  F(cf,`L${n}`,`E${n}*${I('managementPct')}/100`,y.management);F(cf,`M${n}`,`SUM(F${n}:L${n})`,y.operatingExpenses);F(cf,`N${n}`,`E${n}-M${n}`,y.noi);
  F(cf,`O${n}`,`${I('capexAnnual')}*(1+${I('expenseGrowthPct')}/100)^(A${n}-1)`,y.capex);
  [['P','E','debtService'],['Q','G','balloon'],['R','K','refinanceNet']].forEach(([col,dc,key])=>F(cf,`${col}${n}`,`SUMIF(Debt!$B$2:$B$361,A${n},Debt!$${dc}$2:$${dc}$361)`,y[key]));
  F(cf,`S${n}`,`IF(A${n}=${I('holdYears')},Returns!B7,0)`,actual?.saleNet||0);F(cf,`T${n}`,`N${n}-O${n}-P${n}`,y.cashBeforeCapital);
  F(cf,`U${n}`,`IF(${active},T${n}-Q${n}+R${n}+S${n},0)`,actual?.cashFlow||0);
  F(cf,`V${n}`,`INDEX(Debt!$L$2:$L$361,A${n}*12)`,y.balance);F(cf,`W${n}`,`IF(P${n}>0,N${n}/P${n},"")`,y.dscr);
  F(cf,`X${n}`,`IF(SourcesUses!B9>0,T${n}/SourcesUses!B9,"")`,y.cashOnCashPct==null?null:y.cashOnCashPct/100);
  F(cf,`Y${n}`,`IF(B${n}*(1-${I('managementPct')}/100)>0,(SUM(F${n}:K${n})+O${n}+P${n})/(B${n}*(1-${I('managementPct')}/100)),"")`,y.breakEvenOccupancyPct==null?null:y.breakEvenOccupancyPct/100);
  const sign=Math.abs(actual?.cashFlow||0)>1e-8?Math.sign(actual.cashFlow):0,change=sign&&carry&&sign!==carry?1:0;changes+=change;if(sign)carry=sign;
  F(cf,`Z${n}`,`IF(ABS(U${n})>0.00000001,SIGN(U${n}),Z${n-1})`,carry);F(cf,`AA${n}`,`IF(AND(ABS(U${n})>0.00000001,Z${n-1}<>0,SIGN(U${n})<>Z${n-1}),1,0)`,change);
  F(cf,`AB${n}`,`IF(${active},N${n}-O${n}+IF(A${n}=${I('holdYears')},Returns!B3-Returns!B4+${I('cashReserve')},0),0)`,r.unlevered[year]||0);
 }
 const rt=sheets.Returns;rt.addRow(['Return metric','Value']);
 const expenseBase=['taxAnnual','insuranceAnnual','maintenanceAnnual','utilitiesAnnual','hoaAnnual','otherExpensesAnnual'].map(I).join('+');
 const forward=`((${I('units')}*${I('rentMonthly')}+${I('otherIncomeMonthly')})*12*(1+${I('rentGrowthPct')}/100)^${I('holdYears')}*MAX(0,MIN(12,(${I('holdYears')}+1)*12-${I('downtimeMonths')}))/12*(1-${I('vacancyPct')}/100))*(1-${I('managementPct')}/100)-(${expenseBase})*(1+${I('expenseGrowthPct')}/100)^${I('holdYears')}`;
 [['Next-year NOI',forward,r.exit.forwardNoi],['Exit gross value',`IF(${I('exitMethod')}="cap",MAX(0,B2/(${I('exitCapPct')}/100)),${I('exitPrice')})`,r.exit.value],['Sale costs',`B3*${I('sellingCostsPct')}/100`,r.exit.saleCosts],['Exit debt payoff',`INDEX(Debt!L2:L361,${I('holdYears')}*12)`,r.exit.debtPayoff],['Reserve returned',I('cashReserve'),r.exit.reserveReturned],['Net exit proceeds','B3-B4-B5+B6',r.exit.net],['Levered IRR','IF(AND(SUM(CashFlow!AA3:AA32)=1,CashFlow!U2<0),IFERROR(IRR(CashFlow!U2:U32),""),"")',r.returns.irrPct==null?null:r.returns.irrPct/100],['NPV',`CashFlow!U2+NPV(${I('discountPct')}/100,CashFlow!U3:U32)`,r.returns.npv],['Equity multiple','IF(SUMIF(CashFlow!U2:U32,"<0",CashFlow!U2:U32)<0,-SUMIF(CashFlow!U2:U32,">0",CashFlow!U2:U32)/SUMIF(CashFlow!U2:U32,"<0",CashFlow!U2:U32),"")',r.returns.equityMultiple],['Total net profit','SUM(CashFlow!U2:U32)',r.returns.totalProfit],['Cash-flow sign changes','SUM(CashFlow!AA3:AA32)',changes]].forEach(([label,formula,value],i)=>{rt.getCell(`A${i+2}`).value=label;F(rt,`B${i+2}`,formula,value);});
 const sens=sheets.Sensitivity;sens.addRow(['Snapshot only: regenerate in app after changing assumptions']);sens.addRow(['Monthly rent change (%)','Exit value change (%)','NPV','Levered IRR']);proFormaSensitivity(a).forEach(x=>sens.addRow([x.rentChange,x.exitChange,x.npv,x.irrPct==null?'':x.irrPct/100]));
 const read=sheets['Read me'];[doc.name,doc.property?.address||'No property linked',doc.origin==='illustrative'?'ILLUSTRATIVE EXAMPLE — NOT PROPERTY-SPECIFIC UNDERWRITING':'USER ASSUMPTIONS',`Generated ${doc.createdAt}; model ${PROFORMA_VERSION}`,'Edit Inputs values to recalculate SourcesUses, Debt, CashFlow and Returns. Revalidate changed inputs in the app. Debt and operations project 30 years; equity cash flows stop at the selected hold. Sensitivity is a dated snapshot.','The workbook has no macros or external data connections. IRR is blank if not uniquely reportable or spreadsheet iteration fails; check NPV and annual cash flows.',...PROFORMA_CONVENTIONS,...Object.entries(doc.property||{}).map(([k,v])=>`${k}: ${v}`)].forEach(line=>read.addRow([line]));
 for(const s of Object.values(sheets)){s.views=[{state:'frozen',ySplit:1,xSplit:s===cf?1:0}];s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF203439'}};s.columns.forEach((c,i)=>{c.width=i===0?36:20;});s.eachRow((row,n)=>{if(n>1)row.eachCell(cell=>{if(typeof cell.value==='number'||cell.value?.formula)cell.numFmt='#,##0.00;[Red](#,##0.00);–';});});s.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};}
 input.getColumn(1).width=48;read.getColumn(1).width=125;read.eachRow(row=>{row.getCell(1).alignment={wrapText:true,vertical:'top'};row.height=45;});for(const col of ['X','Y'])cf.getColumn(col).numFmt='0.00%';rt.getCell('B8').numFmt='0.00%';sens.getColumn(4).numFmt='0.00%';cf.getColumn('Z').hidden=true;cf.getColumn('AA').hidden=true;
 return w;
}
export async function proFormaXlsx(doc){return (await createProFormaWorkbook(doc)).xlsx.writeBuffer();}
