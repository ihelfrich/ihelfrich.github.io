import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleVelocity,advance,EARTH_METRES_PER_DEGREE } from '../../src/scripts/hidden-rivers/field.mjs';
const layer=()=>({shape:[2,3,3],values:new Int16Array([...Array(9).fill(1000),...Array(9).fill(2000),...Array(18).fill(0)]),lat0:0,lon0:0,dlat:1,dlon:1});
test('interpolates in physical units between instantaneous daily fields',()=>{assert.deepEqual(sampleVelocity(layer(),.5,.5,43200),[1.5,0]);});
test('masked corners terminate rather than interpolate through land',()=>{const l=layer();l.values[0]=-32768;assert.equal(sampleVelocity(l,.5,.5,0),null);assert.equal(sampleVelocity(l,-1,.5,0),null);});
test('midpoint advection follows the integrated eastward velocity',()=>{const l=layer(),dt=900,p=advance(l,.5,.5,0,dt);const expected=.5+(1+dt/2/86400)*dt/(EARTH_METRES_PER_DEGREE*Math.cos(.5*Math.PI/180));assert.ok(Math.abs(p[0]-expected)<1e-10);assert.equal(p[1],.5);});
