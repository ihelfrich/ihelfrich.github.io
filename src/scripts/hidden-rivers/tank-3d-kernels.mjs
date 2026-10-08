// Same Float64 fields and equations as the JS reference; no display state feeds back.
import {seawaterDensity,referenceDensity} from './tank-seawater.mjs';
export async function instantiateTankKernels(bytes){
 const {instance}=await WebAssembly.instantiate(bytes,{math:{cos:Math.cos,sin:Math.sin}}),e=instance.exports;let cursor=e.__heap_base.value;
 e.initialize();
 const array=n=>{const offset=cursor;cursor+=n*8;if(cursor>e.memory.buffer.byteLength)throw new Error('3D kernel memory limit exceeded');const a=new Float64Array(e.memory.buffer,offset,n);a.fill(0);return a;};
 const densityTable=array(401);for(let i=0;i<=400;i++)densityTable[i]=seawaterDensity(i/10);
 const start=cursor;
 return {array,reset(){cursor=start;},momentum(t,dt){const c=t.velocity;e.momentum(t.u.byteOffset,t.v.byteOffset,t.w.byteOffset,c[0].next.byteOffset,c[1].next.byteOffset,c[2].next.byteOffset,...t.departure.map(a=>a.byteOffset),t.reverse.byteOffset,t.nx,t.ny,t.nz,t.dx,t.dy,t.dz,dt,t.viscosity,Number(t.walls==='no-slip'));},buoyancy(t,dt){e.buoyancy(t.salinity.byteOffset,t.rho.byteOffset,t.means.byteOffset,t.v.byteOffset,t.planeBases.byteOffset,densityTable.byteOffset,t.nx,t.ny,t.nz,dt,referenceDensity);},kickPressure(t,dt){e.pressureKick(t.u.byteOffset,t.v.byteOffset,t.w.byteOffset,t.pressureEstimate.byteOffset,t.nx,t.ny,t.nz,t.dx,t.dy,t.dz,dt);},scalar(t,q,dt){e.scalar(q.byteOffset,t.scalarStage.byteOffset,t.scalarResult.byteOffset,...t.slopes.map(a=>a.byteOffset),t.u.byteOffset,t.v.byteOffset,t.w.byteOffset,t.nx,t.ny,t.nz,t.dx,t.dy,t.dz,dt,t.diffusivity);},pressure(nx,ny,nz,dx,dy,dz){const n=nx*ny*nz,a=array(n),b=array(n),inv=array(n);for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(i||j||k)inv[(k*ny+j)*nx+i]=1/(4*Math.sin(Math.PI*i/(2*nx))**2/dx**2+4*Math.sin(Math.PI*j/(2*ny))**2/dy**2+4*Math.sin(Math.PI*k/(2*nz))**2/dz**2);return(rhs,phi)=>e.poisson(rhs.byteOffset,phi.byteOffset,a.byteOffset,b.byteOffset,inv.byteOffset,nx,ny,nz);}};
}
