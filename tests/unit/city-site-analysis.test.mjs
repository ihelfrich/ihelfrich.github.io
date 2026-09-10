import test from 'node:test';
import assert from 'node:assert/strict';
import {measureSite,prepareTerrainPoints,fitTerrainPlane,SITE_ANALYSIS_MODEL_VERSION} from '../../src/lib/city-site-analysis.mjs';

const R=6371008.8, M=R*Math.PI/180, lon=-90.2, lat=38.625, MX=M*Math.cos(lat*Math.PI/180), FT=1/0.3048;
const ll=([x,y])=>[lon+x/MX,lat+y/M];
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]].map(ll);
const feature=(coordinates,extra={},type='Polygon')=>({type:'Feature',properties:{recordKey:'city:handle:account:1',parcelKey:'city:handle',handle:'handle',parcelId:'account',sourceObjectId:1,...extra},geometry:{type,coordinates}});
const square=()=>feature([rect(-50,-50,50,50)]);
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);
const samples=(fn=()=>-12)=>Array.from({length:25},(_,i)=>{const x=(i%5-2)*20,y=(Math.floor(i/5)-2)*20,[longitude,latitude]=ll([x,y]);return{longitude,latitude,elevationMetres:fn(x,y)};});

test('square measurement has explicit metric/imperial units, extents and original account identity',()=>{
 const result=measureSite(feature([rect(-50,-50,50,50)],{areaSqFt:100000}));
 assert.equal(result.status,'measured');assert.equal(result.modelVersion,SITE_ANALYSIS_MODEL_VERSION);
 near(result.areaSqMetres,10000);near(result.areaSqFt,10000*FT**2);near(result.outerPerimeterMetres,400);near(result.allRingPerimeterFeet,400*FT);
 near(result.eastWestExtentMetres,100);near(result.northSouthExtentMetres,100);assert.equal(result.partCount,1);assert.equal(result.holeCount,0);
 assert.equal(result.sourceRecord.recordKey,'city:handle:account:1');assert.equal(result.sourceAreaSqFt,100000);
 near(result.areaDifferenceSqFt,10000*FT**2-100000);near(result.areaDifferencePct,(10000*FT**2/100000-1)*100);
 assert.equal(measureSite(square()).sourceAreaSqFt,null);assert.equal(measureSite(feature([rect(-50,-50,50,50)],{areaSqFt:0})).areaDifferencePct,null);
});

test('holes subtract area, add only all-ring perimeter, and multipart fills add without account aggregation',()=>{
 const result=measureSite(feature([rect(-50,-50,50,50),rect(-10,-10,10,10)]));
 near(result.areaSqMetres,9600);near(result.outerPerimeterMetres,400);near(result.allRingPerimeterMetres,480);assert.equal(result.holeCount,1);
 const parts=measureSite(feature([[rect(-50,-10,-30,10)],[rect(30,-10,50,10)]],{},'MultiPolygon'));
 near(parts.areaSqMetres,800);near(parts.allRingPerimeterMetres,160);assert.equal(parts.partCount,2);
});

test('ring winding/rotation is invariant and metric dimensions scale correctly',()=>{
 const ring=rect(-50,-50,50,50),open=ring.slice(0,-1),rotated=[...open.slice(2),...open.slice(0,2)];rotated.push(rotated[0]);
 const base=measureSite(square()),reverse=measureSite(feature([[...ring].reverse()])),rotation=measureSite(feature([rotated])),scaled=measureSite(feature([rect(-100,-100,100,100)]));
 near(reverse.areaSqMetres,base.areaSqMetres);near(rotation.areaSqMetres,base.areaSqMetres);near(reverse.outerPerimeterMetres,base.outerPerimeterMetres);
 near(scaled.areaSqMetres,4*base.areaSqMetres);near(scaled.outerPerimeterMetres,2*base.outerPerimeterMetres);
});

