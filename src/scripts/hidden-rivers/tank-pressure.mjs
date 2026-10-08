// Exact eigenbasis of the cell-centred closed-wall discrete Laplacian.
// DCT-II is computed from a mirrored real FFT; DCT-III reverses it.
export const powerOfTwo=n=>Number.isInteger(n)&&n>0&&(n&(n-1))===0;
class CosineTransform {
  constructor(n){
    this.n=n;this.size=2*n;this.re=new Float64Array(2*n);this.im=new Float64Array(2*n);
    this.reverse=new Uint32Array(2*n);this.cos=new Float64Array(n);this.sin=new Float64Array(n);
    this.twiddleRe=new Float64Array(n);this.twiddleIm=new Float64Array(n);
    const bits=Math.log2(2*n);
    for(let i=0;i<2*n;i++){let x=i,y=0;for(let b=0;b<bits;b++){y=(y<<1)|(x&1);x>>=1;}this.reverse[i]=y;}
    for(let k=0;k<n;k++){this.cos[k]=Math.cos(Math.PI*k/(2*n));this.sin[k]=Math.sin(Math.PI*k/(2*n));this.twiddleRe[k]=Math.cos(Math.PI*k/n);this.twiddleIm[k]=Math.sin(Math.PI*k/n);}
  }
  fft(inverse){
    const {size,re,im,reverse,twiddleRe:wr,twiddleIm:wi}=this;
    for(let i=0;i<size;i++){const j=reverse[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
    for(let len=2;len<=size;len*=2){const half=len/2,stride=size/len;
      for(let start=0;start<size;start+=len)for(let k=0;k<half;k++){
        const a=start+k,b=a+half,c=wr[k*stride],s=wi[k*stride]*(inverse?1:-1);
        const tr=c*re[b]-s*im[b],ti=s*re[b]+c*im[b];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
      }
    }
    if(inverse)for(let i=0;i<size;i++){re[i]/=size;im[i]/=size;}
  }
  forward(input,offset,stride,output,outOffset,outStride){
    const {n,re,im,cos,sin}=this;im.fill(0);
    for(let k=0;k<n;k++)re[k]=re[2*n-1-k]=input[offset+k*stride];
    this.fft(false);for(let k=0;k<n;k++)output[outOffset+k*outStride]=.5*(re[k]*cos[k]+im[k]*sin[k]);
  }
  inverse(input,offset,stride,output,outOffset,outStride){
    const {n,re,im,cos,sin}=this;re[0]=2*input[offset];im[0]=0;re[n]=im[n]=0;
    for(let k=1;k<n;k++){const c=2*input[offset+k*stride];re[k]=re[2*n-k]=c*cos[k];im[k]=c*sin[k];im[2*n-k]=-im[k];}
    this.fft(true);for(let k=0;k<n;k++)output[outOffset+k*outStride]=re[k];
  }
}
export function createSpectralPressure(nx,ny,dx,dy){
  if(!powerOfTwo(nx)||!powerOfTwo(ny))throw new RangeError('Spectral grid must have power-of-two dimensions');
  const x=new CosineTransform(nx),y=new CosineTransform(ny),rows=new Float64Array(nx*ny),spectrum=new Float64Array(nx*ny),inverseEigenvalue=new Float64Array(nx*ny);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(i||j)inverseEigenvalue[j*nx+i]=1/(4*Math.sin(Math.PI*i/(2*nx))**2/(dx*dx)+4*Math.sin(Math.PI*j/(2*ny))**2/(dy*dy));
  return (rhs,phi)=>{
    for(let j=0;j<ny;j++)x.forward(rhs,j*nx,1,rows,j*nx,1);
    for(let i=0;i<nx;i++)y.forward(rows,i,nx,spectrum,i,nx);
    for(let k=0;k<spectrum.length;k++)spectrum[k]*=inverseEigenvalue[k];
    for(let i=0;i<nx;i++)y.inverse(spectrum,i,nx,rows,i,nx);
    for(let j=0;j<ny;j++)x.inverse(rows,j*nx,1,phi,j*nx,1);
  };
}
export function createSpectralPressure3D(nx,ny,nz,dx,dy,dz){
  if(![nx,ny,nz].every(powerOfTwo))throw new RangeError('Spectral grid must have power-of-two dimensions');
  const x=new CosineTransform(nx),y=new CosineTransform(ny),z=new CosineTransform(nz),n=nx*ny*nz;
  const a=new Float64Array(n),b=new Float64Array(n),inv=new Float64Array(n),plane=nx*ny;
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(i||j||k)inv[k*plane+j*nx+i]=1/(4*Math.sin(Math.PI*i/(2*nx))**2/dx**2+4*Math.sin(Math.PI*j/(2*ny))**2/dy**2+4*Math.sin(Math.PI*k/(2*nz))**2/dz**2);
  return(rhs,phi)=>{
    for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)x.forward(rhs,k*plane+j*nx,1,a,k*plane+j*nx,1);
    for(let k=0;k<nz;k++)for(let i=0;i<nx;i++)y.forward(a,k*plane+i,nx,b,k*plane+i,nx);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)z.forward(b,j*nx+i,plane,a,j*nx+i,plane);
    for(let q=0;q<n;q++)a[q]*=inv[q];
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)z.inverse(a,j*nx+i,plane,b,j*nx+i,plane);
    for(let k=0;k<nz;k++)for(let i=0;i<nx;i++)y.inverse(b,k*plane+i,nx,a,k*plane+i,nx);
    for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)x.inverse(a,k*plane+j*nx,1,phi,k*plane+j*nx,1);
  };
}
