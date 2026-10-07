export const EARTH_METRES_PER_DEGREE = Math.PI * 6371000 / 180;
const offsetsCache = new WeakMap();
/** Use recorded timestamps when present; retain daily fallback for older exports. */
export function timeOffsets(layer) {
  if (offsetsCache.has(layer)) return offsetsCache.get(layer);
  const count = layer.shape[0];
  let offsets;
  if (layer.dates?.length === count) {
    const first = Date.parse(layer.dates[0]);
    offsets = layer.dates.map(date => (Date.parse(date) - first) / 1000);
    if (offsets.some((value,index) => !Number.isFinite(value) || (index > 0 && value <= offsets[index - 1]))) throw new Error('Velocity dates must be valid and strictly increasing.');
  } else {
    const step = layer.timeStepSeconds ?? 86400;
    if (!(step > 0)) throw new Error('Velocity time step must be positive.');
    offsets = Array.from({length:count},(_,index)=>index*step);
  }
  offsetsCache.set(layer,offsets);
  return offsets;
}
export function sampleVelocity(layer, x, y, seconds) {
  const [nt, ny, nx] = layer.shape;
  const offsets = timeOffsets(layer);
  if (!Number.isFinite(x+y+seconds) || x<0 || y<0 || x>=nx-1 || y>=ny-1 || seconds<0 || seconds>offsets.at(-1)) return null;
  const ix=Math.floor(x), iy=Math.floor(y), ax=x-ix, ay=y-iy;
  let lo=0,hi=nt-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(offsets[mid]<=seconds)lo=mid;else hi=mid;}
  const t=Math.min(nt-2,lo), at=(seconds-offsets[t])/(offsets[t+1]-offsets[t]), plane=nx*ny;
  const indices=[iy*nx+ix,iy*nx+ix+1,(iy+1)*nx+ix,(iy+1)*nx+ix+1];
  const weights=[(1-ax)*(1-ay),ax*(1-ay),(1-ax)*ay,ax*ay];
  const result=[];
  for(let component=0;component<2;component++) {
    let value=0;
    for(let ti=0;ti<2;ti++) {
      const timeWeight=ti?at:1-at;
      if(timeWeight===0)continue;
      for(let j=0;j<4;j++) {
        const v=layer.values[component*nt*plane+(t+ti)*plane+indices[j]];
        if(v===-32768) return null;
        value+=v*.001*weights[j]*timeWeight;
      }
    }
    result.push(value);
  }
  return result;
}
export function gridRate(layer,x,y,seconds) {
  const v=sampleVelocity(layer,x,y,seconds);if(!v)return null;
  const latitude=layer.lat0+y*layer.dlat;
  return [v[0]/(EARTH_METRES_PER_DEGREE*Math.cos(latitude*Math.PI/180)*layer.dlon),v[1]/(EARTH_METRES_PER_DEGREE*layer.dlat),Math.hypot(...v)];
}
export function advance(layer,x,y,seconds,dt) {
  const a=gridRate(layer,x,y,seconds);if(!a)return null;
  const b=gridRate(layer,x+a[0]*dt/2,y+a[1]*dt/2,seconds+dt/2);if(!b)return null;
  const nx=x+b[0]*dt,ny=y+b[1]*dt;
  if(!sampleVelocity(layer,nx,ny,seconds+dt))return null;
  return [nx,ny,b[2]];
}
