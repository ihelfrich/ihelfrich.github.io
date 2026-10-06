export const EARTH_METRES_PER_DEGREE = Math.PI * 6371000 / 180;
export function sampleVelocity(layer, x, y, seconds) {
  const [nt, ny, nx] = layer.shape;
  if (!Number.isFinite(x+y+seconds) || x<0 || y<0 || x>=nx-1 || y>=ny-1 || seconds<0 || seconds>(nt-1)*86400) return null;
  const ix=Math.floor(x), iy=Math.floor(y), ax=x-ix, ay=y-iy;
  const t=Math.min(nt-2,Math.floor(seconds/86400)), at=seconds/86400-t, plane=nx*ny;
  const indices=[iy*nx+ix,iy*nx+ix+1,(iy+1)*nx+ix,(iy+1)*nx+ix+1];
  const weights=[(1-ax)*(1-ay),ax*(1-ay),(1-ax)*ay,ax*ay];
  const result=[];
  for(let component=0;component<2;component++) {
    let value=0;
    for(let ti=0;ti<2;ti++) for(let j=0;j<4;j++) {
      const v=layer.values[component*nt*plane+(t+ti)*plane+indices[j]];
      if(v===-32768) return null;
      value+=v*.001*weights[j]*(ti?at:1-at);
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
