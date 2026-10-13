import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
const items=buildBank().filter(q=>q.course==='ap-macro'&&q.format==='numeric');
const values=q=>[...q.prompt.matchAll(/−?\d+(?:\.\d+)?/g)].map(m=>Number(m[0].replace('−','-')));
const checks={
 opportunity:([machines,food])=>food/machines,
 gdp:([c,i,g,x,m])=>c+i+g+x-m,
 deflator:([nominal,index,base])=>nominal*base/index,
 unemployment:([e,u])=>100*u/(e+u),
 participation:([population,e,u])=>100*(e+u)/population,
 inflation:([before,after])=>100*(after/before-1),
 'real-interest':([nominal,inflation])=>nominal-inflation,
 multiplier:([mpc,change])=>change/(1-mpc),
 'tax-multiplier':([mpc,change])=>-mpc*change/(1-mpc),
 'balanced-budget':([mpc,change])=>change/(1-mpc)-mpc*change/(1-mpc),
 'bond-price':([face,price])=>100*(face/price-1),
 'bank-reserves':([ratio,deposits,reserves])=>reserves-ratio*deposits/100,
 'deposit-multiplier':([ratio,injection])=>injection/ratio,
 'quantity-theory':([money,output])=>money-output,
 debt:([initial,deficit])=>initial+deficit,
 growth:([before,after])=>100*(after/before-1),
 exchange:([rate,foreign])=>rate*foreign,
 'current-account':([exports,income,transfers])=>exports+income+transfers
};
test('every current AP Macro numeric variant agrees with the values shown to students',()=>{
 assert.equal(items.length,432);
 for(const item of items){assert.ok(checks[item.family],`Missing independent check for ${item.family}`);const expected=checks[item.family](values(item));assert.ok(Number.isFinite(expected)&&Math.abs(expected-item.answer)<=.000501,`${item.id}: ${expected} vs ${item.answer}`);}
});