test('terrain grids are deterministic, capped and strictly interior, excluding holes',()=>{
 const parcel=feature([rect(-50,-50,50,50),rect(-10,-10,10,10)]), result=prepareTerrainPoints(parcel);
 assert.equal(result.status,'ready');assert.equal(result.points.length,24);assert.deepEqual(prepareTerrainPoints(parcel),result);
 for(const p of result.points){const x=(p.longitude-lon)*MX,y=(p.latitude-lat)*M;assert.ok(Math.abs(x)<50&&Math.abs(y)<50);assert.ok(Math.abs(x)>10||Math.abs(y)>10);}
 assert.ok(prepareTerrainPoints(square(),{maxPoints:10}).points.length<=10);
 assert.equal(prepareTerrainPoints(square(),{maxPoints:5}).status,'insufficient-samples');
 assert.throws(()=>prepareTerrainPoints(square(),{maxPoints:26}),/point|25/i);
});

test('multipart grids represent every part or report insufficient coverage, and a diagonal sliver has no invented dispersed grade',()=>{
 const multipart=feature([[rect(-50,-50,-10,50)],[rect(10,-50,50,50)]],{},'MultiPolygon'),prepared=prepareTerrainPoints(multipart);
 assert.equal(prepared.status,'ready');assert.ok(prepared.points.some(p=>p.longitude<lon));assert.ok(prepared.points.some(p=>p.longitude>lon));
 const sliver=feature([[[-50,-50],[50,50],[50,50.01],[-50,-49.99],[-50,-50]].map(ll)]);
 assert.equal(prepareTerrainPoints(sliver).status,'insufficient-samples');
});

test('flat negative terrain preserves signed elevations, zero relief/grade and a null aspect',()=>{
 const result=fitTerrainPlane(samples());assert.equal(result.status,'fitted');assert.equal(result.requestedCount,25);assert.equal(result.availableCount,25);assert.equal(result.availabilityPct,100);
 assert.equal(result.minElevationMetres,-12);assert.equal(result.maxElevationMetres,-12);assert.equal(result.reliefMetres,0);assert.equal(result.planeGradePct,0);assert.equal(result.rmsResidualMetres,0);assert.equal(result.downhillAspectDegrees,null);
});

test('known inclined plane recovers percent grade, east/north coefficients and downhill compass convention',()=>{
 const result=fitTerrainPlane(samples((x,y)=>100+0.03*x+0.04*y));assert.equal(result.status,'fitted');near(result.planeGradePct,5);near(result.planeAngleDegrees,Math.atan(.05)*180/Math.PI);
 near(result.plane.eastSlope,.03);near(result.plane.northSlope,.04);near(result.plane.interceptMetres,100);near(result.reliefMetres,5.6);
 near(result.downhillAspectDegrees,216.869897645844);near(result.rmsResidualMetres,0);
});

test('sample reordering and vertical translation preserve a plane; residual is descriptive, not source accuracy',()=>{
 const points=samples((x,y)=>.03*x+.04*y+2),base=fitTerrainPlane(points),reverse=fitTerrainPlane([...points].reverse()),higher=fitTerrainPlane(points.map(p=>({...p,elevationMetres:p.elevationMetres+1000})));
 assert.deepEqual(reverse,base);near(higher.planeGradePct,base.planeGradePct);near(higher.rmsResidualMetres,base.rmsResidualMetres);near(higher.plane.interceptMetres,base.plane.interceptMetres+1000);
 const noisy=fitTerrainPlane(points.map((p,i)=>({...p,elevationMetres:p.elevationMetres+(i%2?1:-1)})));assert.ok(noisy.rmsResidualMetres>.9);assert.equal(noisy.residualInterpretation,'Descriptive plane-fit residual; not source or survey accuracy.');
});

test('rotation preserves slope magnitude and coordinate translation preserves metric plane calculations',()=>{
 const angle=.7,c=Math.cos(angle),s=Math.sin(angle);
 const rotated=samples((x,y)=>100+.03*x+.04*y).map(p=>{const x=(p.longitude-lon)*MX,y=(p.latitude-lat)*M,[longitude,latitude]=ll([c*x-s*y,s*x+c*y]);return{longitude,latitude,elevationMetres:p.elevationMetres};});
 const result=fitTerrainPlane(rotated);near(result.planeGradePct,5);near(result.plane.eastSlope,.03*c-.04*s);near(result.plane.northSlope,.03*s+.04*c);
 const translated=rotated.map(p=>({...p,longitude:p.longitude+.1}));near(fitTerrainPlane(translated).planeGradePct,result.planeGradePct);
});

