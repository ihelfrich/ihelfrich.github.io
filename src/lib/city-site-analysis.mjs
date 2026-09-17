/** Preliminary source-geometry measurements and descriptive terrain sampling. No engineering design. */
export const SITE_ANALYSIS_MODEL_VERSION='st-louis-site-analysis-v1';
const EARTH_RADIUS_METRES=6371008.8, RADIANS_PER_DEGREE=Math.PI/180;
const METRES_PER_DEGREE=EARTH_RADIUS_METRES*RADIANS_PER_DEGREE, FEET_PER_METRE=1/0.3048;
const MAX_VERTICES=4096, MAX_PARTS=16, MAX_RINGS=64, MAX_EXTENT_METRES=2000, MAX_POINTS=25;
const RESIDUAL_INTERPRETATION='Descriptive plane-fit residual; not source or survey accuracy.';
const LIMITATIONS=Object.freeze([
 'Approximate local GIS geometry measurements; not a legal survey, frontage or buildable envelope.',
 'Source account area and polygon area may describe different objects; shared account areas are not aggregated.',
 'Terrain plane statistics do not establish design grading, drainage, flood depth, soils or foundation suitability.',
]);

function coordinate(longitude,latitude) {
 if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>85)throw new RangeError('Site analysis requires finite WGS84 coordinates between latitudes −85° and 85°.');
 return [longitude,latitude];
}
function sourceRecord(parcel) {
 const p=parcel?.properties||{};
 return {recordKey:p.recordKey??null,parcelKey:p.parcelKey??null,parcelId:p.parcelId??null,handle:p.handle??null,sourceObjectId:p.sourceObjectId??null};
}
function projectionFor(positions) {
 if(!positions.length)return null;
 let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
 for(const [lon,lat] of positions){west=Math.min(west,lon);east=Math.max(east,lon);south=Math.min(south,lat);north=Math.max(north,lat);}
 const longitude=(west+east)/2,latitude=(south+north)/2,longitudeMetresPerDegree=METRES_PER_DEGREE*Math.cos(latitude*RADIANS_PER_DEGREE);
 const eastWestExtentMetres=(east-west)*longitudeMetresPerDegree,northSouthExtentMetres=(north-south)*METRES_PER_DEGREE;
 if(east-west>180||Math.hypot(eastWestExtentMetres,northSouthExtentMetres)>MAX_EXTENT_METRES)throw new RangeError('Site analysis extent must have a diagonal no greater than 2,000 metres.');
 return {method:'local-equirectangular',origin:{longitude,latitude},earthRadiusMetres:EARTH_RADIUS_METRES,longitudeMetresPerDegree,latitudeMetresPerDegree:METRES_PER_DEGREE,axes:'x east; y north',extent:{eastWestExtentMetres,northSouthExtentMetres},bounds:[west,south,east,north]};
}
const project=([lon,lat],p)=>[(lon-p.origin.longitude)*p.longitudeMetresPerDegree,(lat-p.origin.latitude)*p.latitudeMetresPerDegree];
const unproject=([x,y],p)=>({longitude:p.origin.longitude+x/p.longitudeMetresPerDegree,latitude:p.origin.latitude+y/p.latitudeMetresPerDegree});
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function orientation(a,b,c) {
 const value=cross(a,b,c),tolerance=1e-10*Math.max(1,Math.hypot(b[0]-a[0],b[1]-a[1])*Math.hypot(c[0]-a[0],c[1]-a[1]));
 return Math.abs(value)<=tolerance?0:Math.sign(value);
}
function onSegment(p,a,b) {
 return orientation(a,b,p)===0&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
}
function segmentsIntersect(a,b,c,d) {
 if(Math.max(a[0],b[0])+1e-8<Math.min(c[0],d[0])||Math.max(c[0],d[0])+1e-8<Math.min(a[0],b[0])||Math.max(a[1],b[1])+1e-8<Math.min(c[1],d[1])||Math.max(c[1],d[1])+1e-8<Math.min(a[1],b[1]))return false;
 const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);
 return (o1*o2<0&&o3*o4<0)||(o1===0&&onSegment(c,a,b))||(o2===0&&onSegment(d,a,b))||(o3===0&&onSegment(a,c,d))||(o4===0&&onSegment(b,c,d));
}
function ringLocation(point,ring) {
 let inside=false;
 for(let i=0;i<ring.length-1;i++){
  const a=ring[i],b=ring[i+1];if(onSegment(point,a,b))return 0;
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside?1:-1;
}
function filledInterior(point,rings) {
 return ringLocation(point,rings[0])===1&&rings.slice(1).every(ring=>ringLocation(point,ring)===-1);
}
function ringsIntersect(a,b) {
 for(let i=0;i<a.length-1;i++)for(let j=0;j<b.length-1;j++)if(segmentsIntersect(a[i],a[i+1],b[j],b[j+1]))return true;
 return false;
}
function signedArea(ring) {
 let twiceArea=0;
 for(let i=0;i<ring.length-1;i++)twiceArea+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];
 return twiceArea/2;
}
function perimeter(ring) {
 let length=0;for(let i=0;i<ring.length-1;i++)length+=Math.hypot(ring[i+1][0]-ring[i][0],ring[i+1][1]-ring[i][1]);return length;
}
function validateRing(ring) {
 const n=ring.length-1;
 for(let i=0;i<n;i++){
  const a=ring[i],b=ring[i+1],c=ring[(i+2)%n];
  if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-7)throw new TypeError('Parcel ring contains a duplicate or zero-length edge.');
  if(orientation(a,b,c)===0&&(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])<0)throw new TypeError('Parcel ring contains a backtracking edge.');
  for(let j=i+2;j<n;j++){
   if(i===0&&j===n-1)continue;
   if(segmentsIntersect(a,b,ring[j],ring[j+1]))throw new TypeError('Parcel ring has a self-intersection or repeated vertex.');
  }
 }
 if(Math.abs(signedArea(ring))<=1e-10)throw new TypeError('Parcel ring has zero area.');
}
function validateParcel(parcel) {
 if(parcel?.type!=='Feature')throw new TypeError('Site analysis requires one selected parcel GeoJSON Feature.');
 if(parcel.properties?.geometryStatus==='invalid-source')throw new TypeError('The source marks this parcel geometry invalid; site measurements are unavailable.');
 const geometry=parcel.geometry;
 let rawParts;
 if(geometry?.type==='Polygon')rawParts=[geometry.coordinates];
 else if(geometry?.type==='MultiPolygon')rawParts=geometry.coordinates;
 else throw new TypeError('Site analysis requires Polygon or MultiPolygon geometry.');
 if(!Array.isArray(rawParts)||!rawParts.length||rawParts.length>MAX_PARTS)throw new RangeError('Site analysis supports between 1 and 16 polygon parts.');
 let vertexCount=0,ringCount=0;
 const positions=[];
 for(const rings of rawParts){
  if(!Array.isArray(rings)||!rings.length)throw new TypeError('A parcel polygon needs an outer ring.');
  ringCount+=rings.length;if(ringCount>MAX_RINGS)throw new RangeError('Site analysis supports at most 64 rings.');
  for(const ring of rings){
   if(!Array.isArray(ring)||ring.length<4)throw new TypeError('A parcel ring needs at least four closed positions.');
   vertexCount+=ring.length;if(vertexCount>MAX_VERTICES)throw new RangeError('Site analysis supports at most 4,096 vertices.');
   for(const p of ring){if(!Array.isArray(p)||p.length!==2)throw new TypeError('Site geometry needs two-dimensional WGS84 positions.');coordinate(p[0],p[1]);positions.push(p);}
   if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw new TypeError('Parcel rings must be closed.');
  }
 }
 const projection=projectionFor(positions),parts=rawParts.map(rings=>rings.map(ring=>ring.map(p=>project(p,projection))));
 for(const rings of parts){
  for(const ring of rings)validateRing(ring);
  for(let i=1;i<rings.length;i++){
   if(ringLocation(rings[i][0],rings[0])!==1||ringsIntersect(rings[0],rings[i]))throw new TypeError('Parcel holes must lie strictly inside their shell without intersecting it.');
   for(let j=1;j<i;j++)if(ringsIntersect(rings[i],rings[j])||ringLocation(rings[i][0],rings[j])!==-1||ringLocation(rings[j][0],rings[i])!==-1)throw new TypeError('Parcel holes must not overlap, touch or nest.');
  }
 }
 for(let i=0;i<parts.length;i++)for(let j=0;j<i;j++){
  for(const a of parts[i])for(const b of parts[j])if(ringsIntersect(a,b))throw new TypeError('Parcel polygon parts have intersecting or touching boundaries.');
  if(filledInterior(parts[i][0][0],parts[j])||filledInterior(parts[j][0][0],parts[i]))throw new TypeError('Filled parcel polygon parts overlap.');
 }
 return {parts,projection,vertexCount,ringCount};
}

