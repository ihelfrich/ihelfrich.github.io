import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from 'cesium';
import { createRasterProvider } from '../../src/scripts/hidden-rivers/raster-provider.mjs';
import { spectralSample } from '../../src/scripts/hidden-rivers/spectral.mjs';
import { unpackField, snapshotField, sampleAt, streamline, indexPixel, seeded } from '../../src/scripts/hidden-rivers/atlas-math.mjs';
import { EARTH_METRES_PER_DEGREE } from '../../src/scripts/hidden-rivers/field.mjs';
const fixture = () => ({shape:[3,4,4],lon0:0,lat0:0,dlon:1,dlat:1,values:new Int16Array([...Array(16).fill(1000),...Array(16).fill(2000),...Array(16).fill(3000),...Array(48).fill(0)])});
test('regional globe rasters retain their projection and include their exact corners',()=>{
  for(const bounds of [[-87.65,17.25,-87.42,17.42],[-60.12,-3.33,-59.78,-2.98],[145.82,-16.91,146.16,-16.53]]){
    const provider=createRasterProvider(C,{width:3840,height:3840},bounds),scheme=provider.tilingScheme;
    assert.equal(provider.rectangle,scheme.rectangle);
    for(const corner of [C.Rectangle.northwest(provider.rectangle),C.Rectangle.southeast(provider.rectangle)])assert.deepEqual(scheme.positionToTileXY(corner,0),new C.Cartesian2(0,0));
    const mid=C.Rectangle.center(provider.rectangle),native=scheme.projection.project(mid),nativeRect=scheme.tileXYToNativeRectangle(0,0,0);
    assert.ok(native.x>=nativeRect.west&&native.x<=nativeRect.east&&native.y>=nativeRect.south&&native.y<=nativeRect.north);
  }
});
test('spectral inspection centers reflectance and uses the fitted component columns',()=>{
  const p={mean:[.1,.2,.3,.4],eigenvectors:[[0,1,0,0],[1,0,0,0],[0,0,1,0],[0,0,0,1]],stretchLow:[0,0,0,0],stretchHigh:[.4,.2,.6,.8]};
  const s=spectralSample([.2,.4,.6,.8],p);assert.deepEqual(s.normalized,[.5,.5,.5,.5]);assert.ok(Math.abs(s.meanVisible-.4)<1e-12);assert.ok(Math.abs(s.ndwi+1/3)<1e-12);assert.equal(spectralSample([NaN,.4,.6,.8],p),null);
});
test('current snapshots retain selected units and component layout',()=>{
  const f=snapshotField(fixture(),1);assert.deepEqual(sampleAt(f,.5,.5),[2,0]);assert.throws(()=>snapshotField(fixture(),3));
  const a=fixture(),b=unpackField(a,a.values.buffer);assert.deepEqual(b.values,a.values);assert.throws(()=>unpackField(a,new ArrayBuffer(4)),/Incomplete/);
});
test('steady streamline agrees with analytic geographic eastward displacement',()=>{
  const f=snapshotField(fixture(),0),p=streamline(f,.5,.5,3,900);
  assert.equal(p.length,3);assert.ok(Math.abs(p[2][0]-(.5+1800/(EARTH_METRES_PER_DEGREE*Math.cos(.5*Math.PI/180))))<1e-10);assert.equal(p[2][1],.5);
});
test('missing corners stop streamlines instead of manufacturing coastal flow',()=>{
  const f=snapshotField(fixture(),0);f.values[0]=-32768;assert.equal(sampleAt(f,.5,.5),null);assert.deepEqual(streamline(f,.5,.5),[]);assert.equal(sampleAt(f,4,0),null);
});
test('index inspection uses Mercator rows and preserves out-of-bounds missing data',()=>{
  assert.deepEqual(indexPixel([0,0,10,60],[100,100],5,0),[50,99]);assert.deepEqual(indexPixel([0,0,10,60],[100,100],5,60),[50,0]);
  assert.equal(indexPixel([0,0,10,60],[100,100],-1,30),null);assert.ok(indexPixel([0,0,10,60],[100,100],5,30)[1]>50);
});
test('presentation releases reproduce exactly without changing with frame rate',()=>{
  const a=seeded(11),b=seeded(11);assert.deepEqual(Array.from({length:20},a),Array.from({length:20},b));
});
