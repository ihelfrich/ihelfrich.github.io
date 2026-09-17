import {IfcAPI} from 'web-ifc';
import {readIfcGeometry,readIfcProperties} from '../../lib/city-ifc.mjs';
let api=null,modelId=null;
self.onmessage=async({data})=>{
 try{
  if(data.type==='load'){
   api=new IfcAPI();await api.Init(path=>new URL(`/vendor/web-ifc/${path}`,self.location.origin).href,true);
   const result=readIfcGeometry(api,new Uint8Array(data.bytes),{onProgress:progress=>self.postMessage({id:data.id,type:'progress',progress})});modelId=result.modelId;
   self.postMessage({id:data.id,type:'result',result},result.geometries.flatMap(g=>[g.vertices.buffer,g.indices.buffer]));
  }else if(data.type==='properties'){
   if(modelId===null)throw Error('Open a model before inspecting elements.');
   const result=await readIfcProperties(api,modelId,data.elementId);self.postMessage({id:data.id,type:'result',result});
  }
 }catch(error){self.postMessage({id:data.id,type:'error',message:error?.message||'The local IFC file could not be read.'});}
};
