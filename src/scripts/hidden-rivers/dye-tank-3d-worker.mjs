import {createDyeTank3D} from './dye-tank-3d.mjs';
import {instantiateTankKernels} from './tank-3d-kernels.mjs';
const acceleration=fetch('/hidden-rivers/dye-tank/tank-kernels.wasm').then(r=>{if(!r.ok)throw new Error('Kernel unavailable');return r.arrayBuffer();}).then(instantiateTankKernels).catch(()=>null);
let tank,version=0,queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 try{
  if(data.type==='reset'){const kernels=await acceleration;kernels?.reset();const next=createDyeTank3D({...data.options,kernels});if(data.drop)next.drop(data.drop);tank=next;version=data.version;}
  else if(data.version!==version||!tank)return;
  else if(data.type==='drop')tank.drop(data.drop);
  else if(data.type==='advance')for(let n=0;n<Math.min(2,Math.max(0,data.count));n++)tank.step(.01);
  const snapshot=tank.snapshot();self.postMessage({type:'frame',version,operation:data.type,request:data.request,snapshot},[snapshot.volume.buffer]);
 }catch(error){self.postMessage({type:'error',version:data.version,message:error.message});}
 });};
