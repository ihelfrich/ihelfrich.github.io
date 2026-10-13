import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/development-economics-variants.json',import.meta.url)));
const get=(p,r)=>{const m=p.match(r);assert(m,p);return m.slice(1).map(v=>parseFloat(v));};
test('256 development answers follow the saved prompts, including thresholds and population denominators',()=>{
 let count=0;
 for(const {baseId,variants} of rows)for(const {prompt:p,answer} of variants){let expected;
 switch(baseId.replace('development-economics-','')){
 case 'u1-01':{const values=p.match(/consumption of ([\d, ]+) currency/)[1].split(',').map(Number);const [n,z]=get(p,/for (\d+) people.*line is (\d+)/);assert.equal(values.length,n);assert(values.includes(z));expected=100*values.filter(x=>x<z).length/n;break;}
 case 'u1-02':{const values=p.match(/consumption is ([\d, ]+) currency/)[1].split(',').map(Number);expected=values.reduce((s,x)=>s+Math.max(100-x,0),0)/(100*values.length);break;}
 case 'u2-02':{const [a,t]=get(p,/has (\d+) units.*threshold of (\d+)/);expected=t-a;assert(expected>0);break;}
 case 'u2-03':{const [a,b]=get(p,/assets are (\d+) \+ ([\d.]+) times/);expected=a/(1-b);assert(b<1);break;}
 case 'u2-04':{const [l,prob]=get(p,/advances (\d+) currency.*probability ([\d.]+)/);expected=l/prob;break;}
 case 'u2-09':{const [lo,hi]=get(p,/consumption is (\d+) or (\d+)/);expected=((Math.sqrt(lo)+Math.sqrt(hi))/2)**2;assert(expected<(lo+hi)/2);break;}
 case 'u3-03':{const [c,q,p1]=get(p,/bag for (\d+) currency.*adds (\d+) kilograms.*at (\d+) currency/);expected=q*p1-c;break;}
 case 'u3-09':{const [old,next]=get(p,/fall from (\d+) to (\d+)/);expected=old-next;break;}
 case 'u4-02':{const [fee,wage,benefit]=get(p,/costs (\d+) currency.*and (\d+) in forgone.*by (\d+) units/);expected=benefit-fee-wage;break;}
 case 'u5-01':{const [r,w,prob,c]=get(p,/earns (\d+) currency.*paying (\d+) units with probability ([\d.]+).*costs (\d+) units/);expected=prob*w-c-r;break;}
 case 'u5-03':{const [s0,s1,n0,n1]=get(p,/from (\d+)% to (\d+)%.*from (\d+) to (\d+) workers/);expected=s1*n1/100-s0*n0/100;break;}
 case 'u5-04':{const [a,m,s0,s1]=get(p,/at (\d+) thousand.*and (\d+) thousand.*from (\d+)% to (\d+)%/);expected=(m-a)*(s1-s0)/100;break;}
 case 'u6-02':{const [t,c]=get(p,/earnings are (\d+) currency.*group and (\d+) in the control/);expected=t-c;break;}
 case 'u6-03':{const [t,c,itt]=get(p,/participation is (\d+)%.*and (\d+)% in controls.*by (\d+) currency/);expected=itt/((t-c)/100);break;}
 case 'u6-05':{const [t0,t1,c0,c1]=get(p,/from (\d+) to (\d+) currency.*from (\d+) to (\d+) in comparison/);expected=t1-t0-c1+c0;break;}
 case 'u6-08':{const [gain,payment]=get(p,/gains (\d+) currency.*payment of (\d+) units/);expected=gain/payment;assert(expected>=0&&expected<=1);break;}
 default:assert.fail(baseId);
 }
 assert(Math.abs(expected-answer)<1e-7,`${baseId}: ${expected} != ${answer}`);count++;
 }
 assert.equal(count,256);
});
