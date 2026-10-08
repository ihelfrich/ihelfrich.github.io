import {createDyeTank3D} from '../../src/scripts/hidden-rivers/dye-tank-3d.mjs';
import {seawaterDensity,referenceDensity} from '../../src/scripts/hidden-rivers/tank-seawater.mjs';
export const couplingOptions={nx:16,ny:16,nz:16,width:.24,height:.24,depth:.24,viscosity:0,diffusivity:0};
export function smoothCouplingTank(kernels=null){
 const t=createDyeTank3D({...couplingOptions,kernels}),{nx,ny,nz,dx,dy,dz}=t;
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const x=(i+.5)*dx,y=(j+.5)*dy,z=(k+.5)*dz,d=(k*ny+j)*nx+i;
  t.salinity[d]=30+.6*Math.sin(2*Math.PI*x/t.width)*Math.sin(Math.PI*y/t.height)*Math.sin(Math.PI*z/t.depth);
  t.gold[d]=.3+.2*Math.sin(2*Math.PI*x/t.width)*Math.cos(Math.PI*y/t.height)*Math.sin(Math.PI*z/t.depth);
 }
 t.goldActive=true;t.dye.set(t.gold);t.initialSaltIntegral=t.integral(t.salinity);t.injectedDyeIntegral=t.integral(t.gold);return t;
}
// Independent density anomaly and conservative flux construction; projection is
// the separately verified linear closed-wall operator (a unit-second impulse).
export function initialScalarAcceleration(t){
 const b=createDyeTank3D(couplingOptions),{nx,ny,nz}=t,plane=nx*ny,rho=Float64Array.from(t.salinity,seawaterDensity),means=new Float64Array(ny);
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)means[j]+=rho[(k*ny+j)*nx+i]/(nx*nz);
 for(let k=0;k<nz;k++)for(let j=1;j<ny;j++)for(let i=0;i<nx;i++){
  const d=(k*ny+j)*nx+i;b.v[(k*(ny+1)+j)*nx+i]=9.81/referenceDensity*.5*(rho[d]-means[j]+rho[d-nx]-means[j-1]);
 }
 b.project();
 const q=t.salinity,L=new Float64Array(q.length),slope=(a,c,forward)=>a*c<=0?0:Math.sign(a)*Math.min(2*Math.abs(a),Math.abs(forward?(a+2*c)/3:(2*a+c)/3),2*Math.abs(c));
 for(let axis=0;axis<3;axis++){
  const count=[nx,ny,nz][axis],stride=[1,nx,plane][axis],spacing=[t.dx,t.dy,t.dz][axis],slopes=new Float64Array(q.length);
  const face=(i,j,k)=>axis===0?b.u[(k*ny+j)*(nx+1)+i]:axis===1?b.v[(k*(ny+1)+j)*nx+i]:b.w[(k*ny+j)*nx+i];
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const n=[i,j,k][axis],d=(k*ny+j)*nx+i;if(n===0||n===count-1)continue;
   const next=[i,j,k];next[axis]++;slopes[d]=slope(q[d]-q[d-stride],q[d+stride]-q[d],face(i,j,k)+face(...next)>=0);
  }
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   if([i,j,k][axis]===0)continue;const c=(k*ny+j)*nx+i,a=c-stride,v=face(i,j,k),flux=v*(v>=0?q[a]+.5*slopes[a]:q[c]-.5*slopes[c])/spacing;L[a]-=flux;L[c]+=flux;
  }
 }
 return L;
}
export function rmsDifference(a,b){let sum=0;for(let i=0;i<a.length;i++)sum+=(a[i]-b[i])**2;return Math.sqrt(sum/a.length);}