export function measureSite(parcel) {
 const {parts,projection,vertexCount,ringCount}=validateParcel(parcel);
 let areaSqMetres=0,outerPerimeterMetres=0,allRingPerimeterMetres=0;
 for(const rings of parts){
  areaSqMetres+=Math.abs(signedArea(rings[0]))-rings.slice(1).reduce((sum,ring)=>sum+Math.abs(signedArea(ring)),0);
  outerPerimeterMetres+=perimeter(rings[0]);allRingPerimeterMetres+=rings.reduce((sum,ring)=>sum+perimeter(ring),0);
 }
 const areaSqFt=areaSqMetres*FEET_PER_METRE**2,sourceAreaSqFt=typeof parcel.properties?.areaSqFt==='number'&&Number.isFinite(parcel.properties.areaSqFt)&&parcel.properties.areaSqFt>=0?parcel.properties.areaSqFt:null;
 const areaDifferenceSqFt=sourceAreaSqFt>0?areaSqFt-sourceAreaSqFt:null,areaDifferencePct=sourceAreaSqFt>0?(areaSqFt/sourceAreaSqFt-1)*100:null;
 if(areaSqMetres<=0||![areaSqMetres,areaSqFt,outerPerimeterMetres,allRingPerimeterMetres,...[areaDifferenceSqFt,areaDifferencePct].filter(v=>v!==null)].every(Number.isFinite))throw new RangeError('Parcel measurement exceeded the positive finite numeric range.');
 return {status:'measured',modelVersion:SITE_ANALYSIS_MODEL_VERSION,classification:'preliminary-source-geometry-measurement',sourceRecord:sourceRecord(parcel),areaSqMetres,areaSqFt,outerPerimeterMetres,allRingPerimeterMetres,outerPerimeterFeet:outerPerimeterMetres*FEET_PER_METRE,allRingPerimeterFeet:allRingPerimeterMetres*FEET_PER_METRE,partCount:parts.length,holeCount:ringCount-parts.length,vertexCount,...projection.extent,sourceAreaSqFt,areaDifferenceSqFt,areaDifferencePct,projection,units:{area:'m² and ft²',length:'m and ft',feetPerMetre:FEET_PER_METRE},limitations:[...LIMITATIONS]};
}

