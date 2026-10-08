import {createSpectralPressure3D,powerOfTwo} from './tank-pressure.mjs';
import {seawaterDensity,referenceDensity} from './tank-seawater.mjs';
import {tankVorticity} from './tank-vorticity.mjs';
const valid=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
const slope=(a,b,forward)=>a*b<=0?0:Math.sign(a)*Math.min(2*Math.abs(a),Math.abs(forward?(a+2*b)/3:(2*a+b)/3),2*Math.abs(b));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createDyeTank3D(options={}){return new Tank3D(options);}
class Tank3D{
 constructor({nx=64,ny=32,nz=32,width=.24,height=.18,depth=.18,waterSalinity=30,layers=null,transition=.008,viscosity=1.35e-6,diffusivity=1.5e-9,walls='no-slip',kernels=null}={}){
  if(![nx,ny,nz].every(n=>powerOfTwo(n)&&n>=16&&n<=64))throw new RangeError('3D grid dimensions must be 16, 32 or 64');
  if(![width,height,depth].every(n=>valid(n,.1,.5))||!valid(waterSalinity,0,40)||!valid(transition,0,.04)||!valid(viscosity,0,1e-5)||!valid(diffusivity,0,1e-6)||!['no-slip','free-slip'].includes(walls))throw new RangeError('Invalid 3D tank parameter');
  if(layers){if(!Array.isArray(layers)||layers.length<2||layers.length>4)throw new RangeError('Use two to four layers');let previous=0;for(const l of layers){if(!valid(l.salinity,0,40)||!valid(l.bottom,previous+1e-5,height))throw new RangeError('Layer boundaries must increase');previous=l.bottom;}if(Math.abs(previous-height)>1e-8)throw new RangeError('Layers must fill the tank');}
  Object.assign(this,{nx,ny,nz,width,height,depth,dx:width/nx,dy:height/ny,dz:depth/nz,viscosity,diffusivity,walls,time:0,steps:0});
  this.kernels=kernels;this.acceleration=kernels?'float64-wasm':'float64-js';const array=kernels?kernels.array:n=>new Float64Array(n);
  const n=nx*ny*nz;this.salinity=array(n);this.gold=array(n);this.coral=array(n);this.dye=array(n);this.goldActive=false;this.coralActive=false;
  for(let j=0;j<ny;j++){const y=(j+.5)*this.dy;let s=waterSalinity;if(layers){s=layers[0].salinity;for(let m=1;m<layers.length;m++)s+=(layers[m].salinity-layers[m-1].salinity)*(transition?.5*(1+Math.tanh((y-layers[m-1].bottom)/(transition/2))):Number(y>=layers[m-1].bottom));}for(let k=0;k<nz;k++)for(let i=0;i<nx;i++)this.salinity[(k*ny+j)*nx+i]=s;}
  this.velocity=[0,1,2].map(axis=>{const shape=[nx,ny,nz],offset=[.5,.5,.5];shape[axis]++;offset[axis]=0;return {axis,shape,offset,data:array(shape[0]*shape[1]*shape[2]),next:array(shape[0]*shape[1]*shape[2])};});
  this.u=this.velocity[0].data;this.v=this.velocity[1].data;this.w=this.velocity[2].data;
  this.phi=array(n);this.pressureEstimate=array(n);this.pressureReady=false;this.rhs=array(n);this.rho=array(n);this.means=array(ny);this.planeBases=array(ny);this.scalarStage=array(n);this.scalarResult=array(n);this.slopes=[0,1,2].map(()=>array(n));
  const faces=Math.max(...this.velocity.map(c=>c.data.length));this.reverse=array(faces);this.departure=[0,1,2].map(()=>array(faces));
  this.solvePressure=kernels?kernels.pressure(nx,ny,nz,this.dx,this.dy,this.dz):createSpectralPressure3D(nx,ny,nz,this.dx,this.dy,this.dz);this.initialSaltIntegral=this.integral(this.salinity);this.injectedSaltIntegral=0;this.injectedDyeIntegral=0;
 }
 integral(q){let sum=0;for(const x of q)sum+=x;return sum*this.dx*this.dy*this.dz;}
 drop({x=.12,y=.03,z=.09,radius=.014,salinity=36}={}){
  if(!valid(x,0,this.width)||!valid(y,0,this.height)||!valid(z,0,this.depth)||!valid(radius,.003,.04)||!valid(salinity,0,40))throw new RangeError('Invalid 3D drop');
  const beforeSalt=this.integral(this.salinity),beforeDye=this.integral(this.dye),{nx,ny,nz,dx,dy,dz}=this;
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const r=(((i+.5)*dx-x)**2+((j+.5)*dy-y)**2+((k+.5)*dz-z)**2)/radius**2;if(r>=1)continue;const q=(k*ny+j)*nx+i,a=(1-r)**2,old=this.salinity[q],fresh=salinity<old;this.salinity[q]=old+a*(salinity-old);this.gold[q]=this.gold[q]*(1-a)+(fresh?0:a);this.coral[q]=this.coral[q]*(1-a)+(fresh?a:0);this.dye[q]=this.gold[q]+this.coral[q];if(fresh)this.coralActive=true;else this.goldActive=true;}
  this.injectedSaltIntegral+=this.integral(this.salinity)-beforeSalt;this.injectedDyeIntegral+=this.integral(this.dye)-beforeDye;this.pressureReady=false;
 }
 sample(q,shape,x,y,z){
  const [nx,ny,nz]=shape;x=clamp(x,0,nx-1);y=clamp(y,0,ny-1);z=clamp(z,0,nz-1);const i=Math.min(nx-2,Math.floor(x)),j=Math.min(ny-2,Math.floor(y)),k=Math.min(nz-2,Math.floor(z)),a=x-i,b=y-j,c=z-k,d=(k*ny+j)*nx+i,p=nx*ny;
  return (1-c)*((1-b)*((1-a)*q[d]+a*q[d+1])+b*((1-a)*q[d+nx]+a*q[d+nx+1]))+c*((1-b)*((1-a)*q[d+p]+a*q[d+p+1])+b*((1-a)*q[d+p+nx]+a*q[d+p+nx+1]));
 }
 at(c,x,y,z){return this.sample(c.data,c.shape,x/this.dx-c.offset[0],y/this.dy-c.offset[1],z/this.dz-c.offset[2]);}
 advectVelocity(dt){
  if(this.kernels){this.kernels.momentum(this,dt);this.commitVelocity();return;}
  const spacing=[this.dx,this.dy,this.dz],back=this.reverse,[bx,by,bz]=this.departure;
  for(const c of this.velocity){const [nx,ny,nz]=c.shape,[ox,oy,oz]=c.offset,q=c.data,out=c.next,plane=nx*ny,normal=(i,j,k)=>[i,j,k][c.axis]===0||[i,j,k][c.axis]===c.shape[c.axis]-1;
   for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;if(normal(i,j,k)){out[d]=0;continue;}const x=(i+ox)*this.dx,y=(j+oy)*this.dy,z=(k+oz)*this.dz,u=this.at(this.velocity[0],x,y,z),v=this.at(this.velocity[1],x,y,z),w=this.at(this.velocity[2],x,y,z),mx=x-.5*dt*u,my=y-.5*dt*v,mz=z-.5*dt*w;bx[d]=(x-dt*this.at(this.velocity[0],mx,my,mz))/this.dx-ox;by[d]=(y-dt*this.at(this.velocity[1],mx,my,mz))/this.dy-oy;bz[d]=(z-dt*this.at(this.velocity[2],mx,my,mz))/this.dz-oz;out[d]=this.sample(q,c.shape,bx[d],by[d],bz[d]);}
   for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;if(normal(i,j,k)){back[d]=0;continue;}const x=(i+ox)*this.dx,y=(j+oy)*this.dy,z=(k+oz)*this.dz,mx=x+.5*dt*this.at(this.velocity[0],x,y,z),my=y+.5*dt*this.at(this.velocity[1],x,y,z),mz=z+.5*dt*this.at(this.velocity[2],x,y,z);back[d]=this.sample(out,c.shape,(x+dt*this.at(this.velocity[0],mx,my,mz))/this.dx-ox,(y+dt*this.at(this.velocity[1],mx,my,mz))/this.dy-oy,(z+dt*this.at(this.velocity[2],mx,my,mz))/this.dz-oz);}
   const wall=this.walls==='no-slip'?-1:1;
   for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;if(normal(i,j,k))continue;const a=Math.min(nx-2,Math.floor(clamp(bx[d],0,nx-1))),b=Math.min(ny-2,Math.floor(clamp(by[d],0,ny-1))),e=Math.min(nz-2,Math.floor(clamp(bz[d],0,nz-1))),f=(e*ny+b)*nx+a;let low=Infinity,high=-Infinity;for(const o of[0,1,nx,nx+1,plane,plane+1,plane+nx,plane+nx+1]){low=Math.min(low,q[f+o]);high=Math.max(high,q[f+o]);}const lap=((i?q[d-1]:wall*q[d])-2*q[d]+(i<nx-1?q[d+1]:wall*q[d]))/spacing[0]**2+((j?q[d-nx]:q[d])-2*q[d]+(j<ny-1?q[d+nx]:wall*q[d]))/spacing[1]**2+((k?q[d-plane]:wall*q[d])-2*q[d]+(k<nz-1?q[d+plane]:wall*q[d]))/spacing[2]**2;out[d]=clamp(out[d]+.5*(q[d]-back[d]),low,high)+dt*this.viscosity*lap;}
  }
  this.commitVelocity();
 }
 commitVelocity(){for(const c of this.velocity){const old=c.data;c.data=c.next;c.next=old;}this.u=this.velocity[0].data;this.v=this.velocity[1].data;this.w=this.velocity[2].data;}
 kickPressure(dt){if(this.kernels?.kickPressure){this.kernels.kickPressure(this,dt);return;}const {nx,ny,nz,dx,dy,dz,u,v,w,pressureEstimate:p}=this;
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=1;i<nx;i++){const d=(k*ny+j)*nx+i;u[(k*ny+j)*(nx+1)+i]-=dt*(p[d]-p[d-1])/dx;}
  for(let k=0;k<nz;k++)for(let j=1;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;v[(k*(ny+1)+j)*nx+i]-=dt*(p[d]-p[d-nx])/dy;}
  for(let k=1;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;w[d]-=dt*(p[d]-p[d-nx*ny])/dz;}
 }
 initializePressure(dt){const old=this.velocity.map(c=>c.data.slice());this.advectVelocity(dt/2);this.buoyancy(dt/2);this.project();for(let i=0;i<this.phi.length;i++)this.pressureEstimate[i]=this.phi[i]/(dt/2);this.velocity.forEach((c,a)=>c.data.set(old[a]));this.pressureReady=true;}
 beginMomentum(dt){if(!this.pressureReady)this.initializePressure(dt);this.kickPressure(dt/2);this.buoyancy(dt/2);}
 finishMomentum(dt){this.buoyancy(dt/2);this.kickPressure(dt/2);this.project();for(let i=0;i<this.phi.length;i++)this.pressureEstimate[i]+=this.phi[i]/dt;}
 momentumStep(dt){this.beginMomentum(dt);this.advectVelocity(dt);this.finishMomentum(dt);}
 async momentumStepAsync(dt,accelerator){
  this.beginMomentum(dt);
  if(accelerator&&accelerator!==this.failedAccelerator){
   try{await accelerator.momentum(this,dt);this.commitVelocity();this.acceleration=accelerator.backend;}
   catch(error){this.failedAccelerator=accelerator;this.accelerationFallback=error.message;accelerator.dispose?.();this.advectVelocity(dt);this.acceleration=this.kernels?'float64-wasm':'float64-js';}
  }else this.advectVelocity(dt);
  this.finishMomentum(dt);
 }
 buoyancy(dt){if(this.kernels?.buoyancy){this.kernels.buoyancy(this,dt);return;}const {nx,ny,nz,salinity,rho,means,v,planeBases:base}=this;means.fill(0);for(let j=0;j<ny;j++)base[j]=seawaterDensity(clamp(salinity[j*nx],0,40));for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;rho[d]=seawaterDensity(clamp(salinity[d],0,40));means[j]+=(rho[d]-base[j])/(nx*nz);}for(let j=0;j<ny;j++)means[j]+=base[j];for(let k=0;k<nz;k++)for(let j=1;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;v[(k*(ny+1)+j)*nx+i]+=dt*9.81/referenceDensity*.5*(rho[d]-means[j]+rho[d-nx]-means[j-1]);}}
 divergence(out){const {nx,ny,nz,u,v,w,dx,dy,dz}=this;for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)out[(k*ny+j)*nx+i]=(u[(k*ny+j)*(nx+1)+i+1]-u[(k*ny+j)*(nx+1)+i])/dx+(v[(k*(ny+1)+j+1)*nx+i]-v[(k*(ny+1)+j)*nx+i])/dy+(w[((k+1)*ny+j)*nx+i]-w[(k*ny+j)*nx+i])/dz;}
 project(){
  const {nx,ny,nz,dx,dy,dz,rhs,phi,u,v,w}=this;for(const c of this.velocity){const [a,b,e]=c.shape;for(let k=0;k<e;k++)for(let j=0;j<b;j++)for(let i=0;i<a;i++)if([i,j,k][c.axis]===0||[i,j,k][c.axis]===c.shape[c.axis]-1)c.data[(k*b+j)*a+i]=0;}
  this.divergence(rhs);let mean=0;for(const r of rhs)mean+=r/rhs.length;for(let i=0;i<rhs.length;i++)rhs[i]=-rhs[i]+mean;this.solvePressure(rhs,phi);
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)u[(k*ny+j)*(nx+1)+i]-=(phi[(k*ny+j)*nx+i]-phi[(k*ny+j)*nx+i-1])/dx;
  for(let k=0;k<nz;k++)for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[(k*(ny+1)+j)*nx+i]-=(phi[(k*ny+j)*nx+i]-phi[(k*ny+j-1)*nx+i])/dy;
  for(let k=1;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)w[(k*ny+j)*nx+i]-=(phi[(k*ny+j)*nx+i]-phi[((k-1)*ny+j)*nx+i])/dz;
  this.divergence(rhs);let norm=0;for(const r of rhs)norm+=r*r;this.projectionResidual=Math.sqrt(norm/rhs.length);if(!Number.isFinite(this.projectionResidual)||this.projectionResidual>1e-6)throw new Error('3D pressure did not converge');
 }
 scalarEuler(q,out,dt){
  const {nx,ny,nz,u,v,w,dx,dy,dz,diffusivity:kap}=this,[sx,sy,sz]=this.slopes,p=nx*ny;
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;sx[d]=i===0||i===nx-1?0:slope(q[d]-q[d-1],q[d+1]-q[d],u[(k*ny+j)*(nx+1)+i]+u[(k*ny+j)*(nx+1)+i+1]>=0);sy[d]=j===0||j===ny-1?0:slope(q[d]-q[d-nx],q[d+nx]-q[d],v[(k*(ny+1)+j)*nx+i]+v[(k*(ny+1)+j+1)*nx+i]>=0);sz[d]=k===0||k===nz-1?0:slope(q[d]-q[d-p],q[d+p]-q[d],w[d]+w[d+p]>=0);}
  out.set(q);
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=1;i<nx;i++){const b=(k*ny+j)*nx+i,a=b-1,speed=u[(k*ny+j)*(nx+1)+i],value=speed>=0?q[a]+.5*sx[a]:q[b]-.5*sx[b],transfer=dt/dx*(speed*value-kap*(q[b]-q[a])/dx);out[a]-=transfer;out[b]+=transfer;}
  for(let k=0;k<nz;k++)for(let j=1;j<ny;j++)for(let i=0;i<nx;i++){const b=(k*ny+j)*nx+i,a=b-nx,speed=v[(k*(ny+1)+j)*nx+i],value=speed>=0?q[a]+.5*sy[a]:q[b]-.5*sy[b],transfer=dt/dy*(speed*value-kap*(q[b]-q[a])/dy);out[a]-=transfer;out[b]+=transfer;}
  for(let k=1;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const b=(k*ny+j)*nx+i,a=b-p,speed=w[b],value=speed>=0?q[a]+.5*sz[a]:q[b]-.5*sz[b],transfer=dt/dz*(speed*value-kap*(q[b]-q[a])/dz);out[a]-=transfer;out[b]+=transfer;}
 }
 advectScalar(q,dt){if(this.kernels){this.kernels.scalar(this,q,dt);return;}this.scalarEuler(q,this.scalarStage,dt);this.scalarEuler(this.scalarStage,this.scalarResult,dt);for(let i=0;i<q.length;i++)this.scalarStage[i]=.75*q[i]+.25*this.scalarResult[i];this.scalarEuler(this.scalarStage,this.scalarResult,dt);for(let i=0;i<q.length;i++)q[i]=q[i]/3+2*this.scalarResult[i]/3;}
 substepLimit(remaining){let umax=0,vmax=0,wmax=0,smin=40,smax=0;for(const a of this.u)umax=Math.max(umax,Math.abs(a));for(const a of this.v)vmax=Math.max(vmax,Math.abs(a));for(const a of this.w)wmax=Math.max(wmax,Math.abs(a));for(const a of this.salinity){smin=Math.min(smin,a);smax=Math.max(smax,a);}const rate=umax/this.dx+vmax/this.dy+wmax/this.dz,h=Math.min(this.dx,this.dy,this.dz),acc=9.81/referenceDensity*(seawaterDensity(clamp(smax,0,40))-seawaterDensity(clamp(smin,0,40))),sub=Math.min(remaining,.25/Math.max(rate,1e-12),.25*Math.sqrt(h/Math.max(acc,1e-12)),.12*h*h/Math.max(this.viscosity,this.diffusivity,1e-12));if(!Number.isFinite(sub)||sub<1e-6)throw new Error('Flow exceeds the 3D grid; reset the tank');return sub;}
 finishSubstep(dt){this.advectScalar(this.salinity,dt);if(this.goldActive)this.advectScalar(this.gold,dt);if(this.coralActive)this.advectScalar(this.coral,dt);for(let i=0;i<this.dye.length;i++)this.dye[i]=this.gold[i]+this.coral[i];this.time+=dt;this.steps++;}
 step(dt=.01){if(!valid(dt,1e-5,.02))throw new RangeError('Invalid 3D timestep');let remaining=dt;while(remaining>1e-10){const sub=this.substepLimit(remaining);this.momentumStep(sub);this.finishSubstep(sub);remaining-=sub;}}
 async stepAsync(dt=.01,accelerator=null){if(!valid(dt,1e-5,.02))throw new RangeError('Invalid 3D timestep');let remaining=dt;while(remaining>1e-10){const sub=this.substepLimit(remaining);await this.momentumStepAsync(sub,accelerator);this.finishSubstep(sub);remaining-=sub;}}
 diagnostics(){
  const {nx,ny,nz,dx,dy,dz,u,v,w,salinity,dye}=this;let speed=0,maxW=0,smin=40,smax=0,weight=0,cx=0,cy=0,cz=0,dmin=Infinity,dmax=0;
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i,a=.5*(u[(k*ny+j)*(nx+1)+i]+u[(k*ny+j)*(nx+1)+i+1]),b=.5*(v[(k*(ny+1)+j)*nx+i]+v[(k*(ny+1)+j+1)*nx+i]),c=.5*(w[d]+w[d+nx*ny]);speed=Math.max(speed,Math.hypot(a,b,c));maxW=Math.max(maxW,Math.abs(c));smin=Math.min(smin,salinity[d]);smax=Math.max(smax,salinity[d]);dmin=Math.min(dmin,dye[d]);dmax=Math.max(dmax,dye[d]);weight+=dye[d];cx+=(i+.5)*dx*dye[d];cy+=(j+.5)*dy*dye[d];cz+=(k+.5)*dz*dye[d];}
  return {model:'salinity-dye-tank-3d-v5',dimensions:3,acceleration:this.acceleration,accelerationFallback:this.accelerationFallback||null,grid:[nx,ny,nz],time:this.time,steps:this.steps,saltIntegral:this.integral(salinity),dyeIntegral:this.integral(dye),dyeCentroid:{x:weight?cx/weight:this.width/2,y:weight?cy/weight:this.height/2,z:weight?cz/weight:this.depth/2},maxSpeed:speed,maxW,divergenceRms:this.projectionResidual||0,salinityMin:smin,salinityMax:smax,dyeMin:dmin,dyeMax:dmax};
 }
 snapshot({includeVorticity=false}={}){const n=this.salinity.length,volume=new Float32Array(n*4),{nx,ny,nz,u,v,w,dx,dy,dz}=this;for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i;volume[4*d]=this.gold[d];volume[4*d+1]=this.coral[d];volume[4*d+2]=this.salinity[d]/40;const speed=Math.hypot(.5*(u[(k*ny+j)*(nx+1)+i]+u[(k*ny+j)*(nx+1)+i+1]),.5*(v[(k*(ny+1)+j)*nx+i]+v[(k*(ny+1)+j+1)*nx+i]),.5*(w[d]+w[d+nx*ny]));volume[4*d+3]=speed;}const diagnostics=this.diagnostics(),curl=includeVorticity?tankVorticity(this):null;if(curl){diagnostics.vorticityMax=curl.max;diagnostics.vorticityRms=curl.rms;}return {nx,ny,nz,width:this.width,height:this.height,depth:this.depth,volume,...(curl?{vorticity:Float32Array.from(curl.values)}:{}),diagnostics};}
}
