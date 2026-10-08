import { createTankCamera } from './tank-camera.mjs';

export const tankSpeedLimit=.05;
export const tankVorticityLimit=8;
const salinityColors=[[.05,.08,.22],[.17,.51,.53],[.94,.86,.61]],speedColors=[[.02,.07,.10],[.23,.78,.90]],vorticityColors=[[.02,.08,.16],[.12,.67,.76],[1,.94,.75]],signedColors=[[.30,.80,.92],[.035,.07,.11],[1,.48,.34]];
export function tankPaletteColor(view,f){f=Math.max(0,Math.min(1,f));if(view==='vorticity-z'){const z=2*f-1;f=.5+.5*Math.sign(z)*Math.sqrt(Math.abs(z));}const stops=view==='salinity'?salinityColors:view==='vorticity'?vorticityColors:view==='vorticity-z'?signedColors:speedColors,n=stops.length-1,i=Math.min(n-1,Math.floor(f*n)),t=f*n-i;return stops[i].map((c,j)=>255*(c+(stops[i+1][j]-c)*t));}
const shaderColor=c=>'vec3('+c.join(',')+')';

const VS = `#version 300 es
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D oldVol,newVol,oldCurl,newCurl;
uniform ivec3 grid;
uniform vec3 dims,eye,forward,right,up,outward;
uniform float phase,halfFov,aspect,cutaway;
uniform int mode;
uniform bool smoothFloat,flow,hasCurl;
in vec2 uv;
out vec4 color;
vec4 one(sampler3D s,vec3 p){
 p=clamp(p,vec3(0.),vec3(1.));
 if(smoothFloat)return texture(s,p);
 vec3 c=p*vec3(grid)-.5,b=floor(c),f=fract(c);
 ivec3 i=ivec3(clamp(b,vec3(0.),vec3(grid-1))),j=ivec3(clamp(b+1.,vec3(0.),vec3(grid-1)));
 vec4 a000=texelFetch(s,ivec3(i.x,i.y,i.z),0),a100=texelFetch(s,ivec3(j.x,i.y,i.z),0);
 vec4 a010=texelFetch(s,ivec3(i.x,j.y,i.z),0),a110=texelFetch(s,ivec3(j.x,j.y,i.z),0);
 vec4 a001=texelFetch(s,ivec3(i.x,i.y,j.z),0),a101=texelFetch(s,ivec3(j.x,i.y,j.z),0);
 vec4 a011=texelFetch(s,ivec3(i.x,j.y,j.z),0),a111=texelFetch(s,ivec3(j.x,j.y,j.z),0);
 return mix(mix(mix(a000,a100,f.x),mix(a010,a110,f.x),f.y),mix(mix(a001,a101,f.x),mix(a011,a111,f.x),f.y),f.z);
}
vec4 field(vec3 p){return mix(one(oldVol,p),one(newVol,p),phase);}
vec4 rotation(vec3 p){return hasCurl?mix(one(oldCurl,p),one(newCurl,p),phase):vec4(0.);}
float dye(vec3 p){vec4 q=field(p);return max(0.,q.x+q.y);}
bool box(vec3 ro,vec3 rd,out float a,out float b){
 vec3 h=dims*.5,t0=(-h-ro)/rd,t1=(h-ro)/rd,lo=min(t0,t1),hi=max(t0,t1);
 a=max(max(lo.x,lo.y),lo.z);b=min(min(hi.x,hi.y),hi.z);return b>=max(a,0.);
}
void main(){
 vec2 n=vec2(uv.x*2.-1.,uv.y*2.-1.);
 vec3 rd=normalize(forward+right*n.x*halfFov*aspect+up*n.y*halfFov);
 float a,b;vec3 bg=mix(vec3(.006,.018,.031),vec3(.014,.040,.060),smoothstep(-1.,1.,n.y));
 if(!box(eye,rd,a,b)){color=vec4(bg,1.);return;}a=max(a,0.);
 float cell=max(max(dims.x/float(grid.x),dims.y/float(grid.y)),dims.z/float(grid.z));
 float ds=max(cell*.7,(b-a)/150.);float trans=1.;vec3 rgb=vec3(0.);
 float radius=dot(abs(outward),dims*.5),clip=radius*(2.*cutaway-1.);
 for(float t=a;t<b&&trans>.02;t+=ds){
  vec3 p=eye+rd*(t+.5*ds);if(dot(p,outward)>clip)continue;
  vec3 qpos=vec3(p.x/dims.x+.5,.5-p.y/dims.y,p.z/dims.z+.5);vec4 q=field(qpos);
  float alpha;vec3 ink;
  if(mode==1){float s=clamp(q.z,0.,1.);ink=s<.5?mix(${shaderColor(salinityColors[0])},${shaderColor(salinityColors[1])},2.*s):mix(${shaderColor(salinityColors[1])},${shaderColor(salinityColors[2])},2.*s-1.);alpha=1.-exp(-1.8*ds);}
  else if(mode==2){float s=clamp(q.w/${tankSpeedLimit},0.,1.);ink=mix(${shaderColor(speedColors[0])},${shaderColor(speedColors[1])},s);alpha=1.-exp(-2.*s*ds);}
  else if(mode==3||mode==4){vec4 curl=rotation(qpos);float s=clamp((mode==3?curl.w:abs(curl.z))/${tankVorticityLimit.toFixed(1)},0.,1.);if(mode==3)ink=s<.5?mix(${shaderColor(vorticityColors[0])},${shaderColor(vorticityColors[1])},2.*s):mix(${shaderColor(vorticityColors[1])},${shaderColor(vorticityColors[2])},2.*s-1.);else ink=mix(${shaderColor(signedColors[1])},curl.z<0.?${shaderColor(signedColors[0])}:${shaderColor(signedColors[2])},sqrt(s));alpha=1.-exp(-160.*pow(s,.85)*ds);}
  else{
   float d=max(0.,q.x+q.y),f=d>1e-8?clamp(q.y/d,0.,1.):0.;
   vec3 gold=mix(vec3(.72,.23,.045),vec3(1.,.83,.46),smoothstep(.003,.09,d));
   vec3 rose=mix(vec3(.75,.08,.23),vec3(1.,.57,.56),smoothstep(.003,.09,d));
   ink=mix(gold,rose,f);alpha=1.-exp(-120.*d*ds);
   if(flow){float s=clamp(q.w*22.,0.,1.);ink=mix(ink,vec3(.22,.78,.86),.25*s);alpha=max(alpha,1.-exp(-.8*s*ds));}
   if(alpha>.001){
    vec3 e=1./vec3(grid);float gx=dye(qpos+vec3(e.x,0,0))-dye(qpos-vec3(e.x,0,0));float gy=dye(qpos+vec3(0,e.y,0))-dye(qpos-vec3(0,e.y,0));float gz=dye(qpos+vec3(0,0,e.z))-dye(qpos-vec3(0,0,e.z));
    vec3 normal=normalize(vec3(-gx,gy,-gz)+vec3(1e-7)),light=normalize(vec3(-.5,.8,.6));
    float shade=exp(-2.8*dye(qpos+vec3(light.x,-light.y,light.z)*e*3.));
    float key=max(0.,dot(normal,light)),rim=pow(1.-abs(dot(normal,rd)),3.);
    ink*=.52+.65*key*shade+.18*rim;
   }
  }
  rgb+=trans*alpha*ink*(.84+.16*clamp((b-t)/(b-a+1e-6),0.,1.));trans*=1.-alpha;
 }
 color=vec4(pow(max(rgb+trans*bg,vec3(0.)),vec3(.88)),1.);
}`;
const LVS = `#version 300 es
precision highp float;
in vec3 position;
uniform vec3 eye,forward,right,up;
uniform float halfFov,aspect;
void main(){vec3 q=position-eye;float d=dot(q,forward);gl_Position=vec4(dot(q,right)/(d*halfFov*aspect),dot(q,up)/(d*halfFov),0.,1.);}`;
const LFS = `#version 300 es
precision highp float;
uniform vec4 tint;
out vec4 color;
void main(){color=tint;}`;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function valid(s){if(!s||![s.nx,s.ny,s.nz,s.width,s.height,s.depth].every(Number.isFinite)||![s.nx,s.ny,s.nz,s.width,s.height,s.depth].every(x=>x>0)||![s.nx,s.ny,s.nz].every(Number.isInteger))throw new TypeError('Invalid 3D tank snapshot dimensions');if(!(s.volume instanceof Float32Array)||s.volume.length!==s.nx*s.ny*s.nz*4)throw new RangeError('snapshot.volume must be interleaved RGBA Float32 data');if(s.vorticity&&(!(s.vorticity instanceof Float32Array)||s.vorticity.length!==s.volume.length))throw new RangeError('snapshot.vorticity must be interleaved RGBA Float32 data');return s;}
function sizeCanvas(c,scale=1){const r=c.getBoundingClientRect?.()||{width:700,height:525},dpr=Math.min(2,globalThis.devicePixelRatio||1),w=r.width||700,h=r.height||525,f=Math.min(1,1400/(w*dpr),1050/(h*dpr))*scale,width=Math.max(1,Math.round(w*dpr*f)),height=Math.max(1,Math.round(h*dpr*f));if(c.width!==width)c.width=width;if(c.height!==height)c.height=height;return {w:c.width,h:c.height,aspect:c.width/c.height};}
function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Volume shader: '+gl.getShaderInfoLog(s));return s;}
function link(gl,v,f){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Volume program: '+gl.getProgramInfoLog(p));return p;}
function tankLines(d){const [x,y,z]=d.map(v=>v/2),p=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]],e=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],a=[];for(const [i,j]of e)a.push(...p[i],...p[j]);for(let i=1;i<4;i++){let f=i/4;a.push(-x,-y,-z+2*z*f,x,-y,-z+2*z*f,-x+2*x*f,-y,-z,-x+2*x*f,-y,z);}return new Float32Array(a);}
export function createTankVolumeRenderer(canvas){
 if(!canvas)throw new TypeError('Canvas required');let data=null,old=null,current=null,oldCurl=null,currentCurl=null,mixAt=1;
 let renderScale=1,lastPaint=null,slowFrames=0,fastFrames=0;
 const stats=()=>({width:canvas.width,height:canvas.height,scale:renderScale});
 let dims={width:.24,height:.18,depth:.18},camera=createTankCamera(dims);
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:false,depth:false});
 const camApi={orbit:(x,y)=>camera.orbit(x,y),zoom:f=>camera.zoom(f),home:()=>camera.home(),getCamera:()=>camera.getCamera(),pick:(x,y,r,z)=>camera.pick(x,y,r,z)};
 if(!gl)return {...fallback(canvas,()=>camera,dataRef=>{if(!data||data.width!==dataRef.width||data.height!==dataRef.height||data.depth!==dataRef.depth){dims={width:dataRef.width,height:dataRef.height,depth:dataRef.depth};camera=createTankCamera(dims);}data=dataRef;},camApi)};
 const drawProgram=link(gl,VS,FS),lineProgram=link(gl,LVS,LFS);
 const loc=(p,n)=>gl.getUniformLocation(p,n),u=Object.fromEntries(['oldVol','newVol','oldCurl','newCurl','hasCurl','grid','dims','eye','forward','right','up','outward','phase','halfFov','aspect','cutaway','mode','smoothFloat','flow'].map(n=>[n,loc(drawProgram,n)])),lu=Object.fromEntries(['eye','forward','right','up','halfFov','aspect','tint'].map(n=>[n,loc(lineProgram,n)]));
 const tex=Array.from({length:4},()=>gl.createTexture()),linear=Boolean(gl.getExtension('OES_texture_float_linear')),lineBuffer=gl.createBuffer();let lineKey='',lineN=0;
 gl.useProgram(drawProgram);for(const [i,n]of ['oldVol','newVol','oldCurl','newCurl'].entries())gl.uniform1i(u[n],i);gl.uniform1i(u.smoothFloat,Number(linear));
 for(const t of tex){gl.bindTexture(gl.TEXTURE_3D,t);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,p,gl.CLAMP_TO_EDGE);const f=linear?gl.LINEAR:gl.NEAREST;gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,f);}
 function setData(s){if(!data||data.width!==s.width||data.height!==s.height||data.depth!==s.depth){dims={width:s.width,height:s.height,depth:s.depth};camera=createTankCamera(dims);lineKey='';}data=s;}
 let textureGrid=null,empty=null,uploadedCurl=false;
 function upload(){if(!data||!old||!current)return;gl.useProgram(drawProgram);const resized=!textureGrid||textureGrid.nx!==data.nx||textureGrid.ny!==data.ny||textureGrid.nz!==data.nz;if(resized)empty=new Float32Array(current.length);const fields=[old,current,oldCurl||empty,currentCurl||empty];for(let i=0;i<4;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_3D,tex[i]);if(resized)gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA32F,data.nx,data.ny,data.nz,0,gl.RGBA,gl.FLOAT,fields[i]);else if(i<2||currentCurl||uploadedCurl)gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,data.nx,data.ny,data.nz,gl.RGBA,gl.FLOAT,fields[i]);}if(resized)textureGrid={nx:data.nx,ny:data.ny,nz:data.nz};uploadedCurl=Boolean(currentCurl);gl.uniform1i(u.hasCurl,Number(uploadedCurl));gl.uniform3i(u.grid,data.nx,data.ny,data.nz);gl.uniform3f(u.dims,data.width/data.width,data.height/data.width,data.depth/data.width);}
 return {mode:linear?'webgl2-volume-linear':'webgl2-volume-trilinear',...camApi,getStats:stats,
  push(snapshot,mix){const s=valid(snapshot),prior=data,same=Boolean(old&&prior&&prior.nx===s.nx&&prior.ny===s.ny&&prior.nz===s.nz&&prior.width===s.width&&prior.height===s.height&&prior.depth===s.depth);setData(s);const packed=new Float32Array(s.volume),f=clamp(Number.isFinite(mix)?mix:1,0,1);if(same){for(let i=0;i<old.length;i++)old[i]+=(current[i]-old[i])*f;}else old=packed.slice();current=packed;if(s.vorticity){const packedCurl=new Float32Array(s.vorticity);if(same&&oldCurl&&currentCurl){for(let i=0;i<oldCurl.length;i++)oldCurl[i]+=(currentCurl[i]-oldCurl[i])*f;}else oldCurl=packedCurl.slice();currentCurl=packedCurl;}else oldCurl=currentCurl=null;mixAt=f;upload();},
  draw(mix,view,{cutaway=1,flow=false}={}){if(!current)return;
   const now=performance.now(),gap=lastPaint===null?0:now-lastPaint;lastPaint=now;
   // Adjust drawing resolution only. Neither the physical grid nor its clock changes.
   if(gap>25&&gap<3000){slowFrames++;fastFrames=0;}else if(gap>0&&gap<19){fastFrames++;slowFrames=Math.max(0,slowFrames-1);}else {slowFrames=fastFrames=0;}
   if(slowFrames>=12){renderScale=Math.max(.5,renderScale-.1);slowFrames=0;}else if(fastFrames>=180){renderScale=Math.min(1,renderScale+.05);fastFrames=0;}
   const sz=sizeCanvas(canvas,renderScale),f=camera.getFrame(sz.aspect);gl.viewport(0,0,sz.w,sz.h);gl.clearColor(.012,.045,.07,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(drawProgram);gl.uniform3f(u.eye,...f.position);gl.uniform3f(u.forward,...f.forward);gl.uniform3f(u.right,...f.right);gl.uniform3f(u.up,...f.up);gl.uniform3f(u.outward,...f.position);gl.uniform1f(u.phase,clamp(Number.isFinite(mix)?mix:mixAt,0,1));gl.uniform1f(u.halfFov,f.tanHalfFov);gl.uniform1f(u.aspect,sz.aspect);gl.uniform1f(u.cutaway,clamp(cutaway,0,1));gl.uniform1i(u.mode,view==='salinity'?1:view==='speed'?2:view==='vorticity'?3:view==='vorticity-z'?4:0);gl.uniform1i(u.flow,Number(Boolean(flow)));for(let i=0;i<4;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_3D,tex[i]);}gl.drawArrays(gl.TRIANGLES,0,3);
   gl.useProgram(lineProgram);for(const [name,val]of [['eye',f.position],['forward',f.forward],['right',f.right],['up',f.up]])gl.uniform3f(lu[name],...val);gl.uniform1f(lu.halfFov,f.tanHalfFov);gl.uniform1f(lu.aspect,sz.aspect);gl.uniform4f(lu.tint,.34,.63,.67,.32);const k=data.width+'/'+data.height+'/'+data.depth;if(k!==lineKey){const a=tankLines(f.dimensions);lineN=a.length/3;gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);lineKey=k;}gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);const at=gl.getAttribLocation(lineProgram,'position');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,3,gl.FLOAT,false,0,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.LINES,0,lineN);gl.disable(gl.BLEND);},
  reset(){data=old=current=oldCurl=currentCurl=null;mixAt=1;lastPaint=null;slowFrames=fastFrames=0;gl.clearColor(.012,.045,.07,1);gl.clear(gl.COLOR_BUFFER_BIT);}
 };
}
function fallback(canvas,cameraRef,setData,camApi){
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('WebGL2 and Canvas 2D are unavailable');let s=null,old=null,current=null,oldCurl=null,currentCurl=null;
 const corners=q=>[{x:0,y:0,z:0},{x:q.width,y:0,z:0},{x:q.width,y:q.height,z:0},{x:0,y:q.height,z:0},{x:0,y:0,z:q.depth},{x:q.width,y:0,z:q.depth},{x:q.width,y:q.height,z:q.depth},{x:0,y:q.height,z:q.depth}],edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
 return {mode:'canvas-3d-volume-samples',...camApi,
  push(snapshot,mix){const q=valid(snapshot),same=Boolean(s&&s.nx===q.nx&&s.ny===q.ny&&s.nz===q.nz&&s.width===q.width&&s.height===q.height&&s.depth===q.depth),a=clamp(Number.isFinite(mix)?mix:1,0,1);if(same){for(let i=0;i<old.length;i++)old[i]+=(current[i]-old[i])*a;}else old=new Float32Array(q.volume);current=new Float32Array(q.volume);if(q.vorticity){if(same&&oldCurl&&currentCurl){for(let i=0;i<oldCurl.length;i++)oldCurl[i]+=(currentCurl[i]-oldCurl[i])*a;}else oldCurl=new Float32Array(q.vorticity);currentCurl=new Float32Array(q.vorticity);}else oldCurl=currentCurl=null;s={...q,volume:null,vorticity:null};setData(s);},
  draw(mix,view,{cutaway=1,flow=false}={}){if(!current)return;const z=sizeCanvas(canvas),rect={left:0,top:0,width:z.w,height:z.h},t=clamp(Number.isFinite(mix)?mix:1,0,1),key=view==='salinity'?1:view==='speed'?2:view==='vorticity'?3:view==='vorticity-z'?4:0;ctx.fillStyle='#061a25';ctx.fillRect(0,0,z.w,z.h);const c=corners(s).map(p=>cameraRef().projectToPixel(p,rect));ctx.strokeStyle='rgba(95,218,225,.7)';ctx.beginPath();for(const [a,b]of edges)if(c[a].depth>0&&c[b].depth>0){ctx.moveTo(c[a].x,c[a].y);ctx.lineTo(c[b].x,c[b].y);}ctx.stroke();const n=s.nx*s.ny*s.nz,items=[];
   const cam=cameraRef().getCamera(),o=cam.position,half=[s.width/s.width/2,s.height/s.width/2,s.depth/s.width/2],rad=Math.abs(o[0])*half[0]+Math.abs(o[1])*half[1]+Math.abs(o[2])*half[2],clip=rad*(2*cutaway-1);
   const stride=Math.max(1,Math.ceil(Math.cbrt(n/32000)));
   for(let l=0;l<s.nz;l+=stride)for(let j=0;j<s.ny;j+=stride)for(let i=0;i<s.nx;i+=stride){const k=l*s.nx*s.ny+j*s.nx+i,a=4*k,g=old[a]+t*(current[a]-old[a]),r=old[a+1]+t*(current[a+1]-old[a+1]),sal=old[a+2]+t*(current[a+2]-old[a+2]),speed=old[a+3]+t*(current[a+3]-old[a+3]),rot=currentCurl?(oldCurl[a+(key===3?3:2)]+t*(currentCurl[a+(key===3?3:2)]-oldCurl[a+(key===3?3:2)]))/tankVorticityLimit:0;let val=key===0?g+r:key===1?sal:key>=3?clamp(Math.abs(rot),0,1):clamp(speed/tankSpeedLimit,0,1);if(flow&&key===0)val=Math.max(val,clamp(speed*4,0,.2));if(val<.018)continue;const p={x:(i+.5)*s.width/s.nx,y:(j+.5)*s.height/s.ny,z:(l+.5)*s.depth/s.nz},q=cameraRef().projectToPixel(p,rect);if(q.depth<=0)continue;const world=[p.x/s.width-.5,s.height/(2*s.width)-p.y/s.width,p.z/s.width-s.depth/(2*s.width)];if(cutaway<.999&&world[0]*o[0]+world[1]*o[1]+world[2]*o[2]>clip)continue;items.push({q,val,g,r,rot,depth:q.depth});}
   items.sort((a,b)=>b.depth-a.depth);for(const a of items){let rgb;if(key===0){const f=a.g+a.r?a.r/(a.g+a.r):0;rgb=[255,Math.round(193-57*f),Math.round(91+60*f)];}else rgb=tankPaletteColor(view,key===4?.5+.5*clamp(a.rot,-1,1):a.val);ctx.globalAlpha=key===0?1-Math.exp(-3*a.val):key>=3?1-Math.exp(-2*a.val):.2+.6*a.val;ctx.fillStyle='rgb('+rgb.join(',')+')';const radius=clamp((s.width/s.nx*z.w/Math.max(.1,a.depth))*.38,1,6);ctx.beginPath();ctx.arc(a.q.x,a.q.y,radius,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;},
  reset(){s=old=current=oldCurl=currentCurl=null;ctx.clearRect(0,0,canvas.width,canvas.height);}
 };
}
