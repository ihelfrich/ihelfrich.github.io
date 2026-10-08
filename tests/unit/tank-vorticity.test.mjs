import test from 'node:test';
import assert from 'node:assert/strict';
import {createDyeTank3D} from '../../src/scripts/hidden-rivers/dye-tank-3d.mjs';
const module=await import('../../src/scripts/hidden-rivers/tank-vorticity.mjs').catch(()=>({}));
function fixture(n=16,field=()=>[0,0,0]){const t=createDyeTank3D({nx:n,ny:n,nz:n,width:.24,height:.24,depth:.24});for(const c of t.velocity){const [nx,ny,nz]=c.shape;for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)c.data[(k*ny+j)*nx+i]=field((i+c.offset[0])*t.dx,(j+c.offset[1])*t.dy,(k+c.offset[2])*t.dz)[c.axis];}return t;}
function diagnostic(t){assert.equal(typeof module.tankVorticity,'function');return module.tankVorticity(t);}
test('translation and pure strain have no vorticity',()=>{for(const f of [()=>[.02,-.01,.03],(x,y,z)=>[x,-y,0]])for(const value of diagnostic(fixture(16,f)).values)assert.ok(Math.abs(value)<1e-12);});
test('rigid rotation has twice angular speed along each signed axis, including boundary cells',()=>{
 const omega=.7,fields=[(x,y,z)=>[0,-omega*z,omega*y],(x,y,z)=>[omega*z,0,-omega*x],(x,y,z)=>[-omega*y,omega*x,0]];
 fields.forEach((f,axis)=>{const r=diagnostic(fixture(16,f));for(let d=0;d<r.values.length;d+=4){for(let a=0;a<3;a++)assert.ok(Math.abs(r.values[d+a]-(axis===a?2*omega:0))<1e-12);assert.ok(Math.abs(r.values[d+3]-2*omega)<1e-12);}});
});
test('velocity scaling preserves curl sign and scales magnitude',()=>{const a=diagnostic(fixture(16,(x,y)=>[-y,x,0])),b=diagnostic(fixture(16,(x,y)=>[2*y,-2*x,0]));for(let d=0;d<a.values.length;d+=4){assert.ok(Math.abs(b.values[d+2]+2*a.values[d+2])<1e-12);assert.ok(Math.abs(b.values[d+3]-2*a.values[d+3])<1e-12);}});
test('smooth shear derivative converges at second order with grid refinement',()=>{const errors=[16,32].map(n=>{const t=fixture(n,(x,y)=>[.01*Math.sin(Math.PI*y/.24),0,0]),r=diagnostic(t);let sum=0,count=0;for(let k=0;k<n;k++)for(let j=1;j<n-1;j++)for(let i=0;i<n;i++){const exact=-.01*Math.PI/.24*Math.cos(Math.PI*(j+.5)/n),actual=r.values[4*((k*n+j)*n+i)+2];sum+=(actual-exact)**2;count++;}return Math.sqrt(sum/count);});assert.ok(errors[1]<.3*errors[0],JSON.stringify(errors));});
test('snapshots expose requested vorticity without changing canonical flow or time',()=>{const t=fixture(),before=t.u.slice();const a=t.snapshot();assert.equal(a.vorticity,undefined);const b=t.snapshot({includeVorticity:true});assert.ok(b.vorticity instanceof Float32Array);assert.equal(b.vorticity.length,t.nx*t.ny*t.nz*4);assert.equal(b.diagnostics.vorticityMax,0);assert.deepEqual(t.u,before);assert.equal(t.time,0);});
test('invalid input is rejected before changing a supplied output',()=>{assert.equal(typeof module.tankVorticity,'function');const t=fixture(),out=new Float64Array(t.nx*t.ny*t.nz*4).fill(7);t.u[3]=NaN;assert.throws(()=>module.tankVorticity(t,out));assert.ok(out.every(v=>v===7));assert.throws(()=>module.tankVorticity({...t,dx:0}));});
