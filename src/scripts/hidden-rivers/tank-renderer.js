// Smooth optical display of resolved dye, salt and rotation; never drives flow.
const fragment=`#version 300 es
precision highp float;
uniform sampler2D beforeField;
uniform sampler2D afterField;
uniform vec2 grid;
uniform float phase;
uniform int view;
uniform bool smoothFloat;
in vec2 uv;
out vec4 color;
vec4 bilinear(sampler2D tex,vec2 p){
  vec2 cell=p*grid-.5,i=floor(cell),f=fract(cell);
  return mix(mix(texelFetch(tex,ivec2(clamp(i,vec2(0),grid-1.)),0),texelFetch(tex,ivec2(clamp(i+vec2(1,0),vec2(0),grid-1.)),0),f.x),mix(texelFetch(tex,ivec2(clamp(i+vec2(0,1),vec2(0),grid-1.)),0),texelFetch(tex,ivec2(clamp(i+1.,vec2(0),grid-1.)),0),f.x),f.y);
}
// Nonnegative cubic B-spline weights: smooth contours without ringing/overshoot.
vec4 field(sampler2D tex,vec2 p){
  if(!smoothFloat)return bilinear(tex,p);
  vec2 cell=p*grid-.5,i=floor(cell),f=fract(cell),f2=f*f,f3=f2*f;
  vec2 w0=(1.-3.*f+3.*f2-f3)/6.,w1=(4.-6.*f2+3.*f3)/6.,w2=(1.+3.*f+3.*f2-3.*f3)/6.,w3=f3/6.;
  vec2 g0=w0+w1,g1=w2+w3,a=(i-1.+w1/g0+.5)/grid,b=(i+1.+w3/g1+.5)/grid;
  return g0.y*(g0.x*texture(tex,a)+g1.x*texture(tex,vec2(b.x,a.y)))+g1.y*(g0.x*texture(tex,vec2(a.x,b.y))+g1.x*texture(tex,b));
}
void main(){
  vec2 p=vec2(uv.x,1.-uv.y);vec4 q=mix(field(beforeField,p),field(afterField,p),phase);
  vec3 water=mix(vec3(.014,.064,.104),vec3(.027,.103,.143),clamp(q.z,0.,1.));
  // Smooth depth lighting and Beer-Lambert-like pigment opacity are aesthetic.
  water*=.76+.24*(1.-p.y);vec3 c=water;
  if(view==1){float t=clamp(q.z,0.,1.);c=t<.5?mix(vec3(.078,.098,.220),vec3(.176,.510,.518),t*2.):mix(vec3(.176,.510,.518),vec3(.957,.863,.600),(t-.5)*2.);}
  else if(view==2)c=mix(vec3(.031,.118,.184),q.w>0.?vec3(.957,.627,.471):vec3(.408,.773,.855),clamp(abs(q.w),0.,1.));
  else{
    float dye=max(q.x,0.),fresh=dye>1e-8?clamp(q.y/dye,0.,1.):0.;
    float opacity=1.-exp(-26.*dye);
    vec3 gold=mix(vec3(.92,.52,.16),vec3(1.,.91,.65),smoothstep(0.,.16,dye));
    vec3 coral=mix(vec3(.86,.27,.34),vec3(1.,.76,.72),smoothstep(0.,.16,dye));
    c=mix(water,mix(gold,coral,fresh),opacity);
    c+=mix(vec3(.12,.15,.10),vec3(.15,.07,.12),fresh)*sqrt(max(dye,0.))*exp(-12.*dye);
    float edge=pow(clamp(1.-.36*dot((p-.5)*vec2(1.,.75),(p-.5)*vec2(1.,.75)),0.,1.),2.);c*=edge;
  }
  color=vec4(c,1.);
}`;
const vertex=`#version 300 es
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
export function createTankRenderer(canvas){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:false});
  if(!gl)return fallbackRenderer(canvas);
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);const uniform=name=>gl.getUniformLocation(program,name),smooth=Boolean(gl.getExtension('OES_texture_float_linear'));
  gl.uniform1i(uniform('beforeField'),0);gl.uniform1i(uniform('afterField'),1);gl.uniform1i(uniform('smoothFloat'),Number(smooth));
  const textures=[0,1].map(()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,axis,gl.CLAMP_TO_EDGE);for(const mode of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,mode,smooth?gl.LINEAR:gl.NEAREST);return t;});
  let before=null,after=null,nx=0,ny=0;
  return {
    mode:smooth?'cubic-gpu':'linear-gpu',
    push(snapshot,mix){
      const packed=pack(snapshot);
      if(after&&snapshot.nx===nx&&snapshot.ny===ny){for(let i=0;i<after.length;i++)before[i]+=mix*(after[i]-before[i]);}
      else before=packed.slice();
      after=packed;nx=snapshot.nx;ny=snapshot.ny;
      for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,nx,ny,0,gl.RGBA,gl.FLOAT,i?after:before);}
      gl.uniform2f(uniform('grid'),nx,ny);
    },
    draw(mix,view){if(!after)return;gl.viewport(0,0,canvas.width,canvas.height);gl.uniform1f(uniform('phase'),mix);gl.uniform1i(uniform('view'),view==='salinity'?1:view==='vorticity'?2:0);gl.drawArrays(gl.TRIANGLES,0,3);},
    reset(){before=after=null;gl.clearColor(.014,.064,.104,1);gl.clear(gl.COLOR_BUFFER_BIT);}
  };
}
function pack({nx,ny,width,height,dye,coral,salinity,u,v}){
  const q=new Float32Array(nx*ny*4),dx=width/nx,dy=height/ny;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const k=j*nx+i,il=Math.max(0,i-1),ir=Math.min(nx-1,i+1),jt=Math.max(0,j-1),jb=Math.min(ny-1,j+1);
    q[4*k]=dye[k];q[4*k+1]=coral[k];q[4*k+2]=salinity[k]/40;
    q[4*k+3]=((v[j*nx+ir]+v[(j+1)*nx+ir]-v[j*nx+il]-v[(j+1)*nx+il])/(2*Math.max(1,ir-il)*dx)-(u[jb*(nx+1)+i]+u[jb*(nx+1)+i+1]-u[jt*(nx+1)+i]-u[jt*(nx+1)+i+1])/(2*Math.max(1,jb-jt)*dy))/5;
  }return q;
}
function fallbackRenderer(canvas){
  const ctx=canvas.getContext('2d',{alpha:false}),image=document.createElement('canvas'),ink=image.getContext('2d');let before,after,nx,ny,pixels;
  return {mode:'canvas',push(snapshot,mix){const q=pack(snapshot);if(after&&nx===snapshot.nx&&ny===snapshot.ny)for(let i=0;i<q.length;i++)before[i]+=mix*(after[i]-before[i]);else before=q.slice();after=q;nx=snapshot.nx;ny=snapshot.ny;image.width=nx;image.height=ny;pixels=ink.createImageData(nx,ny);},draw(mix,view){if(!after)return;const c=pixels.data;for(let i=0;i<nx*ny;i++){const at=i*4,d=before[at]+mix*(after[at]-before[at]),s=before[at+2]+mix*(after[at+2]-before[at+2]),w=before[at+3]+mix*(after[at+3]-before[at+3]),fresh=d?Math.max(0,Math.min(1,(before[at+1]+mix*(after[at+1]-before[at+1]))/d)):0;let color=[4,18,30];if(view==='salinity'){const t=s*2,f=t<1?t:t-1,a=t<1?[20,25,56]:[45,130,132],b=t<1?[45,130,132]:[244,220,153];color=a.map((x,k)=>x+(b[k]-x)*f);}else if(view==='vorticity'){const a=Math.min(1,Math.abs(w)),b=w>0?[244,160,120]:[104,197,218];color=color.map((x,k)=>x+(b[k]-x)*a);}else{const a=1-Math.exp(-9*Math.max(0,d)),b=[255,219-56*fresh,130+26*fresh];color=color.map((x,k)=>x+(b[k]-x)*a);}c[at]=color[0];c[at+1]=color[1];c[at+2]=color[2];c[at+3]=255;}ink.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(image,0,0,canvas.width,canvas.height);},reset(){before=after=null;ctx.fillStyle='#04121e';ctx.fillRect(0,0,canvas.width,canvas.height);}};
}
