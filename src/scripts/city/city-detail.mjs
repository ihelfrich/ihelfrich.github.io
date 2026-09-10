import * as T from 'three';
import { contains, centroid, rand, hash, ribbon, mergedMesh } from './city-geometry.mjs';

const ROAD_WIDTHS = { motorway:23,trunk:20,primary:17,secondary:15,tertiary:13,residential:10,unclassified:10,service:6,living_street:7 };
const DRIVABLE = new Set(['primary','secondary','tertiary','residential','unclassified','service','living_street']);
const MAX_TRIANGLES = 118000;
const same = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]) < .001;
const cleanRing = ring => ring.length > 1 && same(ring[0],ring.at(-1)) ? ring.slice(0,-1) : ring;
const area = ring => Math.abs(ring.reduce((sum,p,i) => {const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
const within = (point,b) => contains(point,b.polygon) && !(b.holes || []).some(r => contains(point,r));
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function intersects(a,b,c,d) { return cross(a,b,c)*cross(a,b,d)<-1e-8 && cross(c,d,a)*cross(c,d,b)<-1e-8; }

// All corners and edge midpoints must be on solid roof. Also reject a footprint
// boundary crossing, or a hole entirely enclosed by a rectangular equipment pad.
export function roofRectangleFits(b,center,width,depth,angle=0) {
  const c=Math.cos(angle),s=Math.sin(angle);
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z]) => [center[0]+x*width/2*c-z*depth/2*s,center[1]+x*width/2*s+z*depth/2*c]);
  if (!within(center,b) || corners.some(p => !within(p,b))) return false;
  for(let i=0;i<4;i++) {
    const p=corners[i],q=corners[(i+1)%4];
    if(!within([(p[0]+q[0])/2,(p[1]+q[1])/2],b)) return false;
    for(const ring of [b.polygon,...(b.holes || [])]) for(let j=0;j<ring.length;j++) {
      if(intersects(p,q,ring[j],ring[(j+1)%ring.length])) return false;
    }
  }
  return !(b.holes || []).some(r => r.some(p => contains(p,corners)));
}

function roadIndex(roads) {
  const cells=new Map(),segments=[];
  for(const road of roads || []) {
    if(!DRIVABLE.has(road.kind) || road.tunnel || road.bridge || !road.points) continue;
    for(let i=1;i<road.points.length;i++) {
      const a=road.points[i-1],b=road.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length<.1) continue;
      const segment={a,b,length,road,dx:(b[0]-a[0])/length,dz:(b[1]-a[1])/length};
      const index=segments.push(segment)-1;
      for(let x=Math.floor((Math.min(a[0],b[0])-20)/80);x<=Math.floor((Math.max(a[0],b[0])+20)/80);x++)
        for(let z=Math.floor((Math.min(a[1],b[1])-20)/80);z<=Math.floor((Math.max(a[1],b[1])+20)/80);z++) {
          const key=`${x},${z}`;
          if(!cells.has(key)) cells.set(key,[]);
          cells.get(key).push(index);
        }
    }
  }
  return function nearest(point,ids) {
    let best=null;
    const candidates=cells.get(`${Math.floor(point[0]/80)},${Math.floor(point[1]/80)}`) || [];
    for(const index of candidates) {
      const s=segments[index];
      if(ids?.length && !ids.includes(s.road.id)) continue;
      const t=T.MathUtils.clamp(((point[0]-s.a[0])*s.dx+(point[1]-s.a[1])*s.dz)/s.length,0,1);
      const pointOnRoad=[s.a[0]+s.dx*t*s.length,s.a[1]+s.dz*t*s.length];
      const distance=Math.hypot(point[0]-pointOnRoad[0],point[1]-pointOnRoad[1]);
      if(distance<20 && (!best || distance<best.distance)) best={...s,point:pointOnRoad,distance};
    }
    return best;
  };
}

