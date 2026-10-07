import {createDyeTank} from '../../src/scripts/hidden-rivers/dye-tank.mjs';
const energy=tank=>{
 let e=0;for(let j=0;j<tank.ny;j++)for(let i=0;i<tank.nx;i++){
  const u=.5*(tank.u[j*(tank.nx+1)+i]+tank.u[j*(tank.nx+1)+i+1]),v=.5*(tank.v[j*tank.nx+i]+tank.v[(j+1)*tank.nx+i]);e+=.5*(u*u+v*v);
 }return e*tank.dx*tank.dy;
};
export function vortexDecay(nx=64,dt=.01){
 const tank=createDyeTank({nx,ny:nx,height:.24,walls:'free-slip'}),k=Math.PI/.24,U=.04;
 for(let j=0;j<nx;j++)for(let i=1;i<nx;i++)tank.u[j*(nx+1)+i]=U*Math.sin(k*i*tank.dx)*Math.cos(k*(j+.5)*tank.dy);
 for(let j=1;j<nx;j++)for(let i=0;i<nx;i++)tank.v[j*nx+i]=-U*Math.cos(k*(i+.5)*tank.dx)*Math.sin(k*j*tank.dy);
 const expected=energy(tank)*Math.exp(-4*tank.viscosity*k*k);
 for(let n=0;n<Math.round(1/dt);n++)tank.step(dt);
 return {grid:[nx,nx],dtS:dt,relativeEnergyError:Math.abs(energy(tank)/expected-1),divergenceRms:tank.diagnostics().divergenceRms};
}
export function tracerTranslation(nx=64){
 const tank=createDyeTank({nx,ny:nx,height:.24,diffusivity:0}),pulse=(x,y)=>Math.exp(-((x-.08)**2+(y-.12)**2)/.01**2);
 for(let j=0;j<nx;j++)for(let i=1;i<nx;i++)tank.u[j*(nx+1)+i]=.02;
 for(let j=0;j<nx;j++)for(let i=0;i<nx;i++)tank.dye[j*nx+i]=pulse((i+.5)*tank.dx,(j+.5)*tank.dy);
 const mass=tank.integral(tank.dye);for(let n=0;n<100;n++)tank.advectScalar(tank.dye,.01);
 let error=0,total=0;for(let j=0;j<nx;j++)for(let i=0;i<nx;i++){const expected=pulse((i+.5)*tank.dx-.02,(j+.5)*tank.dy);error+=Math.abs(tank.dye[j*nx+i]-expected);total+=expected;}
 return {grid:[nx,nx],timeS:1,relativeL1Error:error/total,massResidual:tank.integral(tank.dye)-mass,min:Math.min(...tank.dye),max:Math.max(...tank.dye)};
}
