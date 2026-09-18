const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync('public/teaching/market-mechanics/index.html','utf8');
const c={URLSearchParams};vm.createContext(c);vm.runInContext(html.match(/<script id="economics">([\s\S]*?)<\/script>/)[1],c);
const market={a:180,b:3,c:60,d:1,mode:'tax',tax:16,control:90};
const eq=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('manual equations accept either orientation and reject executable/nonlinear input',()=>{
 assert.equal(typeof c.parseEquation,'function','Equation parser must exist');
 for(const [input,want] of [['P = 180 − 3Q',[180,-3]],['Q = 60 - 1/3 P',[180,-3]],['P=60+Q',[60,1]],['2P + 6Q = 360',[180,-3]],['P=60',[60,0]]]){
  const r=c.parseEquation(input);eq(r.intercept,want[0]);eq(r.slope,want[1]);
 }
 for(const input of ['P=Q*Q','P=alert(1)','P=1/0-Q','P=1e999-Q','P=2**Q','P=','Q=30','P=180-3Q junk','P=180-3QQ','P=180;location="bad"'])assert.throws(()=>c.parseEquation(input));
});
test('large equations round-trip through share URLs without legacy slider caps',()=>{
 const r=c.parseScenario(c.scenarioHash({...market,a:300,b:7}));
 assert.ok(r,'Scenario above 100 must restore');eq(r.a,300);eq(r.b,7);
 assert.equal(c.parseScenario('#a=10&b=1&c=20&d=1&mode=free&tax=0&control=0'),null);
 assert.equal(c.parseScenario('#a=&b=1&c=0&d=1&mode=free&tax=0&control=0'),null);
});
test('tax and subsidy fixtures reconcile private and government welfare',()=>{
 for(const [s,want] of [[market,[26,102,86,1014,338,416,32]], [{...market,a:300,b:7},[28,104,88,2744,392,448,16]], [{...market,a:140,b:2,c:20,mode:'subsidy',tax:30},[50,40,70,2500,1250,-1500,150]]]){
  const r=c.solve(s);['q','pb','pn','cs','ps','revenue','dwl'].forEach((k,i)=>eq(r[k],want[i]));eq(r.cs+r.ps+r.revenue+r.dwl,r.total0);
 }
});
test('horizontal supply gives full pass-through and finite results for policies',()=>{
 for(const mode of ['free','tax','subsidy','ceiling','floor']){
  const s={...market,d:0,mode},r=c.solve(s);eq(r.buyerShare,1);eq(r.cs+r.ps+r.revenue+r.dwl,r.total0);
  assert.ok(['q','cs','ps','revenue','dwl'].every(k=>Number.isFinite(r[k])));
 }
 const r=c.solve({...market,d:0,mode:'subsidy'});eq(r.pn,60);eq(r.pb,44);
});
test('automatic axes include the second city and subsidy prices, even below zero',()=>{
 assert.equal(typeof c.marketAxes,'function','Shared axis calculation must exist');
 for(const s of [market,{...market,a:300,b:7},{...market,a:140,b:2,c:20,mode:'subsidy',tax:300}]){
  const a=c.marketAxes(s),r=c.solve(s);assert.ok(a.pmax>s.a&&a.qmax>r.q);assert.ok(a.pmin<=Math.min(0,r.pb));
 }
});
test('UI applies equations, keeps invalid edits from corrupting state, and explains subsidy',async()=>{
 const {Window}=await import('happy-dom');const w=new Window({url:'http://localhost/teaching/market-mechanics/'});
 w.document.write(html.replace(/<script[\s\S]*?<\/script>/g,''));w.ResizeObserver=class{observe(){}};w.matchMedia=()=>({matches:true,addEventListener(){}});
 try{
  for(const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))w.eval(s[1]);
  const $=id=>w.document.getElementById(id);
  assert.ok($('demand-equation'),'Demand equation field must exist');
  $('demand-equation').value='P=180-3Q';$('supply-equation').value='P=60+Q';$('equation-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.equal($('q').textContent,'30');assert.equal($('a').value,'180');
  $('probe-quantity').value='20';$('probe-quantity').dispatchEvent(new w.Event('change'));
  assert.match($('unit-reading').textContent,/120/);assert.match($('unit-reading').textContent,/80/);
  $('demand-equation').value='P=Q*Q';$('equation-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.equal($('q').textContent,'30');assert.ok($('equation-error').textContent);
  $('preset').value='childcare';$('preset').dispatchEvent(new w.Event('change'));
  assert.equal($('q').textContent,'50');assert.match($('revenue').textContent,/1,500/);assert.match($('total').textContent,/2,250/);
  assert.match($('welfare-working').textContent,/150/);assert.match($('government-label').textContent,/cost/i);
  $('axis-q').value='125';$('axis-p').value='350';$('axis-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.equal($('chart').dataset.qmax,'125');assert.equal($('chart').dataset.pmax,'350');
  assert.ok(!/NaN|Infinity/.test($('chart').innerHTML));
  $('reset').click();w.document.querySelector('[data-mode="ceiling"]').click();
  assert.match($('welfare-working').textContent,/825/);
  assert.match($('welfare-working').textContent,/0.5 × 30/,'Price controls need the full area formula, not a triangle assumption');
 }finally{w.happyDOM.abort();}
});
test('subsidy transitions preserve welfare identities and finite geometry',()=>{
 const modes=['free','tax','subsidy','ceiling','floor'];
 for(const fromMode of modes)for(const toMode of modes)for(let i=0;i<=40;i++){
  const s=c.interpolateMarket({...market,mode:fromMode},{...market,a:140,b:2,c:20,d:0,mode:toMode,tax:30},i/40),r=c.solve(s),a=c.marketAxes(s);
  eq(r.cs+r.ps+r.revenue+r.dwl,r.total0);assert.ok(Object.values(a).every(Number.isFinite));
 }
});
