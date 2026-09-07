import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inquiryHref,coefficientX,nmtc,portrait,fieldPoint} from '../../src/data/homepage-studio.mjs';
test('inquiry preserves Unicode and cannot create extra mail headers',()=>{
 const u=new URL(inquiryHref('collaborate','Dr. A & B','Question?\n&bcc=unwanted@example.org\nλ + β'));
 assert.equal(u.protocol,'mailto:');assert.equal(u.pathname,'ianthelfrich@gmail.com');
 assert.deepEqual([...u.searchParams.keys()],['subject','body']);
 assert.equal(u.searchParams.get('subject'),'Research collaboration or advisory work');
 assert.equal(u.searchParams.get('body'),'Hi Ian,\n\nQuestion?\n&bcc=unwanted@example.org\nλ + β\n\nDr. A & B');
});
test('coefficient figure shares one affine scale and interval contains zero',()=>{
 assert.equal(coefficientX(nmtc.min),55);assert.equal(coefficientX(nmtc.max),485);
 assert.ok(coefficientX(nmtc.pooled)<coefficientX(nmtc.lower));
 assert.ok(coefficientX(nmtc.lower)<coefficientX(nmtc.within));
 assert.ok(coefficientX(nmtc.within)<coefficientX(0));
 assert.ok(coefficientX(0)<coefficientX(nmtc.upper));
 assert.ok(Math.abs((coefficientX(.1)-coefficientX(0))-(coefficientX(0)-coefficientX(-.1)))<1e-10);
});
test('approved Zoom portrait remains byte-exact',async()=>{
 assert.equal(portrait.src,'/people/ian-zoom-portrait.png');
 const bytes=await readFile(new URL('../../public'+portrait.src,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'dffeed2c90ebb7e4684c42c9e4395b7c1627af0d8aa5d1e0ccc7436a0740fe4e');
});
test('line field stays finite and within its declared vertical bounds over time',()=>{
 for(const t of [0,1,10,1000,1e6])for(let i=0;i<=100;i++)for(let j=0;j<=41;j++){
 const [x,y]=fieldPoint(i/100,j/41,t);assert.equal(x,i/100);assert.ok(Number.isFinite(y));assert.ok(y>=-.245&&y<=1.245);
 }
});
