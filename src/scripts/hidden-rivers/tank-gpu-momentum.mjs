// Float32 implementation of the reference MAC-face momentum operation only.
// The Float64 tank remains canonical until every GPU result has been checked.
const SHADER = /* wgsl */`
struct Params {
  shape: vec4<u32>,       // cell nx,ny,nz, axis
  dims: vec4<u32>,        // face nx,ny,nz, packed output offset
  offset: vec4<f32>,      // staggered offsets
  spacing: vec4<f32>,     // dx,dy,dz,dt
  physics: vec4<f32>,     // viscosity, side/bottom wall sign
};
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage,read> oldU: array<f32>;
@group(0) @binding(2) var<storage,read> oldV: array<f32>;
@group(0) @binding(3) var<storage,read> oldW: array<f32>;
@group(0) @binding(4) var<storage,read_write> stage: array<f32>;
@group(0) @binding(5) var<storage,read_write> departure: array<vec4<f32>>;
@group(0) @binding(6) var<storage,read_write> backward: array<f32>;
@group(0) @binding(7) var<storage,read_write> result: array<f32>;

fn faceDims(axis:u32)->vec3<u32> {
  if(axis==0u){return vec3<u32>(p.shape.x+1u,p.shape.y,p.shape.z);}
  if(axis==1u){return vec3<u32>(p.shape.x,p.shape.y+1u,p.shape.z);}
  return vec3<u32>(p.shape.x,p.shape.y,p.shape.z+1u);
}
fn faceOffset(axis:u32)->vec3<f32> {
  if(axis==0u){return vec3<f32>(0.,.5,.5);}
  if(axis==1u){return vec3<f32>(.5,0.,.5);}
  return vec3<f32>(.5,.5,0.);
}
fn readOld(axis:u32,d:u32)->f32 {
  if(axis==0u){return oldU[d];}
  if(axis==1u){return oldV[d];}
  return oldW[d];
}
fn readField(axis:u32,d:u32,useStage:bool)->f32 {
  if(useStage){return stage[d];}
  return readOld(axis,d);
}
fn sampleField(axis:u32,position:vec3<f32>,useStage:bool)->f32 {
  let dims=faceDims(axis);
  let maximum=vec3<f32>(dims-vec3<u32>(1u));
  let xyz=clamp(position,vec3<f32>(0.),maximum);
  let base=min(vec3<u32>(xyz),dims-vec3<u32>(2u));
  let f=xyz-vec3<f32>(base);
  let d=(base.z*dims.y+base.y)*dims.x+base.x;
  let plane=dims.x*dims.y;
  let a=readField(axis,d,useStage);
  let b=readField(axis,d+1u,useStage);
  let c=readField(axis,d+dims.x,useStage);
  let e=readField(axis,d+dims.x+1u,useStage);
  let g=readField(axis,d+plane,useStage);
  let h=readField(axis,d+plane+1u,useStage);
  let l=readField(axis,d+plane+dims.x,useStage);
  let m=readField(axis,d+plane+dims.x+1u,useStage);
  return (1.-f.z)*((1.-f.y)*((1.-f.x)*a+f.x*b)+f.y*((1.-f.x)*c+f.x*e))
    + f.z*((1.-f.y)*((1.-f.x)*g+f.x*h)+f.y*((1.-f.x)*l+f.x*m));
}
fn velocityAt(position:vec3<f32>)->vec3<f32> {
  let cell=position/p.spacing.xyz;
  return vec3<f32>(
    sampleField(0u,cell-faceOffset(0u),false),
    sampleField(1u,cell-faceOffset(1u),false),
    sampleField(2u,cell-faceOffset(2u),false));
}
fn trace(position:vec3<f32>,dt:f32)->vec3<f32> {
  let midpoint=position-.5*dt*velocityAt(position);
  return position-dt*velocityAt(midpoint);
}
fn location(d:u32)->vec3<u32> {
  let plane=p.dims.x*p.dims.y;
  return vec3<u32>(d%p.dims.x,(d/ p.dims.x)%p.dims.y,d/plane);
}
fn onNormalWall(q:vec3<u32>)->bool {
  let axis=p.shape.w;
  if(axis==0u){return q.x==0u||q.x==p.dims.x-1u;}
  if(axis==1u){return q.y==0u||q.y==p.dims.y-1u;}
  return q.z==0u||q.z==p.dims.z-1u;
}
@compute @workgroup_size(128)
fn forward(@builtin(global_invocation_id) gid:vec3<u32>) {
  let d=gid.x;
  if(d>=p.dims.x*p.dims.y*p.dims.z){return;}
  let q=location(d);
  if(onNormalWall(q)){stage[d]=0.;return;}
  let position=(vec3<f32>(q)+p.offset.xyz)*p.spacing.xyz;
  let b=trace(position,p.spacing.w)/p.spacing.xyz-p.offset.xyz;
  departure[d]=vec4<f32>(b,0.);
  stage[d]=sampleField(p.shape.w,b,false);
}
@compute @workgroup_size(128)
fn reverse(@builtin(global_invocation_id) gid:vec3<u32>) {
  let d=gid.x;
  if(d>=p.dims.x*p.dims.y*p.dims.z){return;}
  let q=location(d);
  if(onNormalWall(q)){backward[d]=0.;return;}
  let position=(vec3<f32>(q)+p.offset.xyz)*p.spacing.xyz;
  let b=trace(position,-p.spacing.w)/p.spacing.xyz-p.offset.xyz;
  backward[d]=sampleField(p.shape.w,b,true);
}
@compute @workgroup_size(128)
fn corrected(@builtin(global_invocation_id) gid:vec3<u32>) {
  let d=gid.x;
  if(d>=p.dims.x*p.dims.y*p.dims.z){return;}
  let q=location(d);
  if(onNormalWall(q)){result[p.dims.w+d]=0.;return;}
  let dims=p.dims.xyz;
  let plane=dims.x*dims.y;
  let pos=clamp(departure[d].xyz,vec3<f32>(0.),vec3<f32>(dims-vec3<u32>(1u)));
  let a=min(vec3<u32>(pos),dims-vec3<u32>(2u));
  let corner=(a.z*dims.y+a.y)*dims.x+a.x;
  var lo=readOld(p.shape.w,corner);
  var hi=lo;
  for(var z:u32=0u;z<2u;z=z+1u){
    for(var y:u32=0u;y<2u;y=y+1u){
      for(var x:u32=0u;x<2u;x=x+1u){
        let v=readOld(p.shape.w,corner+z*plane+y*dims.x+x);
        lo=min(lo,v);hi=max(hi,v);
      }
    }
  }
  let v=readOld(p.shape.w,d);
  let wall=p.physics.y;
  let xm=select(wall*v,readOld(p.shape.w,d-1u),q.x>0u);
  let xp=select(wall*v,readOld(p.shape.w,d+1u),q.x<dims.x-1u);
  let ym=select(v,readOld(p.shape.w,d-dims.x),q.y>0u); // zero tangential shear at top
  let yp=select(wall*v,readOld(p.shape.w,d+dims.x),q.y<dims.y-1u);
  let zm=select(wall*v,readOld(p.shape.w,d-plane),q.z>0u);
  let zp=select(wall*v,readOld(p.shape.w,d+plane),q.z<dims.z-1u);
  let lap=(xm-2.*v+xp)/(p.spacing.x*p.spacing.x)
         +(ym-2.*v+yp)/(p.spacing.y*p.spacing.y)
         +(zm-2.*v+zp)/(p.spacing.z*p.spacing.z);
  result[p.dims.w+d]=clamp(stage[d]+.5*(v-backward[d]),lo,hi)+p.spacing.w*p.physics.x*lap;
}
`;

