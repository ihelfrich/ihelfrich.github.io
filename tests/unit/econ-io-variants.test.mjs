import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const expansions=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/industrial-organization-variants.json',import.meta.url)));
const capture=(p,re)=>{const m=p.match(re);assert(m,`Unrecognized prompt: ${p}`);return m.slice(1).map(Number);};
test('all 256 serialized IO prompts independently imply their saved numeric answers',()=>{
 let count=0;
 for(const {baseId,variants} of expansions)for(const v of variants){
  const p=v.prompt;let expected;
  switch(baseId.replace('industrial-organization-','')){
   case 'u1-01': {const [a,b,c]=capture(p,/P = ([\d.]+) - ([\d.]+)Q.*cost is \$([\d.]+)/);expected=(a-c)/(2*b);break;}
   case 'u1-02': {const [den]=capture(p,/-100\/([\d.]+)/);expected=den;break;}
   case 'u1-04': {const [a,c,q,price]=capture(p,/P = ([\d.]+) - Q.*cost is \$([\d.]+).*sells ([\d.]+) units at \$([\d.]+)/);expected=(a-c-q)*(price-c)/2;break;}
   case 'u1-10': {const [tax]=capture(p,/A \$([\d.]+) tax/);expected=tax/2;break;}
   case 'u2-01': {const [a,b,c]=capture(p,/P = ([\d.]+) - ([\d.]+)\(q1 \+ q2\).*cost \$([\d.]+)/);expected=(a-c)/(3*b);break;}
   case 'u3-01': {const [a,b,t]=capture(p,/charges \$([\d.]+); B charges \$([\d.]+).*costs \$([\d.]+)/);expected=(b+t-a)/(2*t);assert(expected>0&&expected<1);break;}
   case 'u3-07': {const [cost,q,p,c]=capture(v.prompt,/costs \$([\d.]+) and adds ([\d.]+).*price of \$([\d.]+) and marginal cost \$([\d.]+)/);expected=q*(p-c)-cost;break;}
   case 'u4-01': {const [cost,profit,years]=capture(p,/costs \$([\d.]+).*profit of \$([\d.]+).*for ([\d.]+) years/);expected=years*profit-cost;break;}
   case 'u4-02': {const [a,f]=capture(p,/profit \$([\d.]+)\/n².*cost of \$([\d.]+)/);const admissible=Array.from({length:100},(_,i)=>i+1).filter(n=>a/n**2>=f&&a/(n+1)**2<=f);assert.equal(admissible.length,1);expected=admissible[0];break;}
   case 'u4-04': {const [c,d,n]=capture(p,/profit is \$([\d.]+).*collusion, \$([\d.]+).*and \$([\d.]+) forever/);expected=(d-c)/(d-n);break;}
   case 'u5-05': {const [l,h,price]=capture(p,/worth \$([\d.]+).*worth \$([\d.]+).*price is \$([\d.]+)/);expected=h-(l-price);break;}
   case 'u5-06': {const [a]=capture(p,/P = ([\d.]+) -/);expected=.75*a;break;}
   case 'u5-07': {const [a]=capture(p,/P = ([\d.]+) -/);expected=.5*a;break;}
   case 'u6-01': {const [f,c,a,price]=capture(p,/C = ([\d.]+) \+ ([\d.]+)Q.*Q = ([\d.]+) - P.*P = \$([\d.]+)/);expected=f+(c-price)*(a-price);break;}
   case 'u6-04': {const [a,b,c]=capture(p,/shares ([\d.]+)%, ([\d.]+)%, and ([\d.]+)%/);assert.equal(a+b+c,100);expected=(a+b)**2+c**2-(a*a+b*b+c*c);break;}
   case 'u6-06': {const [d,m,c]=capture(p,/Diversion is ([\d.]+), B's margin is \$([\d.]+), and A's cost reduction is \$([\d.]+)/);expected=d*m-c;break;}
   default:assert.fail(`Missing independent formula: ${baseId}`);
  }
  assert(Math.abs(expected-v.answer)<1e-7,`${baseId}: ${expected} != ${v.answer}`);count++;
 }
 assert.equal(count,256);
});