function centeredDesign(points) {
 const count=points.length;
 if(!count)return null;
 const meanX=points.reduce((sum,p)=>sum+p[0],0)/count,meanY=points.reduce((sum,p)=>sum+p[1],0)/count;
 let xx=0,xy=0,yy=0;
 for(const p of points){const x=p[0]-meanX,y=p[1]-meanY;xx+=x*x;xy+=x*y;yy+=y*y;}
 const determinant=xx*yy-xy*xy,scale=(xx+yy)**2;
 return {meanX,meanY,xx,xy,yy,determinant,usable:Number.isFinite(determinant)&&scale>0&&determinant>scale*1e-10};
}

export function prepareTerrainPoints(parcel,{maxPoints=MAX_POINTS}={}) {
 if(!Number.isSafeInteger(maxPoints)||maxPoints<1||maxPoints>MAX_POINTS)throw new RangeError('Terrain point limit must be an integer between 1 and 25.');
 const {parts,projection}=validateParcel(parcel),side=Math.floor(Math.sqrt(maxPoints)),metricPoints=[],represented=new Set(),{eastWestExtentMetres:width,northSouthExtentMetres:height}=projection.extent;
 for(let row=0;row<side;row++)for(let col=0;col<side;col++){
  const p=[-width/2+(col+.5)*width/side,-height/2+(row+.5)*height/side],part=parts.findIndex(rings=>filledInterior(p,rings));
  if(part<0)continue;metricPoints.push(p);represented.add(part);
 }
 const enough=metricPoints.length>=6,allParts=represented.size===parts.length,dispersed=centeredDesign(metricPoints)?.usable===true;
 const reason=!enough?'Fewer than six strict interior grid samples fit this parcel.':!allParts?'The bounded regular grid does not represent every polygon part.':!dispersed?'The interior sample grid is too narrow or collinear for a terrain plane.':null;
 return {status:reason?'insufficient-samples':'ready',modelVersion:SITE_ANALYSIS_MODEL_VERSION,sourceRecord:sourceRecord(parcel),points:metricPoints.map(p=>unproject(p,projection)),requestedCount:metricPoints.length,maxPoints,grid:{rows:side,columns:side,policy:'regular cell centres; strict filled interior only'},representedPartCount:represented.size,partCount:parts.length,reason,projection};
}

