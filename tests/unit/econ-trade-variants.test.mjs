import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/international-trade-variants.json',import.meta.url)));
const get=(p,r)=>{const m=p.match(r);assert(m,p);return m.slice(1).map(v=>parseFloat(v));};
test('all saved trade variants agree with independently parsed prompt calculations',()=>{
 let count=0;
 for(const {baseId,variants} of rows)for(const {prompt:p,answer} of variants){let expected;
 switch(baseId.replace('international-trade-','')){
 case 'u1-03':{const [a,b,x,y]=get(p,/requires (\d+) labor.*basket (\d+) hours.*\$(\d+) per bicycle and \$(\d+)/);expected=Math.max(x/a,y/b);break;}
 case 'u1-04':{const [price,exports]=get(p,/price of (\d+) fish.*exports (\d+) fish/);expected=exports/price;break;}
 case 'u1-06':{const [prod,w,s]=get(p,/produces (\d+) crates.*earns \$([\d.]+).*Only ([\d.]+)%/);expected=w/prod/(s/100);break;}
 case 'u2-05':{const [L,a,k,b,m]=get(p,/share (\d+) workers.*are (\d+) − (\d+)L_A and (\d+) − (\d+)L_B/);expected=(a-b+m*L)/(k+m);break;}
 case 'u2-09':{const [price,w]=get(p,/price becomes ([\d.]+) times.*wage becomes ([\d.]+) times/);expected=100*(w/Math.sqrt(price)-1);break;}
 case 'u3-05':{const [a,b,c,d,p1,p2]=get(p,/costs (\d+)w \+ (\d+)r.*costs (\d+)w \+ (\d+)r.*prices are \$(\d+) and \$(\d+)/);expected=(d*p1-b*p2)/(a*d-b*c);break;}
 case 'u3-08':{const [x,k,m,ki]=get(p,/exports (\d+) machines, each embodying (\d+) capital.*imports (\d+) garments, each embodying (\d+) capital/);expected=x*k-m*ki;break;}
 case 'u4-03':{const [r,v,f]=get(p,/earn \$(\d+).*incur \$(\d+).*requires a \$(\d+)/);expected=r-v-f;break;}
 case 'u4-07':{const [e,c]=get(p,/elasticity (\d+).*cost \$([\d.]+)/);expected=c/(1-1/e);break;}
 case 'u5-02':{const [a,d,b,s,w,t]=get(p,/Q_D=(\d+)−(\d+)P.*Q_S=(\d+)\+(\d+)P.*price of \$(\d+).*tariff of \$(\d+)/);expected=a-b-(d+s)*(w+t);assert(expected>0);break;}
 case 'u5-03':{const [t,s,d]=get(p,/tariff of \$(\d+).*production by (\d+).*consumption by (\d+)/);expected=t*(s+d)/2;break;}
 case 'u5-08':{const [p0,c0,p1,c1]=get(p,/sells for \$([\d.]+).*costing \$([\d.]+).*price to \$([\d.]+).*price to \$([\d.]+)/);expected=100*((p1-c1)/(p0-c0)-1);break;}
 case 'u6-01':{const [x,y]=get(p,/Exporter GDP rises (\d+)%, importer GDP rises (\d+)%/);expected=((1+x/100)*(1+y/100)-1)*100;break;}
 case 'u6-02':{const [b,d]=get(p,/slope (-?[\d.]+).*Distance rises (\d+)%/);expected=Math.exp(b*Math.log(1+d/100));break;}
 case 'u6-05':{const [gross,foreign]=get(p,/for \$(\d+), using \$(\d+)/);expected=gross-foreign;break;}
 case 'u6-06':{const [d,f,k]=get(p,/costs \$(\d+).*Offshoring costs \$(\d+).*cost of \$(\d+)/);expected=k/(d-f);break;}
 default:assert.fail(baseId);
 }
 assert(Math.abs(expected-answer)<.00000051,`${baseId}: ${expected} vs ${answer}`);count++;
 }
 assert.equal(count,256);
});