const STORAGE = 0x0080, COPY_DST = 0x0008, COPY_SRC = 0x0004, MAP_READ = 0x0001, UNIFORM = 0x0040;
const align4 = n => (n+3)&~3;

export async function createTankGpuMomentum(){
  if(!globalThis.navigator?.gpu)return null;
  let adapter,device;
  try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});}catch{}
  if(!adapter)try{adapter=await navigator.gpu.requestAdapter();}catch{}
  if(!adapter)return null;
  try{device=await adapter.requestDevice();}catch{return null;}
  let lost=false,disposed=false,allocation=null,pending=Promise.resolve();
  const stats={allocations:0,steps:0};
  device.lost.then(()=>{lost=true;});
  const shader=device.createShaderModule({code:SHADER});
  const info=await shader.getCompilationInfo();
  const errors=info.messages.filter(message=>message.type==='error');
  if(errors.length){device.destroy();throw new Error(`GPU momentum shader: ${errors.map(e=>e.message).join('; ')}`);}
  const bindLayout=device.createBindGroupLayout({entries:Array.from({length:8},(_,binding)=>({binding,visibility:4,buffer:{type:binding===0?'uniform':binding<=3?'read-only-storage':'storage'}}))});
  const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[bindLayout]});
  const pipelines=Object.fromEntries(await Promise.all(['forward','reverse','corrected'].map(async name=>[name,await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module:shader,entryPoint:name}})])));
  function buffer(size,usage){return device.createBuffer({size:align4(size),usage});}
  function allocate(t){
    const counts=t.velocity.map(c=>c.data.length),max=Math.max(...counts),total=counts.reduce((a,b)=>a+b,0);
    if(allocation&&allocation.counts.every((n,i)=>n===counts[i]))return allocation;
    allocation?.buffers.forEach(b=>b.destroy());
    const old=counts.map(n=>buffer(n*4,STORAGE|COPY_DST));
    const stage=buffer(max*4,STORAGE),dep=buffer(max*16,STORAGE),back=buffer(max*4,STORAGE);
    const out=buffer(total*4,STORAGE|COPY_SRC),read=buffer(total*4,COPY_DST|MAP_READ),uniform=buffer(80,UNIFORM|COPY_DST);
    const buffers=[...old,stage,dep,back,out,read,uniform];
    const group=device.createBindGroup({layout:bindLayout,entries:[uniform,...old,stage,dep,back,out].map((b,i)=>({binding:i,resource:{buffer:b}}))});
    allocation={counts,total,max,old,stage,dep,back,out,read,uniform,buffers,group};stats.allocations++;return allocation;
  }
  async function run(t,dt){
    if(disposed||lost)throw new Error('GPU momentum device unavailable');
    device.pushErrorScope('validation');let scopeOpen=true;
    try{
    const a=allocate(t),offsets=[0,a.counts[0],a.counts[0]+a.counts[1]];
    for(let axis=0;axis<3;axis++)device.queue.writeBuffer(a.old[axis],0,Float32Array.from(t.velocity[axis].data));
    let encoder=device.createCommandEncoder();
    for(let axis=0;axis<3;axis++){
      const c=t.velocity[axis],params=new ArrayBuffer(80),v=new DataView(params);
      [t.nx,t.ny,t.nz,axis,...c.shape,offsets[axis]].forEach((n,i)=>v.setUint32(i*4,n,true));
      [...c.offset,0,t.dx,t.dy,t.dz,dt,t.viscosity,t.walls==='no-slip'?-1:1,0,0].forEach((n,i)=>v.setFloat32(32+i*4,n,true));
      // Uniform data must be distinct per axis within a single submission.
      // Submit each axis after updating its uniform to avoid overwrite races.
      device.queue.writeBuffer(a.uniform,0,params);
      for(const name of ['forward','reverse','corrected']){
        const pass=encoder.beginComputePass();pass.setPipeline(pipelines[name]);pass.setBindGroup(0,a.group);pass.dispatchWorkgroups(Math.ceil(c.data.length/128));pass.end();
      }
      // A command buffer records all three passes; the uniform is snapshotted
      // by the queue only on submit, so separate submissions are required.
      device.queue.submit([encoder.finish()]);
      if(axis<2){await device.queue.onSubmittedWorkDone();if(lost)throw new Error('GPU momentum device lost');}
      if(axis<2)encoder=device.createCommandEncoder();
    }
    const copy=device.createCommandEncoder();copy.copyBufferToBuffer(a.out,0,a.read,0,a.total*4);device.queue.submit([copy.finish()]);
    await a.read.mapAsync(MAP_READ);
    const values=new Float32Array(a.read.getMappedRange()).slice();a.read.unmap();
    const gpuError=await device.popErrorScope();scopeOpen=false;
    if(gpuError)throw new Error(`GPU momentum validation: ${gpuError.message}`);
    if(lost||disposed)throw new Error('GPU momentum device lost');
    for(const x of values)if(!Number.isFinite(x))throw new Error('Nonfinite GPU momentum result');
    for(let axis=0;axis<3;axis++)t.velocity[axis].next.set(values.subarray(offsets[axis],offsets[axis]+a.counts[axis]));
    stats.steps++;
    }catch(error){if(scopeOpen)await device.popErrorScope();throw error;}
  }
  return {backend:'webgpu-float32-momentum',stats,momentum(t,dt){const job=pending.then(()=>run(t,dt));pending=job.catch(()=>{});return job;},dispose(){disposed=true;allocation?.buffers.forEach(b=>b.destroy());device.destroy();},get deviceLost(){return lost;}};
}
