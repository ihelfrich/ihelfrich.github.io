import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
const values=q=>[...q.prompt.matchAll(/−?\d+(?:\.\d+)?/g)].map(m=>Number(m[0].replace('−','-')));
const checks={
 'cobb-demand':([alpha,beta,income,px,py])=>alpha/(alpha+beta)*income/px,
 mrs:([x,y])=>y/x,
 'perfect-complements':([ratio,income,px,py])=>income/(px+py/ratio),
 quasilinear:([a,px,py])=>a*py/px,
 slutsky:([marshallian,x,incomeDerivative])=>marshallian+x*incomeDerivative,
 'elastic-demand':([intercept,slope,price])=>slope*price/(intercept-slope*price),
 'cost-min':([w,r,q])=>q*Math.sqrt(r/w),
 shephard:([coefficient,w,r,q])=>coefficient*q*Math.sqrt(r/w)/2,
 'competitive-supply':([fixed,p])=>p/2,
 cournot:([intercept,mc])=>(intercept-mc)/3,
 bertrand:([mc])=>mc,
 'mixed-strategy':([ul,ur,dl,dr])=>(dr-ur)/(ul-ur-dl+dr),
 'repeated-collusion':([cooperate,deviate,punish])=>(deviate-cooperate)/(deviate-punish),
 pigou:([slope,efficient])=>slope*efficient,
 insurance:([wealth,loss,probability])=>loss*probability,
 'national-saving':([y,c,g])=>y-c-g,
 solow:([saving,depreciation,initial])=>(saving/depreciation)**2,
 'golden-rule':([breakEven])=>(.5/breakEven)**2,
 'growth-accounting':([alpha,beta,y,k,l])=>y-alpha*k-beta*l,
 euler:([discount,one,gross,current])=>discount*gross*current,
 'present-value':([payment,rate])=>payment/(1+rate/100),
 'is-curve':([mpc,investment,sensitivity,g,r])=>(investment-sensitivity*r+g)/(1-mpc),
 'new-keynesian-phillips':([discount,slope,expected,gap,shock])=>discount*expected+slope*gap+shock,
 taylor:([intercept,response,target,gapResponse,inflation,gap])=>intercept+inflation+response*(inflation+target)+gapResponse*gap,
 'debt-dynamics':([one,anotherOne,debt,rate,deficit])=>(1+rate)/(1+rate)*debt+deficit,
 uip:([home,foreign])=>home-foreign,
 'real-exchange':([exchange,foreign,home])=>exchange*foreign/home
};
test('all undergraduate numeric keys agree with independently evaluated prompt quantities',()=>{
 const items=buildBank().filter(q=>q.course.startsWith('college-')&&q.format==='numeric');assert.equal(items.length,648);
 for(const q of items){assert.ok(checks[q.family],q.family);const expected=checks[q.family](values(q));assert.ok(Number.isFinite(expected)&&Math.abs(expected-q.answer)<.000501,`${q.id}: parsed ${values(q)}, expected ${expected}, key ${q.answer}`);}
});

test('repeated undergraduate micro calculations vary keyed outcomes',()=>{
 const bank=buildBank().filter(q=>q.course==='college-micro');
 for(const family of ['mrs','elastic-demand','mixed-strategy','repeated-collusion','insurance'])assert.ok(new Set(bank.filter(q=>q.family===family).map(q=>q.answer)).size>=5,family);
});

test('Solow and real-exchange variants require different calculated answers',()=>{
 const bank=buildBank().filter(q=>q.course==='college-macro');
 for(const family of ['solow','real-exchange'])assert.equal(new Set(bank.filter(q=>q.family===family).map(q=>q.answer)).size,24,family);
});
