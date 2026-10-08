import test from 'node:test';
import assert from 'node:assert/strict';
import { relativeVorticity, sampleVorticity, vorticityColor, vorticityRaster, VORTICITY_MAX } from '../../src/scripts/hidden-rivers/ocean-vorticity.mjs';

const R = 6_371_000;
function field({nx=7,ny=7,lon0=-3,lat0=-3,dlon=1,dlat=1,u=()=>0,v=()=>0,missing=[]}={}) {
  const plane=nx*ny,values=new Float64Array(2*plane),holes=new Set(missing.map(([x,y])=>y*nx+x));
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const i=y*nx+x,lon=(lon0+x*dlon)*Math.PI/180,lat=(lat0+y*dlat)*Math.PI/180;
    values[i]=holes.has(i)?-32768:u(lon,lat)*1000;
    values[plane+i]=holes.has(i)?-32768:v(lon,lat)*1000;
  }
  return {shape:[1,ny,nx],lon0,lat0,dlon,dlat,values};
}

test('zero horizontal velocity has zero relative vorticity on valid interior nodes',()=>{
  const z=relativeVorticity(field());
  assert.equal(z.values.length,49);
  assert.equal(z.mask.reduce((sum,value)=>sum+value,0),25);
  for(let y=1;y<6;y++)for(let x=1;x<6;x++)assert.equal(z.values[y*7+x],0);
});

test('spherical solid-body rotation converges to 2 Omega sin(latitude)',()=>{
  const omega=2.5e-6,lat0=29.98,dlat=.01;
  const f=field({nx:5,ny:5,lon0:-2,lat0,dlon:.1,dlat,u:(_lambda,phi)=>omega*R*Math.cos(phi)});
  const z=relativeVorticity(f),at30=z.values[2*5+2],expected=2*omega*Math.sin(30*Math.PI/180);
  assert.ok(Math.abs(at30-expected)<1e-12,`expected ${expected}, got ${at30}`);
  const errors=[.5,.25,.125].map(step=>{
    const f=field({nx:5,ny:5,lat0:30-2*step,dlat:step,u:(_lambda,phi)=>omega*R*Math.cos(phi)});
    return Math.abs(relativeVorticity(f).values[12]-expected);
  });
  assert.ok(errors[1]<.26*errors[0]&&errors[2]<.26*errors[1],'spherical curl must converge at second order: '+JSON.stringify(errors));
});

test('eastward increase in northward velocity has positive sign and R cos(latitude) scaling',()=>{
  const slope=.25,lat=0;
  const f=field({nx:5,ny:5,lon0:-2,lat0:-2,dlon:1,dlat:1,v:lambda=>slope*lambda});
  const z=relativeVorticity(f),got=z.values[2*5+2];
  assert.ok(got>0);
  assert.ok(Math.abs(got-slope/R)<1e-16,`expected ${slope/R}, got ${got}`);
  assert.equal(sampleVorticity(z,0,lat),got);
  const high=relativeVorticity(field({nx:5,ny:5,lon0:-2,lat0:58,dlon:1,dlat:1,v:lambda=>slope*lambda}));
  assert.ok(Math.abs(high.values[12]-slope/(R*Math.cos(Math.PI/3)))<1e-16,'latitude metric must double this curl at 60 degrees');
});

test('derivative masks center and every cardinal neighbor without one-sided coastal fill',()=>{
  for(const missing of [[[3,3]],[[2,3]],[[4,3]],[[3,2]],[[3,4]]]){
    const z=relativeVorticity(field({missing}));
    assert.equal(z.mask[3*7+3],0,`invalid stencil ${JSON.stringify(missing)}`);
    assert.ok(Number.isNaN(z.values[3*7+3]));
  }
  const edge=relativeVorticity(field());
  assert.equal(edge.mask[3*7],0);
});

test('interpolated vorticity requires all four surrounding valid derivative nodes',()=>{
  const z=relativeVorticity(field());
  assert.equal(sampleVorticity(z,-.5,-.5),0);
  z.mask[2*7+2]=0;z.values[2*7+2]=NaN;
  assert.equal(sampleVorticity(z,-.5,-.5),null);
  assert.equal(sampleVorticity(z,-.1,2),null);
});

test('vorticity display has a symmetric cyan-neutral-coral fixed signed scale',()=>{
  assert.equal(VORTICITY_MAX,4e-5);
  assert.deepEqual(vorticityColor(-VORTICITY_MAX),[34,137,157]);
  assert.deepEqual(vorticityColor(0),[237,240,229]);
  assert.deepEqual(vorticityColor(VORTICITY_MAX),[198,65,71]);
  assert.deepEqual(vorticityColor(-8e-5),vorticityColor(-VORTICITY_MAX));
  assert.deepEqual(vorticityColor(8e-5),vorticityColor(VORTICITY_MAX));
});

test('vorticity raster leaves masked stencil cells transparent and uses geographic cell bounds',()=>{
  const z=relativeVorticity(field({missing:[[3,3]]})),r=vorticityRaster(z);
  assert.deepEqual(r.bounds,[-3.5,-3.5,3.5,3.5]);
  assert.equal(r.width,7);assert.equal(r.height,7);
  assert.equal(r.data[(3*7+3)*4+3],0,'missing derivative cells must stay transparent');
  assert.ok(r.data[((6-1)*7+1)*4+3]>0,'valid derivative cells should render');
});
