import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {renderSessionReport} from '../../src/scripts/econ-session-report.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
import {publicQuestion,responseFeedback} from '../../src/lib/econ-practice/scoring.mjs';
test('session report distinguishes review from excluded receipts and preserves graphs and multipart keys',()=>{
 const window=new Window(),container=window.document.createElement('div'),bank=buildBank(),graph=bank.find(q=>q.graph),multi=bank.find(q=>q.format==='multipart');
 const answer=Object.fromEntries(multi.parts.map(p=>[p.id,p.answer+10]));
 const rows=[{item:publicQuestion(graph),response:graph.answer,...responseFeedback(graph,graph.answer),countsTowardResult:true},{item:publicQuestion(multi),response:answer,...responseFeedback(multi,answer),countsTowardResult:true},{item:publicQuestion(graph),response:graph.answer,...responseFeedback(graph,graph.answer),countsTowardResult:false}];
 renderSessionReport(container,{rows,bankVersion:'v',currentBankVersion:'v'});assert.equal(container.querySelectorAll('details').length,3);assert.equal(container.querySelectorAll('svg').length,2);assert.match(container.textContent,/1 of 2 counted answers/);for(const part of multi.parts)assert.ok(container.textContent.includes(part.prompt));
 const select=container.querySelector('select');select.value='review';select.dispatchEvent(new window.Event('change'));assert.equal(container.querySelectorAll('details').length,1);assert.ok(container.querySelector('summary').textContent.startsWith('2. Review'));
 select.value='excluded';select.dispatchEvent(new window.Event('change'));assert.equal(container.querySelectorAll('details').length,1);assert.match(container.querySelector('summary').textContent,/Excluded receipt/);window.happyDOM.abort();
});

test('session report shows terminal reasons without treating limits or provisional estimates as precision',()=>{
 const window=new Window(),container=window.document.createElement('div');
 const report={rows:[],bankVersion:'v',currentBankVersion:'v',progress:[{unit:1,name:'Choice',measurementResponses:8,measurementStatus:'calibrated',estimate:{theta:0.6,sd:0.3,interval:[0.01,1.19]}},{unit:2,name:'Markets',measurementResponses:4,measurementStatus:'provisional',estimate:{theta:-0.2,sd:0.6,interval:[-1.38,0.98]}},{unit:3,name:'Policy',measurementResponses:0,measurementStatus:'no-eligible-evidence',estimate:null}]};
 for(const [reason,message] of [['precision-and-coverage',/every required unit met/],['maximum-length',/Reaching the limit does not establish/],['session-length',/fixed question count/],['eligible-bank-exhausted',/no additional eligible questions/],['participant-ended',/You ended this session/]]){
 renderSessionReport(container,{...report,terminalReason:reason});assert.match(container.textContent,message);
 assert.match(container.textContent,/Calibrated model\. 8 eligible responses\. Theta 0.60; posterior SD 0.30; 95% posterior interval \[0.01, 1.19\]/);
 assert.match(container.textContent,/Provisional model\. 4 eligible responses/);assert.match(container.textContent,/No eligible evidence\. 0 eligible responses\. No estimate available/);assert.match(container.textContent,/not standardized scores or mastery classifications/);
 }
 window.happyDOM.abort();
});
