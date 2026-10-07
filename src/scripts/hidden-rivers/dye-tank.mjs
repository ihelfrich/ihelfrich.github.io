// 2D Boussinesq tank. SI geometry/velocity/time; salinity in g/kg.
// Coordinate y points down. Dye and salinity use conservative face fluxes.
const beta=.00076, gravity=9.81;
const minmod=(a,b)=>a*b<=0?0:Math.sign(a)*Math.min(Math.abs(a),Math.abs(b));
const finiteRange=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
export function createDyeTank(options={}){return new DyeTank(options);}
class DyeTank {
  constructor({nx=128,ny=96,width=.24,height=.18,waterSalinity=30,bottomSalinity=waterSalinity,viscosity=1e-6,diffusivity=2e-7}={}){
    if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<16||ny<16||nx>192||ny>144)throw new RangeError('Invalid grid');
    if(!finiteRange(width,.1,.5)||!finiteRange(height,.1,.5))throw new RangeError('Invalid tank dimensions');
    if(!finiteRange(waterSalinity,0,40)||!finiteRange(bottomSalinity,0,40))throw new RangeError('Invalid salinity');
    if(!finiteRange(viscosity,0,1e-5)||!finiteRange(diffusivity,0,1e-6))throw new RangeError('Invalid transport parameter');
    Object.assign(this,{nx,ny,width,height,viscosity,diffusivity,dx:width/nx,dy:height/ny,time:0,steps:0,projectionResidual:0});
    const n=nx*ny;this.salinity=new Float64Array(n);this.dye=new Float64Array(n);this.coral=new Float64Array(n);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)this.salinity[j*nx+i]=waterSalinity+(bottomSalinity-waterSalinity)*(j+.5)/ny;
    this.u=new Float64Array((nx+1)*ny);this.v=new Float64Array(nx*(ny+1));
    this.nextU=this.u.slice();this.nextV=this.v.slice();this.scalarStage=new Float64Array(n);this.scalarResult=new Float64Array(n);
    this.phi=new Float64Array(n);this.r=new Float64Array(n);this.z=new Float64Array(n);this.p=new Float64Array(n);this.ap=new Float64Array(n);
    this.diagonal=new Float64Array(n);this.slopeX=new Float64Array(n);this.slopeY=new Float64Array(n);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)this.diagonal[j*nx+i]=(Number(i>0)+Number(i<nx-1))/(this.dx*this.dx)+(Number(j>0)+Number(j<ny-1))/(this.dy*this.dy);
    this.initialSaltIntegral=this.integral(this.salinity);this.injectedSaltIntegral=0;this.injectedDyeIntegral=0;
  }
  integral(q){let sum=0,c=0;for(const x of q){const y=x-c,t=sum+y;c=(t-sum)-y;sum=t;}return sum*this.dx*this.dy;}
  drop({x,y,salinity,radius=.007}={}){
    if(!finiteRange(x,0,this.width)||!finiteRange(y,0,this.height)||!finiteRange(salinity,0,40)||!finiteRange(radius,.002,.025))throw new RangeError('Invalid drop');
    const beforeSalt=this.integral(this.salinity),beforeDye=this.integral(this.dye),{nx,ny,dx,dy}=this;
    for(let j=Math.max(0,Math.floor((y-radius)/dy));j<Math.min(ny,Math.ceil((y+radius)/dy));j++)for(let i=Math.max(0,Math.floor((x-radius)/dx));i<Math.min(nx,Math.ceil((x+radius)/dx));i++){
      const k=j*nx+i,r2=(((i+.5)*dx-x)**2+((j+.5)*dy-y)**2)/(radius*radius);if(r2>=1)continue;
      const a=(1-r2)**2,old=this.salinity[k];this.salinity[k]=old+a*(salinity-old);
      // Gold marks denser additions, coral marks fresher additions. Pigment is passive.
      this.coral[k]=this.coral[k]*(1-a)+(salinity<old?a:0);this.dye[k]=this.dye[k]*(1-a)+a;
    }
    this.injectedSaltIntegral+=this.integral(this.salinity)-beforeSalt;this.injectedDyeIntegral+=this.integral(this.dye)-beforeDye;
  }
  sample(q,w,h,x,y){
    x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const i=Math.min(w-2,Math.floor(x)),j=Math.min(h-2,Math.floor(y)),a=x-i,b=y-j,k=j*w+i;
    return (1-b)*((1-a)*q[k]+a*q[k+1])+b*((1-a)*q[k+w]+a*q[k+w+1]);
  }
  velocity(x,y){return [this.sample(this.u,this.nx+1,this.ny,x/this.dx,y/this.dy-.5),this.sample(this.v,this.nx,this.ny+1,x/this.dx-.5,y/this.dy)];}
  advectVelocity(dt){
    const {nx,ny,dx,dy,u,v,nextU,nextV}=this;
    const advect=(q,out,w,h,ox,oy)=>{
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        const k=j*w+i;if((ox===0&&(i===0||i===nx))||(oy===0&&(j===0||j===ny))){out[k]=0;continue;}
        const x=(i+ox)*dx,y=(j+oy)*dy,[vx,vy]=this.velocity(x,y),[mx,my]=this.velocity(x-.5*dt*vx,y-.5*dt*vy);
        const adv=this.sample(q,w,h,(x-dt*mx)/dx-ox,(y-dt*my)/dy-oy);
        const lap=((i>0?q[k-1]:q[k])-2*q[k]+(i<w-1?q[k+1]:q[k]))/(dx*dx)+((j>0?q[k-w]:q[k])-2*q[k]+(j<h-1?q[k+w]:q[k]))/(dy*dy);
        out[k]=adv+dt*this.viscosity*lap;
      }
    };
    advect(u,nextU,nx+1,ny,0,.5);advect(v,nextV,nx,ny+1,.5,0);this.u=nextU;this.v=nextV;this.nextU=u;this.nextV=v;
  }
  buoyancy(dt){
    const {nx,ny,dx,dy,salinity,v}=this;const means=new Float64Array(ny);
    for(let j=0;j<ny;j++){let s=0;for(let i=0;i<nx;i++)s+=salinity[j*nx+i];means[j]=s/nx;}
    // Subtract the horizontal mean: its vertical force is balanced by hydrostatic pressure.
    for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[j*nx+i]+=dt*gravity*beta*.5*(salinity[(j-1)*nx+i]-means[j-1]+salinity[j*nx+i]-means[j]);
  }
  matrix(q,out){
    const {nx,ny,dx,dy}=this,ax=1/(dx*dx),ay=1/(dy*dy);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i,c=q[k];let s=0;if(i>0)s+=ax*(c-q[k-1]);if(i<nx-1)s+=ax*(c-q[k+1]);if(j>0)s+=ay*(c-q[k-nx]);if(j<ny-1)s+=ay*(c-q[k+nx]);out[k]=s;}
  }
  project(){
    const {nx,ny,dx,dy,u,v,phi,r,z,p,ap,diagonal}=this,n=nx*ny;phi.fill(0);let sum=0;
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;r[k]=-((u[j*(nx+1)+i+1]-u[j*(nx+1)+i])/dx+(v[(j+1)*nx+i]-v[j*nx+i])/dy);sum+=r[k];}
    const mean=sum/n;let rz=0,norm=0;for(let k=0;k<n;k++){r[k]-=mean;z[k]=r[k]/diagonal[k];p[k]=z[k];rz+=r[k]*z[k];norm+=r[k]*r[k];}
    let iterations=0;
    while(norm/n>1e-16&&iterations<400){
      this.matrix(p,ap);let pap=0;for(let k=0;k<n;k++)pap+=p[k]*ap[k];if(!(pap>0))throw new Error('Pressure solve failed');
      const alpha=rz/pap;let nextRz=0;norm=0;
      for(let k=0;k<n;k++){phi[k]+=alpha*p[k];r[k]-=alpha*ap[k];z[k]=r[k]/diagonal[k];nextRz+=r[k]*z[k];norm+=r[k]*r[k];}
      const factor=nextRz/rz;for(let k=0;k<n;k++)p[k]=z[k]+factor*p[k];rz=nextRz;iterations++;
    }
    this.projectionResidual=Math.sqrt(norm/n);if(this.projectionResidual>1e-6)throw new Error('Pressure did not converge');
    for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)u[j*(nx+1)+i]-=(phi[j*nx+i]-phi[j*nx+i-1])/dx;
    for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[j*nx+i]-=(phi[j*nx+i]-phi[(j-1)*nx+i])/dy;
  }
  scalarEuler(q,out,dt){
    const {nx,ny,dx,dy,u,v,slopeX:sx,slopeY:sy,diffusivity:kappa}=this;
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;sx[k]=i===0||i===nx-1?0:minmod(q[k]-q[k-1],q[k+1]-q[k]);sy[k]=j===0||j===ny-1?0:minmod(q[k]-q[k-nx],q[k+nx]-q[k]);}
    out.set(q);
    // Each interior face is applied once, with equal and opposite transfers.
    for(let j=0;j<ny;j++)for(let i=1;i<nx;i++){
      const right=j*nx+i,left=right-1,a=u[j*(nx+1)+i],value=a>=0?q[left]+.5*sx[left]:q[right]-.5*sx[right];
      const transfer=dt/dx*(a*value-kappa*(q[right]-q[left])/dx);out[left]-=transfer;out[right]+=transfer;
    }
    for(let j=1;j<ny;j++)for(let i=0;i<nx;i++){
      const below=j*nx+i,above=below-nx,a=v[j*nx+i],value=a>=0?q[above]+.5*sy[above]:q[below]-.5*sy[below];
      const transfer=dt/dy*(a*value-kappa*(q[below]-q[above])/dy);out[above]-=transfer;out[below]+=transfer;
    }
  }
  advectScalar(q,dt){this.scalarEuler(q,this.scalarStage,dt);this.scalarEuler(this.scalarStage,this.scalarResult,dt);for(let k=0;k<q.length;k++)q[k]=.5*(q[k]+this.scalarResult[k]);}
  step(dt=.01){
    if(!finiteRange(dt,1e-5,.02))throw new RangeError('Invalid timestep');let remaining=dt;
    while(remaining>1e-10){
      let umax=0,vmax=0,smin=40,smax=0;for(const a of this.u)umax=Math.max(umax,Math.abs(a));for(const a of this.v)vmax=Math.max(vmax,Math.abs(a));for(const a of this.salinity){smin=Math.min(smin,a);smax=Math.max(smax,a);}
      const rate=umax/this.dx+vmax/this.dy,acc=gravity*beta*(smax-smin),h=Math.min(this.dx,this.dy);
      const sub=Math.min(remaining,.3/Math.max(rate,1e-12),.25*Math.sqrt(h/Math.max(acc,1e-12)),.15*h*h/Math.max(this.viscosity,this.diffusivity,1e-12));
      if(!Number.isFinite(sub)||sub<1e-6)throw new Error('Flow exceeds this grid; reset the tank');
      this.advectVelocity(sub);this.buoyancy(sub);this.project();this.advectScalar(this.salinity,sub);this.advectScalar(this.dye,sub);this.advectScalar(this.coral,sub);
      this.time+=sub;this.steps++;remaining-=sub;
    }
  }
  diagnostics(){
    const {nx,ny,dx,dy,u,v,dye,salinity}=this;let div2=0,maxSpeed=0,omegaMin=0,omegaMax=0,smin=Infinity,smax=-Infinity,dmax=0,weight=0,cx=0,cy=0;
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const k=j*nx+i,a=.5*(u[j*(nx+1)+i]+u[j*(nx+1)+i+1]),b=.5*(v[j*nx+i]+v[(j+1)*nx+i]);maxSpeed=Math.max(maxSpeed,Math.hypot(a,b));
      const d=(u[j*(nx+1)+i+1]-u[j*(nx+1)+i])/dx+(v[(j+1)*nx+i]-v[j*nx+i])/dy;div2+=d*d;
      const il=Math.max(0,i-1),ir=Math.min(nx-1,i+1),jt=Math.max(0,j-1),jb=Math.min(ny-1,j+1);
      const dvdx=(v[j*nx+ir]+v[(j+1)*nx+ir]-v[j*nx+il]-v[(j+1)*nx+il])/(2*Math.max(1,ir-il)*dx);
      const dudy=(u[jb*(nx+1)+i]+u[jb*(nx+1)+i+1]-u[jt*(nx+1)+i]-u[jt*(nx+1)+i+1])/(2*Math.max(1,jb-jt)*dy);
      const omega=dvdx-dudy;omegaMin=Math.min(omegaMin,omega);omegaMax=Math.max(omegaMax,omega);
      smin=Math.min(smin,salinity[k]);smax=Math.max(smax,salinity[k]);dmax=Math.max(dmax,dye[k]);weight+=dye[k];cx+=(i+.5)*dx*dye[k];cy+=(j+.5)*dy*dye[k];
    }
    return {time:this.time,steps:this.steps,saltIntegral:this.integral(salinity),dyeIntegral:this.integral(dye),dyeCentroid:{x:weight?cx/weight:this.width/2,y:weight?cy/weight:this.height/2},salinityMin:smin,salinityMax:smax,dyeMax:dmax,maxSpeed,divergenceRms:Math.sqrt(div2/(nx*ny)),vorticityMin:omegaMin,vorticityMax:omegaMax};
  }
  snapshot(){return {nx:this.nx,ny:this.ny,width:this.width,height:this.height,salinity:Float32Array.from(this.salinity),dye:Float32Array.from(this.dye),coral:Float32Array.from(this.coral),u:Float32Array.from(this.u),v:Float32Array.from(this.v),diagnostics:this.diagnostics()};}
}
