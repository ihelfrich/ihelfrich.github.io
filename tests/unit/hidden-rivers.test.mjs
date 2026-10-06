import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleVelocity,advance,EARTH_METRES_PER_DEGREE } from '../../src/scripts/hidden-rivers/field.mjs';
const layer=()=>({shape:[2,3,3],values:new Int16Array([...Array(9).fill(1000),...Array(9).fill(2000),...Array(18).fill(0)]),lat0:0,lon0:0,dlat:1,dlon:1});
test('interpolates in physical units between instantaneous daily fields',()=>{assert.deepEqual(sampleVelocity(layer(),.5,.5,43200),[1.5,0]);});
test('masked corners terminate rather than interpolate through land',()=>{const l=layer();l.values[0]=-32768;assert.equal(sampleVelocity(l,.5,.5,0),null);assert.equal(sampleVelocity(l,-1,.5,0),null);});
test('midpoint advection follows the integrated eastward velocity',()=>{const l=layer(),dt=900,p=advance(l,.5,.5,0,dt);const expected=.5+(1+dt/2/86400)*dt/(EARTH_METRES_PER_DEGREE*Math.cos(.5*Math.PI/180));assert.ok(Math.abs(p[0]-expected)<1e-10);assert.equal(p[1],.5);});

import {velocityAt,pointSeries,seriesCSV,readView} from '../../src/scripts/hidden-rivers/inspection.mjs';
test('location inspection returns direction toward true north, with no direction for calm water',()=>{
 const l=layer();assert.equal(velocityAt(l,.5,.5,0).bearing,90);
 l.values.fill(0);assert.equal(velocityAt(l,.5,.5,0).bearing,null);
 l.values.fill(1000,18);assert.equal(velocityAt(l,.5,.5,0).bearing,0);
});
test('export retains signed components and leaves unavailable samples empty',()=>{
 const l={...layer(),depth:200,dates:['2026-09-29T00:00:00Z','2026-09-30T00:00:00Z']};
 const rows=pointSeries([l],.5,.5);assert.equal(rows.length,2);assert.equal(rows[1].speed,2);
 assert.match(seriesCSV(rows),/200,2.00000,0.00000,2.00000,90.00000/);
 const missing=seriesCSV(pointSeries([l],-1,.5));assert.match(missing,/200,,,,\n/);
});
test('shared views reject unsupported options and clamp dates and vertical exaggeration',()=>{
 assert.deepEqual(readView('?region=invalid&time=999999&vertical=-5&view=map').region,'agulhas');
 assert.equal(readView('?time=999999').time,432000);assert.equal(readView('?vertical=-5').vertical,1);
 assert.equal(readView('?time=NaN').time,0);assert.equal(readView('?lat=bad').latitude,null);
});
