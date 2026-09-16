const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const file=path.resolve('public/teaching/market-mechanics/index.html');
assert.ok(fs.existsSync(file),'Public lab must exist');
const code=fs.readFileSync(file,'utf8').match(/<script id="economics">([\s\S]*?)<\/script>/)[1];
const c={URLSearchParams};vm.createContext(c);vm.runInContext(code,c);
const base={a:60,b:.5,c:10,d:.5,mode:'free',tax:10,control:25};
const eq=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
let count=0;
for(const a of [40,60,100])for(const b of [.05,.5,2])for(const d of [.05,.5,2])for(const cc of [0,10,30])for(const mode of ['free','tax','ceiling','floor'])for(const tax of [0,10,100]){const r=c.solve({...base,a,b,c:cc,d,mode,tax});eq(r.cs+r.ps+r.revenue+r.dwl,r.total0);assert.ok(r.q>=0&&r.cs>=-1e-7&&r.ps>=-1e-7);count++;}
for(const [mode,control,want]of [['tax',25,[40,40,30,400,400,50]],['ceiling',25,[30,25,25,825,225,200]],['floor',45,[30,45,45,225,825,200]]]){const r=c.solve({...base,mode,control});['q','pb','pn','cs','ps','dwl'].forEach((k,i)=>eq(r[k],want[i]));}
for(const fromMode of ['free','tax','ceiling','floor'])for(const toMode of ['free','tax','ceiling','floor']){
 const from={...base,mode:fromMode,control:45,tax:70},to={...base,mode:toMode,a:90,b:1,c:20,d:.2,control:25,tax:15};
 assert.equal(JSON.stringify(c.interpolateMarket(from,to,0)),JSON.stringify(from));assert.equal(JSON.stringify(c.interpolateMarket(from,to,1)),JSON.stringify(to));
 for(let i=0;i<=100;i++){const r=c.solve(c.interpolateMarket(from,to,i/100));eq(r.cs+r.ps+r.revenue+r.dwl,r.total0);}
}
assert.equal(JSON.stringify(c.parseScenario(c.scenarioHash(base))),JSON.stringify(base));
assert.equal(c.parseScenario('#a=nan&b=.5&c=10&d=.5&mode=tax&tax=10&control=25'),null);
assert.equal(c.parseScenario('#a=60&b=0&c=10&d=.5&mode=tax&tax=10&control=25'),null);
assert.equal(c.parseScenario('#a=60&b=.5&c=10&d=.5&mode=script&tax=10&control=25'),null);
console.log(`PASS: ${count} market cases, 1616 transition frames, exact fixtures and URL validation`);
// Exercise actual page initialization as well as the pure economic solver.
// This catches rendering failures that leave otherwise correct readouts visible.
import('happy-dom').then(({Window})=>{
 const window=new Window({url:'http://localhost/teaching/market-mechanics/'});
 const html=fs.readFileSync(file,'utf8');
 window.document.write(html.replace(/<script[\s\S]*?<\/script>/g,''));
 window.ResizeObserver=class {observe(){} disconnect(){}};
 for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))window.eval(script[1]);
 assert.ok(window.document.querySelectorAll('#chart line').length>5,'Graph must render on startup');
 assert.ok(window.document.querySelector('#chart').getAttribute('viewBox'),'Graph must have dimensions');
 window.happyDOM.abort();
 console.log('PASS: full page initialization and SVG rendering');
}).catch(e=>{console.error(e);process.exitCode=1;});
