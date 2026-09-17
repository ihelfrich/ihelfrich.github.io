/** Compare workbooks independently recalculated by Excel or LibreOffice with engine fixtures.
 * Usage: node scripts/st-louis/verify_proforma_workbooks.mjs RECALCULATED_DIR ENGINE_JSON_DIR
 * Each NAME.xlsx is paired with NAME.json containing calculatePropertyProForma output.
 */
import ExcelJS from 'exceljs';
import {readFile,readdir,writeFile} from 'node:fs/promises';import path from 'node:path';
const [recalculated,expectedDirectory]=process.argv.slice(2);if(!recalculated||!expectedDirectory)throw Error('Supply recalculated workbook directory and expected engine JSON directory.');
const report=[];let failures=0,total=0;
for(const filename of (await readdir(recalculated)).filter(x=>x.endsWith('.xlsx'))){
 const name=filename.slice(0,-5),engine=JSON.parse(await readFile(path.join(expectedDirectory,name+'.json'))),w=new ExcelJS.Workbook();await w.xlsx.readFile(path.join(recalculated,filename));let comparisons=0,maxError=0;
 const check=(sheet,cell,expected)=>{const c=w.getWorksheet(sheet).getCell(cell),actual=c.formula?(c.result??null):c.value;if(expected==null){if(actual!==''&&actual!=null){report.push({name,cell,actual,expected});failures++;}else comparisons++;return;}const error=Math.abs(actual-expected);if(typeof actual!=='number'||error>1e-5){report.push({name,sheet,cell,actual,expected});failures++;}else{maxError=Math.max(maxError,error);comparisons++;}};
 for(const [cell,expected] of Object.entries({B2:engine.exit.forwardNoi,B3:engine.exit.value,B4:engine.exit.saleCosts,B5:engine.exit.debtPayoff,B7:engine.exit.net,B8:engine.returns.irrPct==null?null:engine.returns.irrPct/100,B9:engine.returns.npv,B10:engine.returns.equityMultiple,B11:engine.returns.totalProfit}))check('Returns',cell,expected);
 for(const row of engine.monthly)for(const [col,key]of Object.entries({C:'opening',D:'interest',E:'payment',F:'principal',G:'balloon',H:'refinanceLoan',I:'refinancePayoff',J:'refinanceFees',K:'refinanceNet',L:'balance'}))check('Debt',col+(row.month+1),row[key]);
 for(const row of engine.annual)for(const [col,key]of Object.entries({B:'potentialIncome',C:'downtimeLoss',D:'vacancyLoss',E:'effectiveIncome',M:'operatingExpenses',N:'noi',O:'capex',P:'debtService',Q:'balloon',R:'refinanceNet',S:'saleNet',T:'cashBeforeCapital',U:'cashFlow',V:'balance'}))check('CashFlow',col+(row.year+2),row[key]);
 report.push({name,comparisons,maxError});total+=comparisons;
}
if(!total)throw Error('No workbooks were compared.');const result={failures,comparisons:total,report};await writeFile(path.join(expectedDirectory,'comparison.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({failures,comparisons:total,cases:report.filter(x=>!x.cell),firstFailures:report.filter(x=>x.cell).slice(0,5)},null,2));process.exitCode=failures?1:0;
