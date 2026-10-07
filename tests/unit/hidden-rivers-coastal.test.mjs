import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vectorNorms, cosineAt, similarityField, contrastField, fieldSummary, separatedMatches } from '../../src/scripts/hidden-rivers/coastal-math.mjs';

test('published positive per-pixel scales cancel in full-vector cosine',()=>{
  const vectors=Int8Array.of(3,4,0,0, 6,8,0,0, -3,-4,0,0, 0,0,3,4);
  const norms=vectorNorms(vectors,4,Uint8Array.of(1,1,1,1));
  assert.equal(cosineAt(vectors,norms,4,0,1),1);
  assert.equal(cosineAt(vectors,norms,4,0,2),-1);
  assert.equal(cosineAt(vectors,norms,4,0,3),0);
  const scales=[.001,4,.02,1.4];
  const expanded=Float64Array.from(vectors,(v,i)=>v*scales[Math.floor(i/4)]);
  const floatingNorms=vectorNorms(expanded,4,Uint8Array.of(1,1,1,1));
  assert.ok(Math.abs(cosineAt(expanded,floatingNorms,4,0,1)-cosineAt(vectors,norms,4,0,1))<1e-14);
});

test('missing data are excluded, and identical references have zero contrast',()=>{
  const vectors=Int8Array.of(1,0, 0,1, 0,0),norms=vectorNorms(vectors,2,Uint8Array.of(1,1,0));
  const a=similarityField(vectors,norms,2,0),contrast=contrastField(a,a);
  assert.deepEqual(Array.from(contrast.slice(0,2)),[0,0]);
  assert.ok(Number.isNaN(contrast[2]));
  const b=similarityField(vectors,norms,2,1),ab=contrastField(a,b),ba=contrastField(b,a);
  assert.equal(ab[0],-ba[0]);assert.equal(ab[1],-ba[1]);
  assert.throws(()=>similarityField(vectors,norms,2,2),/No valid/);
  assert.equal(fieldSummary(a,.5).fraction,.5);
});

test('match candidates obey projected-distance exclusions',()=>{
  const scores=new Float32Array(25).fill(.5);scores[0]=1;scores[1]=.99;scores[24]=.9;scores[23]=.8;scores[4]=.7;
  const matches=separatedMatches(scores,5,100,0,{count:3,separation:200,excludeRadius:200});
  assert.ok(!matches.includes(0)&&!matches.includes(1));assert.equal(matches[0],24);
  for(const i of matches)for(const j of matches)if(i!==j)assert.ok(Math.hypot(i%5-j%5,Math.floor(i/5)-Math.floor(j/5))*100>=200);
});

test('released Cape Peninsula data contain full vectors and coordinates in the recorded window',()=>{
  const prefix=new URL('../../public/hidden-rivers/coastal/',import.meta.url);
  const meta=JSON.parse(fs.readFileSync(new URL('manifest.json',prefix)));
  const values=fs.readFileSync(new URL('vectors.i8',prefix));
  const vectors=new Int8Array(values.buffer,values.byteOffset,values.byteLength);
  const valid=Uint8Array.from(fs.readFileSync(new URL('valid.u8',prefix)));
  const coordBytes=fs.readFileSync(new URL('coordinates.f32',prefix));
  const coordinates=new Float32Array(coordBytes.buffer,coordBytes.byteOffset,coordBytes.byteLength/4);
  assert.equal(vectors.length,meta.width*meta.height*128);assert.equal(valid.reduce((s,v)=>s+v,0),meta.validCount);
  const i=meta.initialPixel[1]*meta.width+meta.initialPixel[0];assert.equal(valid[i],1);
  const norms=vectorNorms(vectors,meta.dimensions,valid);assert.ok(Math.abs(cosineAt(vectors,norms,meta.dimensions,i,i)-1)<1e-12);
  const a=similarityField(vectors,norms,meta.dimensions,i),summary=fieldSummary(a,.92);assert.equal(summary.count,meta.validCount);
  for(let k=0;k<coordinates.length;k+=2){assert.ok(coordinates[k]>=meta.bounds[0]&&coordinates[k]<=meta.bounds[2]);assert.ok(coordinates[k+1]>=meta.bounds[1]&&coordinates[k+1]<=meta.bounds[3]);}
});