export function fitTerrainPlane(samples) {
 if(!Array.isArray(samples)||samples.length>MAX_POINTS)throw new RangeError('A terrain fit accepts an array of at most 25 samples.');
 const positions=new Set(),ordered=samples.map(sample=>{
  const position=coordinate(sample?.longitude,sample?.latitude),key=position.join(',');
  if(positions.has(key))throw new TypeError('Terrain sample positions must be unique; duplicate observations cannot increase coverage.');positions.add(key);
  if(sample.elevationMetres!==null&&!Number.isFinite(sample.elevationMetres))throw new TypeError('Terrain elevation must be a finite number in metres or explicit null.');
  return {...sample};
 }).sort((a,b)=>a.longitude-b.longitude||a.latitude-b.latitude);
 const projection=projectionFor(ordered.map(s=>[s.longitude,s.latitude])),available=ordered.filter(s=>s.elevationMetres!==null),requestedCount=ordered.length,availableCount=available.length,availabilityPct=requestedCount?availableCount/requestedCount*100:null;
 const elevations=available.map(s=>s.elevationMetres),minElevationMetres=availableCount?Math.min(...elevations):null,maxElevationMetres=availableCount?Math.max(...elevations):null;
 const result={status:'insufficient-samples',modelVersion:SITE_ANALYSIS_MODEL_VERSION,classification:'descriptive-sampled-terrain-plane',reason:null,requestedCount,availableCount,availabilityPct,minElevationMetres,maxElevationMetres,reliefMetres:availableCount?maxElevationMetres-minElevationMetres:null,planeGradePct:null,planeAngleDegrees:null,downhillAspectDegrees:null,rmsResidualMetres:null,plane:null,projection,residualInterpretation:RESIDUAL_INTERPRETATION};
 if(result.reliefMetres!==null&&!Number.isFinite(result.reliefMetres))throw new RangeError('Terrain relief exceeded the finite numeric range.');
 if(availableCount<6){result.reason='At least six available elevation samples are required.';return result;}
 if(availableCount*5<requestedCount*4){result.reason='At least 80% of requested elevation samples must be available.';return result;}
 const metric=available.map(s=>project([s.longitude,s.latitude],projection)),design=centeredDesign(metric);
 if(!design?.usable){result.reason='Available sample positions are collinear or too narrowly dispersed for a stable plane.';return result;}
 const firstElevation=elevations[0],meanOffset=elevations.reduce((sum,z)=>sum+(z-firstElevation),0)/availableCount,meanZ=firstElevation+meanOffset;
 let xz=0,yz=0;
 for(let i=0;i<availableCount;i++){const z=elevations[i]-firstElevation-meanOffset;xz+=(metric[i][0]-design.meanX)*z;yz+=(metric[i][1]-design.meanY)*z;}
 const eastSlope=(xz*design.yy-yz*design.xy)/design.determinant,northSlope=(yz*design.xx-xz*design.xy)/design.determinant,interceptMetres=meanZ-eastSlope*design.meanX-northSlope*design.meanY,slope=Math.hypot(eastSlope,northSlope);
 let residualSum=0;
 for(let i=0;i<availableCount;i++){const residual=(elevations[i]-firstElevation-meanOffset)-eastSlope*(metric[i][0]-design.meanX)-northSlope*(metric[i][1]-design.meanY);residualSum+=residual*residual;}
 const rmsResidualMetres=Math.sqrt(residualSum/availableCount);
 if(![eastSlope,northSlope,interceptMetres,slope*100,rmsResidualMetres,result.reliefMetres].every(Number.isFinite))throw new RangeError('Terrain fitting exceeded the finite numeric range.');
 return {...result,status:'fitted',reason:null,planeGradePct:slope*100,planeAngleDegrees:Math.atan(slope)/RADIANS_PER_DEGREE,downhillAspectDegrees:slope<=1e-12?null:(Math.atan2(-eastSlope,-northSlope)/RADIANS_PER_DEGREE+360)%360,rmsResidualMetres,plane:{eastSlope,northSlope,interceptMetres}};
}
