import {createDyeTank} from './dye-tank.mjs';
let tank,version=0;
self.onmessage=({data})=>{
  try{
    if(data.type==='reset'){version=data.version;tank=createDyeTank(data.options);if(data.drop)tank.drop(data.drop);}
    else if(data.version!==version||!tank)return;
    else if(data.type==='drop')tank.drop(data.drop);
    else if(data.type==='advance')for(let i=0;i<Math.min(8,Math.max(0,data.count));i++)tank.step(.01);
    const snapshot=tank.snapshot();self.postMessage({type:'frame',version,operation:data.type,request:data.request,snapshot},[snapshot.salinity.buffer,snapshot.dye.buffer,snapshot.coral.buffer,snapshot.u.buffer,snapshot.v.buffer]);
  }catch(error){self.postMessage({type:'error',version,message:error.message});}
};
