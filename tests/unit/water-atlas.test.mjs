import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from 'cesium';
import { createRasterProvider, createTiledRasterProvider } from '../../src/scripts/hidden-rivers/raster-provider.mjs';
import { velocityRaster } from '../../src/scripts/hidden-rivers/velocity-raster.mjs';
import { decodeVelocityBytes } from '../../src/scripts/hidden-rivers/velocity-decode.mjs';
import { atlasQuery, collectionFor } from '../../src/scripts/hidden-rivers/atlas-navigation.mjs';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { spectralSample } from '../../src/scripts/hidden-rivers/spectral.mjs';
import { maskedRiverRuns, flowTiming, trailIntervals, CURRENT_TIME_SCALE, CURRENT_SAMPLES_PER_SECOND, PULSE_SAMPLES } from '../../src/scripts/hidden-rivers/flow-motion.mjs';
import { unpackField, snapshotField, sampleAt, streamline, indexPixel, seeded } from '../../src/scripts/hidden-rivers/atlas-math.mjs';
import { EARTH_METRES_PER_DEGREE } from '../../src/scripts/hidden-rivers/field.mjs';
import { speedColor } from '../../src/scripts/hidden-rivers/speed-colors.mjs';
import { velocityDepthProfile } from '../../src/scripts/hidden-rivers/velocity-profile.mjs';
const fixture = () => ({shape:[3,4,4],lon0:0,lat0:0,dlon:1,dlat:1,values:new Int16Array([...Array(16).fill(1000),...Array(16).fill(2000),...Array(16).fill(3000),...Array(48).fill(0)])});
test('old depth-print links open the live field while PCA and other prints remain reachable',()=>{
  const q=atlasQuery('?study=depth&image=agulhas-1000');assert.equal(q.get('place'),'agulhas');assert.equal(q.get('depth'),'1000');assert.equal(q.get('layer'),'currents');
  assert.equal(atlasQuery('?study=density&image=salinity').get('tab'),'prints');
  assert.equal(atlasQuery('?tab=satellite').get('layer'),'pca');
  assert.equal(atlasQuery('?place=reef&layer=pca').get('place'),'reef');
  assert.equal(collectionFor({frames:[]}), 'satellite');assert.equal(collectionFor({source:'hycom'}),'ocean');
});
test('regional tile pyramids retain exact raster corners and native pixel dimensions',async()=>{
  const root='public/hidden-rivers/water-atlas',m=JSON.parse(await fs.readFile(root+'/manifest.json','utf8'));
  for(const p of m.places){const h=p.frames[0].highResolution;if(!h?.tiles)continue;
    const tile=h.tiles[h.rgb],count=2**tile.maximumLevel;
    assert.equal(tile.tileWidth*count,h.width);assert.equal(tile.tileHeight*count,h.height);
    const provider=createTiledRasterProvider(C,tile,'https://example.test/'),scheme=provider.tilingScheme;
    for(const [corner,xy] of [[C.Rectangle.northwest(scheme.rectangle),[0,0]],[C.Rectangle.southeast(scheme.rectangle),[count-1,count-1]]])assert.deepEqual(scheme.positionToTileXY(corner,tile.maximumLevel),new C.Cartesian2(...xy));
    const source=await sharp(root+'/'+h.rgb).ensureAlpha().extract({left:h.width-tile.tileWidth,top:h.height-tile.tileHeight,width:tile.tileWidth,height:tile.tileHeight}).raw().toBuffer();
    const file=tile.url.replace('{z}',String(tile.maximumLevel)).replace('{x}',String(count-1)).replace('{y}',String(count-1));
    const finest=await sharp(root+'/'+file).ensureAlpha().raw().toBuffer();assert.equal(finest.length,source.length);
    let squaredError=0,samples=0;for(let i=0;i<source.length;i+=4){assert.equal(finest[i+3],source[i+3],'tile changed the missing-data mask');if(source[i+3])for(let c=0;c<3;c++){squaredError+=(finest[i+c]-source[i+c])**2;samples++;}}
    const psnr=10*Math.log10(255**2/(squaredError/Math.max(1,samples)));assert.ok(psnr>32,`Display compression PSNR fell to ${psnr} dB`);
  }
});
test('regional globe rasters retain their projection and include their exact corners',()=>{
  for(const bounds of [[-87.65,17.25,-87.42,17.42],[-60.12,-3.33,-59.78,-2.98],[145.82,-16.91,146.16,-16.53]]){
    const provider=createRasterProvider(C,{width:3840,height:3840},bounds),scheme=provider.tilingScheme;
    assert.equal(provider.rectangle,scheme.rectangle);
    for(const corner of [C.Rectangle.northwest(provider.rectangle),C.Rectangle.southeast(provider.rectangle)])assert.deepEqual(scheme.positionToTileXY(corner,0),new C.Cartesian2(0,0));
    const mid=C.Rectangle.center(provider.rectangle),native=scheme.projection.project(mid),nativeRect=scheme.tileXYToNativeRectangle(0,0,0);
    assert.ok(native.x>=nativeRect.west&&native.x<=nativeRect.east&&native.y>=nativeRect.south&&native.y<=nativeRect.north);
  }
});
test('speed shading keeps valid coastal cells beside gaps without filling the gaps',()=>{
  const f=snapshotField(fixture(),0);f.values[1]=-32768;const r=velocityRaster(f,()=>[20,40,60]);assert.ok(r.data[4*(3*4)+3]>0);assert.equal(r.data[4*(3*4+1)+3],0);assert.equal(sampleAt(f,.5,.5),null);assert.deepEqual(r.bounds,[-.5,-.5,3.5,3.5]);
});
test('speed uses one fixed violet-to-rose scale at every location and depth',()=>{
  assert.deepEqual([0,.2,.4,.6,.8].map(speedColor),[[76,29,149],[139,29,224],[213,28,144],[243,80,131],[255,209,226]]);
  assert.deepEqual(speedColor(-2),speedColor(0));assert.deepEqual(speedColor(5),speedColor(.8));
});
test('HYCOM depth profile uses the nearest shared timestamp and strict wet-cell samples',()=>{
  const field=(depth,u,v,missing=false)=>{const f={depth,shape:[2,2,2],lon0:0,lat0:0,dlon:1,dlat:1,dates:['2026-09-29T00:00:00Z','2026-09-30T00:00:00Z'],values:new Int16Array([u,u,u,u,u,u,u,u,v,v,v,v,v,v,v,v])};if(missing)f.values[0]=-32768;return f;};
  const rows=velocityDepthProfile([field(0,100,0),field(200,0,200),field(500,100,100,true)],{date:'2026-09-29T12:00:00Z',lon:.5,lat:.5});
  assert.deepEqual(rows.map(r=>r.depth),[0,200,500]);assert.deepEqual(rows.map(r=>r.date),['2026-09-29T00:00:00Z','2026-09-29T00:00:00Z','2026-09-29T00:00:00Z']);
  assert.equal(rows[0].speed,.1);assert.equal(rows[0].direction,90);assert.equal(rows[1].speed,.2);assert.equal(rows[1].direction,0);assert.equal(rows[2].speed,null);assert.equal(rows[2].direction,null);
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
test('a masked gap splits a river instead of joining two separated wet reaches',()=>{
  const runs=maskedRiverRuns([[0,0],[.03,0]],p=>p[0]<.01||p[0]>.02,100,2);
  assert.equal(runs.length,2);assert.ok(runs[0].every(p=>p[0]<.01));assert.ok(runs[1].every(p=>p[0]>.02));
  assert.deepEqual(maskedRiverRuns([[0,0],[.03,0]],()=>false),[]);
});
test('trail time matches geographic displacement without changing velocity scale',()=>{
  const points=streamline(snapshotField(fixture(),0),.5,.5,110,1800),timing=flowTiming(points.length,1);
  const sample=timing.clock/timing.repeats*(points.length-1);
  assert.ok(Math.abs(sample-2)<1e-12);assert.equal(CURRENT_TIME_SCALE,3600);assert.equal(CURRENT_SAMPLES_PER_SECOND,2);assert.equal(PULSE_SAMPLES,18);
  assert.ok(Math.abs((points[Math.round(sample)][0]-.5)*EARTH_METRES_PER_DEGREE*Math.cos(.5*Math.PI/180)-3600)<1e-8);
});
test('animated tails enter and exit open paths without an end-to-start bridge',()=>{
  for(const phase of [0,2.5,23.9,24,47.9])for(const trail of trailIntervals(10,phase)){
    assert.ok(trail.start>=0&&trail.end<=10&&trail.end>trail.start);
    assert.ok(trail.head>=trail.end&&trail.head-trail.start<=trail.tail);
  }
});

test('native ocean releases retain paired masks, exact cell counts and checked source grids',async()=>{
  const root='public/hidden-rivers/water-atlas/native-hycom',m=JSON.parse(await fs.readFile(root+'/manifest.json','utf8'));
  for(const r of m.regions)for(const l of r.layers){const packed=await fs.readFile(root+'/'+l.file),raw=gunzipSync(packed);assert.equal(createHash('sha256').update(raw).digest('hex'),l.sha256);assert.equal(l.spatialStride,1);assert.ok(l.dlon<.09&&l.dlat<.05);const v=unpackField(l,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)).values,[nt,ny,nx]=l.shape,plane=ny*nx;for(let t=0;t<nt;t++){let n=0;for(let i=0;i<plane;i++){const u=v[t*plane+i],w=v[nt*plane+t*plane+i];assert.equal(u===-32768,w===-32768);if(u!==-32768)n++;}assert.equal(n,l.validSourceCellsPerFrame[t]);}}
  const radar=JSON.parse(await fs.readFile('public/hidden-rivers/water-atlas/nc-radar.json','utf8'));assert.ok(radar.ncValidCells>0);assert.equal(radar.nominalResolutionKm,6);
});

test('compressed velocities work with both static-host content-encoding behaviors',async()=>{
  const m=JSON.parse(await fs.readFile('public/hidden-rivers/water-atlas/native-hycom/manifest.json','utf8')),l=m.regions[0].layers[0],packed=await fs.readFile('public/hidden-rivers/water-atlas/native-hycom/'+l.file),raw=gunzipSync(packed);
  const arrayBuffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  for(const body of [packed,raw]){const decoded=await decodeVelocityBytes(arrayBuffer(body),'gzip');assert.equal(createHash('sha256').update(new Uint8Array(decoded)).digest('hex'),l.sha256);}
});