test('availability threshold is exactly 80 percent and missing observations are never zero',()=>{
 const points=samples((x,y)=>-20+.01*x),enough=points.map((p,i)=>({...p,elevationMetres:i<5?null:p.elevationMetres})),sparse=points.map((p,i)=>({...p,elevationMetres:i<6?null:p.elevationMetres}));
 assert.equal(fitTerrainPlane(enough).status,'fitted');assert.equal(fitTerrainPlane(enough).availabilityPct,80);
 const result=fitTerrainPlane(sparse);assert.equal(result.status,'insufficient-samples');assert.equal(result.planeGradePct,null);assert.ok(result.maxElevationMetres<0);
 const none=fitTerrainPlane(points.map(p=>({...p,elevationMetres:null})));assert.equal(none.availableCount,0);assert.equal(none.minElevationMetres,null);assert.equal(none.reliefMetres,null);assert.equal(none.rmsResidualMetres,null);
 assert.equal(fitTerrainPlane(points.slice(0,5)).planeGradePct,null);
});

test('collinear or empty sample sets report insufficiency and malformed/duplicate samples fail',()=>{
 const line=Array.from({length:6},(_,i)=>{const [longitude,latitude]=ll([i*10,i*10]);return{longitude,latitude,elevationMetres:i};});
 assert.equal(fitTerrainPlane(line).status,'insufficient-samples');assert.equal(fitTerrainPlane(line).plane,null);assert.equal(fitTerrainPlane([]).availableCount,0);
 assert.throws(()=>fitTerrainPlane([samples()[0],samples()[0]]),/unique|duplicate/i);
 for(const patch of [{elevationMetres:NaN},{elevationMetres:'20'},{longitude:Infinity},{latitude:91},{elevationMetres:undefined}])assert.throws(()=>fitTerrainPlane([{...samples()[0],...patch}]));
 assert.throws(()=>fitTerrainPlane([...samples(),{longitude:0,latitude:0,elevationMetres:1}]),/25|point|sample/i);
 assert.equal(fitTerrainPlane([]).availabilityPct,null);
 assert.throws(()=>fitTerrainPlane(samples().slice(0,2).map((p,i)=>({...p,elevationMetres:i?1e308:-1e308}))),/numeric range/);
});

test('source-invalid, malformed, zero-area, self-crossing, nested-hole and overlapping-part geometries are rejected',()=>{
 assert.throws(()=>measureSite(feature([rect(-50,-50,50,50)],{geometryStatus:'invalid-source'})),/invalid/i);
 for(const geometry of [null,{type:'Point',coordinates:[lon,lat]},{type:'Polygon',coordinates:[rect(-50,-50,50,50).slice(0,-1)]},{type:'Polygon',coordinates:[[[0,0],[1,1],[2,2],[0,0]].map(ll)]}])assert.throws(()=>measureSite({...square(),geometry}));
 const bow=[[-50,-50],[50,50],[-50,50],[50,-50],[-50,-50]].map(ll);assert.throws(()=>measureSite(feature([bow])));
 assert.throws(()=>measureSite(feature([rect(-50,-50,50,50),rect(-20,-20,20,20),rect(-10,-10,10,10)])),/hole|intersect|overlap/i);
 assert.throws(()=>measureSite(feature([rect(-50,-50,50,50),rect(40,40,60,60)])),/hole|intersect/i);
 assert.throws(()=>measureSite(feature([[rect(-50,-50,30,50)],[rect(-30,-50,50,50)]],{},'MultiPolygon')),/intersect|overlap/i);
 assert.throws(()=>measureSite(feature([rect(-50,-50,50,50)],{areaSqFt:Number.MIN_VALUE})),/numeric range/);
});

test('analysis vertex, rings, parts and metric extent budgets fail before unbounded work',()=>{
 assert.throws(()=>measureSite(feature([rect(-1100,-50,1100,50)])),/extent|2,?000/i);
 assert.throws(()=>measureSite(feature(Array.from({length:65},()=>rect(-50,-50,50,50)))),/ring|64/i);
 assert.throws(()=>measureSite(feature(Array.from({length:17},()=>[rect(-50,-50,50,50)]),{},'MultiPolygon')),/part|16/i);
 assert.throws(()=>measureSite(feature([Array.from({length:4097},()=>[lon,lat])])),/vert|4,?096/i);
});