async function getStreetDetails(data) {
  if(data.streetDetails) return data.streetDetails;
  const controller=new AbortController(),timer=setTimeout(() => controller.abort(),6000);
  try {
    const response=await fetch('/st-louis/street-details.json',{signal:controller.signal});
    if(!response.ok) return null;
    const detail=await response.json();
    if(!Array.isArray(detail.points) || detail.origin?.some((v,i) => Math.abs(v-data.origin?.[i])>1e-6)) return null;
    return detail;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

/** Static artistic roof details plus furniture at mapped OSM node positions.
 * Street JSON may be passed as data.streetDetails for an offline caller/test.
 * Shared input materials are never disposed by this module.
 */
export async function createCityDetail(data,materials) {
  const group=new T.Group();group.name='Mapped street furniture and illustrative roof details';
  const stats={triangles:0,drawCalls:0,roofBuildings:0,parapetSegments:0,roofUnits:0,paintedCrossings:0,benches:0,streetLamps:0,streetDataAvailable:false,artisticRoofDetails:true};
  const own=new Set();
  const material = props => {const m=new T.MeshStandardMaterial(props);own.add(m);return m;};
  const buckets={parapet:[],equipment:[],metal:[],dark:[],bench:[],paint:[],lamp:[],glow:[]};
  const mats={
    parapet:materials.concrete,
    equipment:material({color:'#a7aaa1',roughness:.73,metalness:.15}),
    metal:material({color:'#7f8989',roughness:.5,metalness:.55}),
    dark:material({color:'#292f30',roughness:.89,metalness:.18}),
    bench:material({color:'#87775d',roughness:.88}),
    paint:material({color:'#e4dfcb',roughness:.91,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),
    lamp:material({color:'#363c3d',roughness:.65,metalness:.5}),
    glow:material({color:'#ddd1af',emissive:'#ffc982',emissiveIntensity:0,roughness:.3}),
  };
  if(!mats.parapet) mats.parapet=material({color:'#aaa798',roughness:.95});
  function add(bucket,g,limit=MAX_TRIANGLES) {
    const triangles=(g.index?.count ?? g.attributes.position.count)/3;
    if(stats.triangles+triangles>limit) {g.dispose();return false;}
    // All buckets are non-indexed so primitive boxes, cylinders and ribbons merge.
    const meshGeo=g.index ? g.toNonIndexed() : g;
    if(meshGeo!==g) g.dispose();
    buckets[bucket].push(meshGeo);stats.triangles+=triangles;return true;
  }
  function box(bucket,x,y,z,w,h,d,angle=0,limit=MAX_TRIANGLES) {
    const g=new T.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    // BoxGeometry's normalized UVs would stretch a concrete tile across the full
    // parapet length. Local meter UVs preserve the provider's physical tile size.
    for(let i=0;i<p.count;i++) {
      if(Math.abs(n.getY(i))>.5) uv.setXY(i,p.getX(i),p.getZ(i));
      else if(Math.abs(n.getX(i))>.5) uv.setXY(i,p.getZ(i),p.getY(i));
      else uv.setXY(i,p.getX(i),p.getY(i));
    }
    g.rotateY(-angle);g.translate(x,y,z);return add(bucket,g,limit);
  }
  function disc(bucket,x,y,z,radius,limit=MAX_TRIANGLES) {
    const g=new T.CircleGeometry(radius,12);g.rotateX(-Math.PI/2);g.translate(x,y,z);return add(bucket,g,limit);
  }

  const candidates=(data.buildings || []).filter(b => b.polygon?.length>=3 && Number.isFinite(b.height) && b.height>=6 && b.height>(b.minHeight || 0) && ['flat','unknown',undefined,null,''].includes(b.roof) && !/arch|courthouse|cathedral|church|stadium|basilica/i.test(`${b.name || ''} ${b.kind || ''}`)).map(b => ({b,area:area(b.polygon)-(b.holes || []).reduce((s,r)=>s+area(r),0)})).filter(v => v.area>=180 && v.area<70000).sort((a,b) => b.b.height*Math.sqrt(b.area)-a.b.height*Math.sqrt(a.area));
  for(const {b,area:roofArea} of candidates) {
    if(stats.triangles>51500 || stats.roofBuildings>=450) break;
    const y=.3+b.height,height=T.MathUtils.clamp(b.height*.011,.48,1.05),before=stats.triangles;
    // A slim inset wall follows each original outer/hole edge. Concave corners
    // that cannot contain a rectangular segment are omitted rather than bridged.
    for(const rawRing of [b.polygon,...(b.holes || [])]) {
      const ring=cleanRing(rawRing);
      for(let i=0;i<ring.length;i++) {
        const a=ring[i],p=ring[(i+1)%ring.length],dx=p[0]-a[0],dz=p[1]-a[1],length=Math.hypot(dx,dz);
        if(length<1.2 || length>400) continue;
        const angle=Math.atan2(dz,dx),mid=[(a[0]+p[0])/2,(a[1]+p[1])/2],nx=-dz/length,nz=dx/length;
        const inward=within([mid[0]+nx*.23,mid[1]+nz*.23],b)?1:-1;
        const center=[mid[0]+nx*.23*inward,mid[1]+nz*.23*inward];
        if(roofRectangleFits(b,center,length-.64,.32,angle) && box('parapet',center[0],y+height/2,center[1],length-.64,height,.32,angle,52000)) stats.parapetSegments++;
      }
    }
    const rng=rand(hash(`roof-detail:${b.id}`)),center=centroid(b.polygon);
    const bounds=new T.Box2().setFromPoints(b.polygon.map(p=>new T.Vector2(...p)));
    const ring=cleanRing(b.polygon);
    let longest=0,angle=0;
    for(let i=0;i<ring.length;i++) {
      const a=ring[i],q=ring[(i+1)%ring.length],length=Math.hypot(q[0]-a[0],q[1]-a[1]);
      if(length>longest) {longest=length;angle=Math.atan2(q[1]-a[1],q[0]-a[0]);}
    }
    const placements=[],wanted=Math.min(4,Math.max(1,Math.floor(roofArea/1900)));
    for(let attempt=0;attempt<32 && placements.length<wanted && stats.triangles<51800;attempt++) {
      const p=attempt===0?center:[T.MathUtils.lerp(bounds.min.x,bounds.max.x,rng()),T.MathUtils.lerp(bounds.min.y,bounds.max.y,rng())];
      if(!roofRectangleFits(b,p,7.2,4.8,angle) || placements.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<8)) continue;
      placements.push(p);
      const ux=Math.cos(angle),uz=Math.sin(angle),vx=-uz,vz=ux,at=(u,v)=>[p[0]+ux*u+vx*v,p[1]+uz*u+vz*v];
      const base=at(0,0),duct=at(2.3,0),h=.85+rng()*.65;
      box('dark',base[0],y+.1,base[1],3.6,.2,2.3,angle,52000);
      box('equipment',base[0],y+.2+h/2,base[1],3.25,h,2,angle,52000);
      box('metal',duct[0],y+.45,duct[1],1.45,.62,.7,angle,52000);
      for(const u of [-.83,.83]) {const f=at(u,0);disc('dark',f[0],y+.21+h,f[1],.62,52000);}
      stats.roofUnits++;
    }
    if(stats.triangles>before) stats.roofBuildings++;
  }

  const detail=await getStreetDetails(data);
  stats.streetDataAvailable=!!detail;
  if(detail) {
    const nearest=roadIndex(data.roads),painted=[];
    const crossings=detail.points.filter(p=>p.kind==='crossing');
    for(const node of crossings) {
      const marking=node.tags?.['crossing:markings'],crossing=node.tags?.crossing;
      if(marking==='no' || crossing==='unmarked') continue;
      const style=marking || (['marked','zebra'].includes(crossing)?crossing:null);
      if(!style || style==='surface') continue;
      let road=nearest(node.point,node.roadIds);
      if(!road && !node.roadIds?.length) road=nearest(node.point);
      if(!road) continue;
      const p=road.point,width=ROAD_WIDTHS[road.road.kind] || 10;
      // A crossing may contain separate tagged curb/median nodes. One small
      // physical crossing, not one crosswalk per OSM node, should be rendered.
      if(painted.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<5.5)) continue;
      const dx=road.dx,dz=road.dz,nx=-dz,nz=dx,point=(along,across)=>[p[0]+dx*along+nx*across,p[1]+dz*along+nz*across];
      if(['lines','yes','marked','dashes'].includes(style)) {
        for(const offset of [-1.5,1.5]) add('paint',ribbon([point(offset,-width*.47),point(offset,width*.47)],.2,.37),75500);
      } else {
        for(let across=-width*.46+.3;across<width*.46;across+=1.05) add('paint',ribbon([point(-1.55,across),point(1.55,across)],.48,.37),75500);
      }
      painted.push(p);stats.paintedCrossings++;
      if(stats.triangles>=75400) break;
    }
    const lamps=detail.points.filter(p=>p.kind==='street_lamp');
    for(const node of lamps) {
      const [x,z]=node.point,near=nearest(node.point),toward=near?Math.atan2(near.point[1]-z,near.point[0]-x):0;
      const declared=Number.parseFloat(node.tags?.height),h=Number.isFinite(declared)?T.MathUtils.clamp(declared,3,12):6.4;
      const g=new T.CylinderGeometry(.07,.12,h,6);g.translate(x,.35+h/2,z);
      if(!add('lamp',g,84500)) break;
      const tx=Math.cos(toward),tz=Math.sin(toward);
      box('lamp',x+tx*.68,.35+h,z+tz*.68,1.45,.1,.1,toward,84500);
      box('lamp',x+tx*1.32,.32+h,z+tz*1.32,.75,.16,.34,toward,84500);
      box('glow',x+tx*1.32,.22+h,z+tz*1.32,.63,.03,.26,toward,84500);
      stats.streetLamps++;
    }
    const benches=detail.points.filter(p=>p.kind==='bench');
    for(const node of benches) {
      const [x,z]=node.point,near=nearest(node.point),declared=Number.parseFloat(node.tags?.direction);
      // OSM direction is a compass bearing for facing; the bench's long axis
      // runs across that direction. Untagged orientation follows the nearby road.
      const angle=Number.isFinite(declared)?declared*Math.PI/180:near?Math.atan2(near.dz,near.dx):0;
      if(stats.triangles+48>MAX_TRIANGLES) break;
      const dx=Math.cos(angle),dz=Math.sin(angle),nx=-dz,nz=dx;
      box('bench',x,.88,z,1.7,.12,.45,angle);
      if(node.tags?.backrest!=='no') box('bench',x+nx*.21,1.13,z+nz*.21,1.7,.46,.085,angle);
      for(const side of [-.57,.57]) box('lamp',x+dx*side,.59,z+dz*side,.07,.48,.38,angle);
      stats.benches++;
    }
  }
  for(const [key,geometries] of Object.entries(buckets)) {
    const mesh=mergedMesh(geometries,mats[key],group,!['paint','glow','dark'].includes(key));
    if(mesh) {mesh.name=`city-detail-${key}`;stats.drawCalls++;}
  }
  group.userData.detailStats=stats;
  let disposed=false;
  return {
    group,
    setNight(amount) {mats.glow.emissiveIntensity=2.8*T.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1);},
    dispose() {
      if(disposed) return;disposed=true;
      group.traverse(object=>object.geometry?.dispose());
      for(const m of own) m.dispose();
      group.clear();
    },
  };
}
