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
