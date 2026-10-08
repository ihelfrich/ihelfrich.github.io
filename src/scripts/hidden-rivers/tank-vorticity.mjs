// A read-only curl of the resolved MAC snapshot, in inverse seconds.
const workspaces=new WeakMap();
export function tankVorticity(t,output=null){
 const {nx,ny,nz,dx,dy,dz,u,v,w}=t,n=nx*ny*nz;
 if(![nx,ny,nz].every(x=>Number.isInteger(x)&&x>=3&&x<=64)||![dx,dy,dz].every(x=>Number.isFinite(x)&&x>0)||!u||!v||!w||u.length!==(nx+1)*ny*nz||v.length!==nx*(ny+1)*nz||w.length!==nx*ny*(nz+1))throw new RangeError('Invalid vorticity grid');
 if(output&&(!(output instanceof Float64Array)||output.length!==4*n))throw new RangeError('Invalid vorticity output');
 for(const field of [u,v,w])for(const value of field)if(!Number.isFinite(value))throw new RangeError('Nonfinite vorticity velocity');
 let workspace=workspaces.get(t);if(!workspace||workspace.n!==n){workspace={n,centres:[0,1,2].map(()=>new Float64Array(n)),values:new Float64Array(4*n)};workspaces.set(t,workspace);}
 const [a,b,c]=workspace.centres,p=nx*ny;
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const d=(k*ny+j)*nx+i,uf=(k*ny+j)*(nx+1)+i,vf=(k*(ny+1)+j)*nx+i;a[d]=.5*(u[uf]+u[uf+1]);b[d]=.5*(v[vf]+v[vf+nx]);c[d]=.5*(w[d]+w[d+p]);}
 const derivative=(q,d,index,count,stride,h)=>index===0?(-3*q[d]+4*q[d+stride]-q[d+2*stride])/(2*h):index===count-1?(3*q[d]-4*q[d-stride]+q[d-2*stride])/(2*h):(q[d+stride]-q[d-stride])/(2*h);
 const values=workspace.values;let max=0,sum=0,maxSignedZ=0;
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const d=(k*ny+j)*nx+i,x=derivative(c,d,j,ny,nx,dy)-derivative(b,d,k,nz,p,dz),y=derivative(a,d,k,nz,p,dz)-derivative(c,d,i,nx,1,dx),z=derivative(b,d,i,nx,1,dx)-derivative(a,d,j,ny,nx,dy),m=Math.hypot(x,y,z);
  if(!Number.isFinite(m))throw new RangeError('Vorticity diagnostic overflow');
  values[4*d]=x;values[4*d+1]=y;values[4*d+2]=z;values[4*d+3]=m;max=Math.max(max,m);maxSignedZ=Math.max(maxSignedZ,Math.abs(z));sum+=m*m;
 }
 if(output)output.set(values);
 return {values:output||values,max,maxSignedZ,rms:Math.sqrt(sum/n),units:'s^-1'};
}
