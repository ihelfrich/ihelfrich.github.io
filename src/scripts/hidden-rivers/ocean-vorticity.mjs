import { EARTH_METRES_PER_DEGREE } from './field.mjs';

export const EARTH_RADIUS_METRES = EARTH_METRES_PER_DEGREE * 180 / Math.PI;
export const VORTICITY_MAX = 4e-5;
const DEG = Math.PI / 180;
const STOPS = [[34,137,157],[103,203,205],[237,240,229],[246,163,143],[198,65,71]];

// Values are s^-1; the symmetric endpoints clip at ±4 × 10^-5 s^-1.
export function vorticityColor(value) {
  const x=Math.max(-1,Math.min(1,(Number.isFinite(value)?value:0)/VORTICITY_MAX));
  const t=(x+1)*2,i=Math.min(3,Math.floor(t)),f=t-i;
  return STOPS[i].map((v,c)=>Math.round(v+(STOPS[i+1][c]-v)*f));
}

function velocityValid(values,uIndex,vIndex) {
  const u=values[uIndex],v=values[vIndex];
  return Number.isFinite(u)&&Number.isFinite(v)&&u!==-32768&&v!==-32768;
}

// Centered spherical finite differences of a selected velocity snapshot.
// Source components are eastward/northward mm s^-1; the output is signed s^-1.
export function relativeVorticity(field,timeIndex=0) {
  const [nt,ny,nx]=field.shape,plane=ny*nx;
  if(!Number.isInteger(timeIndex)||timeIndex<0||timeIndex>=nt||nx<3||ny<3||
    !(field.dlon!==0&&field.dlat!==0)||field.values.length<2*nt*plane)throw Error('Invalid velocity grid for vorticity');
  const values=new Float64Array(plane);values.fill(NaN);
  const mask=new Uint8Array(plane),uOffset=timeIndex*plane,vOffset=nt*plane+timeIndex*plane;
  const dLambda=field.dlon*DEG,dPhi=field.dlat*DEG;
  for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
    const i=y*nx+x,west=i-1,east=i+1,south=i-nx,north=i+nx;
    if(![i,west,east,south,north].every(j=>velocityValid(field.values,uOffset+j,vOffset+j)))continue;
    const phi=(field.lat0+y*field.dlat)*DEG,phiSouth=(field.lat0+(y-1)*field.dlat)*DEG,phiNorth=(field.lat0+(y+1)*field.dlat)*DEG;
    const cosPhi=Math.cos(phi);
    if(Math.abs(cosPhi)<1e-6)continue;
    const dvDlambda=(field.values[vOffset+east]-field.values[vOffset+west])*.001/(2*dLambda);
    const duCosDphi=((field.values[uOffset+north]*.001*Math.cos(phiNorth))-(field.values[uOffset+south]*.001*Math.cos(phiSouth)))/(2*dPhi);
    const zeta=(dvDlambda-duCosDphi)/(EARTH_RADIUS_METRES*cosPhi);
    if(Number.isFinite(zeta)){values[i]=zeta;mask[i]=1;}
  }
  return {...field,shape:[ny,nx],values,mask,units:'s^-1',quantity:'vertical relative vorticity of horizontal velocity'};
}

// Strict bilinear sampling: all four surrounding derivative nodes must exist.
export function sampleVorticity(field,lon,lat) {
  const [ny,nx]=field.shape,x=(lon-field.lon0)/field.dlon,y=(lat-field.lat0)/field.dlat;
  if(!Number.isFinite(x+y)||x<0||y<0||x>=nx-1||y>=ny-1)return null;
  const ix=Math.floor(x),iy=Math.floor(y),ax=x-ix,ay=y-iy;
  const indices=[iy*nx+ix,iy*nx+ix+1,(iy+1)*nx+ix,(iy+1)*nx+ix+1];
  if(indices.some(i=>!field.mask[i]||!Number.isFinite(field.values[i])))return null;
  const weights=[(1-ax)*(1-ay),ax*(1-ay),(1-ax)*ay,ax*ay];
  return indices.reduce((sum,i,j)=>sum+field.values[i]*weights[j],0);
}

// Keep only contiguous portions for which the complete derivative stencil is
// valid. Coordinates remain lon/lat and the third component becomes ζ (s^-1).
export function vorticityPathRuns(points,field) {
  const runs=[];let run=[];
  const finish=()=>{if(run.length>=2)runs.push(run);run=[];};
  for(const point of points){
    const zeta=sampleVorticity(field,point[0],point[1]);
    if(zeta===null){finish();continue;}
    run.push([point[0],point[1],zeta]);
  }
  finish();return runs;
}

export function vorticityRaster(field,color=vorticityColor) {
  const [height,width]=field.shape,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;if(!field.mask[i]||!Number.isFinite(field.values[i]))continue;
    const edge=Math.min(x,y,width-1-x,height-1-y),alpha=Math.max(1,Math.round(190*Math.min(1,(edge+1)/6)));
    data.set([...color(field.values[i]),alpha],4*((height-1-y)*width+x));
  }
  return {data,width,height,bounds:[field.lon0-field.dlon/2,field.lat0-field.dlat/2,field.lon0+(width-.5)*field.dlon,field.lat0+(height-.5)*field.dlat]};
}
