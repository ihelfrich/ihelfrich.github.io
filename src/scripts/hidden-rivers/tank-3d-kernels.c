/* Float64 kernels. The JS reference owns contracts, controls and conservation ledgers.
   No fast-math/reassociation: compiled against IEEE-754 WebAssembly f64. */
typedef unsigned long size_t;
void *memcpy(void *d,const void *s,size_t n){unsigned char *a=d;const unsigned char *b=s;for(size_t i=0;i<n;i++)a[i]=b[i];return d;}
void *memset(void *d,int c,size_t n){unsigned char *a=d;for(size_t i=0;i<n;i++)a[i]=c;return d;}
__attribute__((import_module("math"),import_name("cos"))) extern double cos(double);
__attribute__((import_module("math"),import_name("sin"))) extern double sin(double);
static inline double mn(double a,double b){return a<b?a:b;}
static inline double mx(double a,double b){return a>b?a:b;}
static inline double clip(double a,double lo,double hi){return mx(lo,mn(hi,a));}
typedef struct {double *q;int nx,ny,nz;double ox,oy,oz;} Field;
typedef struct {double x,y,z;} Point;
static inline double sample(Field f,double x,double y,double z){
 x=clip(x,0,f.nx-1);y=clip(y,0,f.ny-1);z=clip(z,0,f.nz-1);
 int i=mn(f.nx-2,(int)x),j=mn(f.ny-2,(int)y),k=mn(f.nz-2,(int)z),d=(k*f.ny+j)*f.nx+i,p=f.nx*f.ny;double a=x-i,b=y-j,c=z-k,*q=f.q;
 return (1-c)*((1-b)*((1-a)*q[d]+a*q[d+1])+b*((1-a)*q[d+f.nx]+a*q[d+f.nx+1]))+c*((1-b)*((1-a)*q[d+p]+a*q[d+p+1])+b*((1-a)*q[d+p+f.nx]+a*q[d+p+f.nx+1]));
}
static inline double at(Field f,Point p,double dx,double dy,double dz){return sample(f,p.x/dx-f.ox,p.y/dy-f.oy,p.z/dz-f.oz);}
static inline Point trace(Point p,Field *v,double dt,double dx,double dy,double dz){
 Point m={p.x-.5*dt*at(v[0],p,dx,dy,dz),p.y-.5*dt*at(v[1],p,dx,dy,dz),p.z-.5*dt*at(v[2],p,dx,dy,dz)};
 return (Point){p.x-dt*at(v[0],m,dx,dy,dz),p.y-dt*at(v[1],m,dx,dy,dz),p.z-dt*at(v[2],m,dx,dy,dz)};
}
void momentum(double *u,double *v,double *w,double *outU,double *outV,double *outW,double *bx,double *by,double *bz,double *back,int nx,int ny,int nz,double dx,double dy,double dz,double dt,double nu,int noSlip){
 Field old[3]={{u,nx+1,ny,nz,0,.5,.5},{v,nx,ny+1,nz,.5,0,.5},{w,nx,ny,nz+1,.5,.5,0}};double *outs[3]={outU,outV,outW};
 for(int axis=0;axis<3;axis++){Field f=old[axis],fout=f;double *q=f.q,*out=outs[axis];fout.q=out;int p=f.nx*f.ny,wall=noSlip?-1:1;
  for(int k=0;k<f.nz;k++)for(int j=0;j<f.ny;j++)for(int i=0;i<f.nx;i++){
   int d=(k*f.ny+j)*f.nx+i,n=axis==0?i:axis==1?j:k,last=axis==0?f.nx-1:axis==1?f.ny-1:f.nz-1;if(n==0||n==last){out[d]=0;continue;}
   Point pos={(i+f.ox)*dx,(j+f.oy)*dy,(k+f.oz)*dz},b=trace(pos,old,dt,dx,dy,dz);bx[d]=b.x/dx-f.ox;by[d]=b.y/dy-f.oy;bz[d]=b.z/dz-f.oz;out[d]=sample(f,bx[d],by[d],bz[d]);
  }
  for(int k=0;k<f.nz;k++)for(int j=0;j<f.ny;j++)for(int i=0;i<f.nx;i++){
   int d=(k*f.ny+j)*f.nx+i,n=axis==0?i:axis==1?j:k,last=axis==0?f.nx-1:axis==1?f.ny-1:f.nz-1;if(n==0||n==last){back[d]=0;continue;}
   Point pos={(i+f.ox)*dx,(j+f.oy)*dy,(k+f.oz)*dz},b=trace(pos,old,-dt,dx,dy,dz);back[d]=sample(fout,b.x/dx-f.ox,b.y/dy-f.oy,b.z/dz-f.oz);
  }
  for(int k=0;k<f.nz;k++)for(int j=0;j<f.ny;j++)for(int i=0;i<f.nx;i++){
   int d=(k*f.ny+j)*f.nx+i,n=axis==0?i:axis==1?j:k,last=axis==0?f.nx-1:axis==1?f.ny-1:f.nz-1;if(n==0||n==last)continue;
   int a=mn(f.nx-2,(int)clip(bx[d],0,f.nx-1)),b=mn(f.ny-2,(int)clip(by[d],0,f.ny-1)),c=mn(f.nz-2,(int)clip(bz[d],0,f.nz-1)),d0=(c*f.ny+b)*f.nx+a;int offsets[8]={0,1,f.nx,f.nx+1,p,p+1,p+f.nx,p+f.nx+1};double lo=q[d0],hi=q[d0];for(int n=1;n<8;n++){lo=mn(lo,q[d0+offsets[n]]);hi=mx(hi,q[d0+offsets[n]]);}
   double lap=((i?q[d-1]:wall*q[d])-2*q[d]+(i<f.nx-1?q[d+1]:wall*q[d]))/(dx*dx)+((j?q[d-f.nx]:q[d])-2*q[d]+(j<f.ny-1?q[d+f.nx]:wall*q[d]))/(dy*dy)+((k?q[d-p]:wall*q[d])-2*q[d]+(k<f.nz-1?q[d+p]:wall*q[d]))/(dz*dz);
   out[d]=clip(out[d]+.5*(q[d]-back[d]),lo,hi)+dt*nu*lap;
  }
 }
}
/* Exact loop order and density interpolation of Tank3D.buoyancy. */
static inline double density(double s,const double *table){
 double x=clip(s,0,40)*10;int i=mn(399,(int)x);
 return table[i]+(table[i+1]-table[i])*(x-i);
}
void buoyancy(double *salinity,double *rho,double *means,double *v,double *base,const double *table,int nx,int ny,int nz,double dt,double referenceDensity){
 for(int j=0;j<ny;j++)means[j]=0;
 for(int j=0;j<ny;j++)base[j]=density(salinity[j*nx],table);
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)for(int i=0;i<nx;i++){
  int d=(k*ny+j)*nx+i;rho[d]=density(salinity[d],table);means[j]+=(rho[d]-base[j])/(nx*nz);
 }
 for(int j=0;j<ny;j++)means[j]+=base[j];
 for(int k=0;k<nz;k++)for(int j=1;j<ny;j++)for(int i=0;i<nx;i++){
  int d=(k*ny+j)*nx+i;
  v[(k*(ny+1)+j)*nx+i]+=dt*9.81/referenceDensity*.5*(rho[d]-means[j]+rho[d-nx]-means[j-1]);
 }
}
/* Exact face visitation and arithmetic order of Tank3D.kickPressure. */
void pressureKick(double *u,double *v,double *w,const double *estimate,int nx,int ny,int nz,double dx,double dy,double dz,double dt){
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)for(int i=1;i<nx;i++){
  int d=(k*ny+j)*nx+i;u[(k*ny+j)*(nx+1)+i]-=dt*(estimate[d]-estimate[d-1])/dx;
 }
 for(int k=0;k<nz;k++)for(int j=1;j<ny;j++)for(int i=0;i<nx;i++){
  int d=(k*ny+j)*nx+i;v[(k*(ny+1)+j)*nx+i]-=dt*(estimate[d]-estimate[d-nx])/dy;
 }
 for(int k=1;k<nz;k++)for(int j=0;j<ny;j++)for(int i=0;i<nx;i++){
  int d=(k*ny+j)*nx+i;w[d]-=dt*(estimate[d]-estimate[d-nx*ny])/dz;
 }
}
/* Projection bookkeeping mirrors Tank3D.project; poisson remains a separate spectral solve. */
static void divergence3(const double *u,const double *v,const double *w,double *rhs,int nx,int ny,int nz,double dx,double dy,double dz){
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)for(int i=0;i<nx;i++){
  int d=(k*ny+j)*nx+i;
  rhs[d]=(u[(k*ny+j)*(nx+1)+i+1]-u[(k*ny+j)*(nx+1)+i])/dx+
         (v[(k*(ny+1)+j+1)*nx+i]-v[(k*(ny+1)+j)*nx+i])/dy+
         (w[((k+1)*ny+j)*nx+i]-w[(k*ny+j)*nx+i])/dz;
 }
}
void projectPrepare(double *u,double *v,double *w,double *rhs,int nx,int ny,int nz,double dx,double dy,double dz){
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++){int d=(k*ny+j)*(nx+1);u[d]=u[d+nx]=0;}
 for(int k=0;k<nz;k++)for(int i=0;i<nx;i++){v[k*(ny+1)*nx+i]=v[(k*(ny+1)+ny)*nx+i]=0;}
 for(int j=0;j<ny;j++)for(int i=0;i<nx;i++){w[j*nx+i]=w[(nz*ny+j)*nx+i]=0;}
 divergence3(u,v,w,rhs,nx,ny,nz,dx,dy,dz);
 int n=nx*ny*nz;double mean=0;
 for(int d=0;d<n;d++)mean+=rhs[d]/n;
 for(int d=0;d<n;d++)rhs[d]=-rhs[d]+mean;
}
double projectFinish(double *u,double *v,double *w,const double *phi,double *rhs,int nx,int ny,int nz,double dx,double dy,double dz){
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)for(int i=1;i<nx;i++){
  int d=(k*ny+j)*nx+i;u[(k*ny+j)*(nx+1)+i]-=(phi[d]-phi[d-1])/dx;
 }
 for(int k=0;k<nz;k++)for(int j=1;j<ny;j++)for(int i=0;i<nx;i++){
  int d=(k*ny+j)*nx+i;v[(k*(ny+1)+j)*nx+i]-=(phi[d]-phi[d-nx])/dy;
 }
 for(int k=1;k<nz;k++)for(int j=0;j<ny;j++)for(int i=0;i<nx;i++){
  int d=(k*ny+j)*nx+i;w[(k*ny+j)*nx+i]-=(phi[d]-phi[d-nx*ny])/dz;
 }
 divergence3(u,v,w,rhs,nx,ny,nz,dx,dy,dz);
 int n=nx*ny*nz;double norm=0;
 for(int d=0;d<n;d++)norm+=rhs[d]*rhs[d];
 return __builtin_sqrt(norm/n);
}
int scanExtrema(const double *u,const double *v,const double *w,const double *salinity,double *out,int nx,int ny,int nz){
 double umax=0,vmax=0,wmax=0,smin=40,smax=0;
 int nu=(nx+1)*ny*nz,nv=nx*(ny+1)*nz,nw=nx*ny*(nz+1),n=nx*ny*nz;
 for(int i=0;i<nu;i++){double x=u[i];if(!__builtin_isfinite(x))return 0;umax=mx(umax,__builtin_fabs(x));}
 for(int i=0;i<nv;i++){double x=v[i];if(!__builtin_isfinite(x))return 0;vmax=mx(vmax,__builtin_fabs(x));}
 for(int i=0;i<nw;i++){double x=w[i];if(!__builtin_isfinite(x))return 0;wmax=mx(wmax,__builtin_fabs(x));}
 for(int i=0;i<n;i++){double x=salinity[i];if(!__builtin_isfinite(x))return 0;smin=mn(smin,x);smax=mx(smax,x);}
 out[0]=umax;out[1]=vmax;out[2]=wmax;out[3]=smin;out[4]=smax;
 return 1;
}
static inline double slope(double a,double b,int forward){if(a*b<=0)return 0;double sign=a>0?1:-1;return sign*mn(mn(2*__builtin_fabs(a),__builtin_fabs(forward?(a+2*b)/3:(2*a+b)/3)),2*__builtin_fabs(b));}
static void euler(double *q,double *out,double *sx,double *sy,double *sz,double *u,double *v,double *w,int nx,int ny,int nz,double dx,double dy,double dz,double dt,double kap){
 int p=nx*ny;
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)for(int i=0;i<nx;i++){int d=(k*ny+j)*nx+i;sx[d]=i==0||i==nx-1?0:slope(q[d]-q[d-1],q[d+1]-q[d],u[(k*ny+j)*(nx+1)+i]+u[(k*ny+j)*(nx+1)+i+1]>=0);sy[d]=j==0||j==ny-1?0:slope(q[d]-q[d-nx],q[d+nx]-q[d],v[(k*(ny+1)+j)*nx+i]+v[(k*(ny+1)+j+1)*nx+i]>=0);sz[d]=k==0||k==nz-1?0:slope(q[d]-q[d-p],q[d+p]-q[d],w[d]+w[d+p]>=0);out[d]=q[d];}
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)for(int i=1;i<nx;i++){int b=(k*ny+j)*nx+i,a=b-1;double speed=u[(k*ny+j)*(nx+1)+i],value=speed>=0?q[a]+.5*sx[a]:q[b]-.5*sx[b],transfer=dt/dx*(speed*value-kap*(q[b]-q[a])/dx);out[a]-=transfer;out[b]+=transfer;}
 for(int k=0;k<nz;k++)for(int j=1;j<ny;j++)for(int i=0;i<nx;i++){int b=(k*ny+j)*nx+i,a=b-nx;double speed=v[(k*(ny+1)+j)*nx+i],value=speed>=0?q[a]+.5*sy[a]:q[b]-.5*sy[b],transfer=dt/dy*(speed*value-kap*(q[b]-q[a])/dy);out[a]-=transfer;out[b]+=transfer;}
 for(int k=1;k<nz;k++)for(int j=0;j<ny;j++)for(int i=0;i<nx;i++){int b=(k*ny+j)*nx+i,a=b-p;double speed=w[b],value=speed>=0?q[a]+.5*sz[a]:q[b]-.5*sz[b],transfer=dt/dz*(speed*value-kap*(q[b]-q[a])/dz);out[a]-=transfer;out[b]+=transfer;}
}
void scalar(double *q,double *stage,double *result,double *sx,double *sy,double *sz,double *u,double *v,double *w,int nx,int ny,int nz,double dx,double dy,double dz,double dt,double kap){
 int n=nx*ny*nz;euler(q,stage,sx,sy,sz,u,v,w,nx,ny,nz,dx,dy,dz,dt,kap);euler(stage,result,sx,sy,sz,u,v,w,nx,ny,nz,dx,dy,dz,dt,kap);for(int i=0;i<n;i++)stage[i]=.75*q[i]+.25*result[i];euler(stage,result,sx,sy,sz,u,v,w,nx,ny,nz,dx,dy,dz,dt,kap);for(int i=0;i<n;i++)q[i]=q[i]/3+2*result[i]/3;
}
typedef struct {int n,size,reverse[128];double phaseCos[64],phaseSin[64],wr[64],wi[64];} Transform;
static Transform transforms[3];
void initialize(){for(int c=0;c<3;c++){Transform *t=transforms+c;t->n=16<<c;t->size=2*t->n;int bits=5+c;for(int i=0;i<t->size;i++){int x=i,y=0;for(int b=0;b<bits;b++){y=(y<<1)|(x&1);x>>=1;}t->reverse[i]=y;}for(int k=0;k<t->n;k++){t->phaseCos[k]=cos(3.141592653589793*k/(2*t->n));t->phaseSin[k]=sin(3.141592653589793*k/(2*t->n));t->wr[k]=cos(3.141592653589793*k/t->n);t->wi[k]=sin(3.141592653589793*k/t->n);}}}
static void fft(Transform *t,double *re,double *im,int inverse){
 for(int i=0;i<t->size;i++){int j=t->reverse[i];if(j>i){double a=re[i];re[i]=re[j];re[j]=a;a=im[i];im[i]=im[j];im[j]=a;}}
 for(int len=2;len<=t->size;len*=2){int half=len/2,stride=t->size/len;for(int start=0;start<t->size;start+=len)for(int k=0;k<half;k++){int a=start+k,b=a+half;double c=t->wr[k*stride],s=t->wi[k*stride]*(inverse?1:-1),tr=c*re[b]-s*im[b],ti=s*re[b]+c*im[b];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;}}
 if(inverse)for(int i=0;i<t->size;i++){re[i]/=t->size;im[i]/=t->size;}
}
static void dct(int n,double *in,int off,int stride,double *out,int outOff,int outStride,int inverse){
 Transform *t=transforms+(n==16?0:n==32?1:2);double re[128],im[128];for(int i=0;i<2*n;i++)im[i]=0;
 if(!inverse){for(int k=0;k<n;k++)re[k]=re[2*n-1-k]=in[off+k*stride];fft(t,re,im,0);for(int k=0;k<n;k++)out[outOff+k*outStride]=.5*(re[k]*t->phaseCos[k]+im[k]*t->phaseSin[k]);}
 else{re[0]=2*in[off];re[n]=0;for(int k=1;k<n;k++){double c=2*in[off+k*stride];re[k]=re[2*n-k]=c*t->phaseCos[k];im[k]=c*t->phaseSin[k];im[2*n-k]=-im[k];}fft(t,re,im,1);for(int k=0;k<n;k++)out[outOff+k*outStride]=re[k];}
}
void poisson(double *rhs,double *phi,double *a,double *b,double *inv,int nx,int ny,int nz){
 int p=nx*ny,n=p*nz;
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)dct(nx,rhs,k*p+j*nx,1,a,k*p+j*nx,1,0);
 for(int k=0;k<nz;k++)for(int i=0;i<nx;i++)dct(ny,a,k*p+i,nx,b,k*p+i,nx,0);
 for(int j=0;j<ny;j++)for(int i=0;i<nx;i++)dct(nz,b,j*nx+i,p,a,j*nx+i,p,0);
 for(int i=0;i<n;i++)a[i]*=inv[i];
 for(int j=0;j<ny;j++)for(int i=0;i<nx;i++)dct(nz,a,j*nx+i,p,b,j*nx+i,p,1);
 for(int k=0;k<nz;k++)for(int i=0;i<nx;i++)dct(ny,b,k*p+i,nx,a,k*p+i,nx,1);
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)dct(nx,a,k*p+j*nx,1,phi,k*p+j*nx,1,1);
}
