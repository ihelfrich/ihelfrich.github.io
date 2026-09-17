export const IFC_LIMITS=Object.freeze({fileBytes:25*1024*1024,geometryBytes:128*1024*1024,parts:12000,elements:6000,triangles:2000000,properties:300,timeoutMs:45000});
const text=(v,max=600)=>typeof v==='string'?v.slice(0,max):'';
export function validateIfcFile(file){
 if(!file||typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.ifc'))throw Error('Choose an uncompressed .ifc file.');
 if(!Number.isFinite(file.size)||file.size<=0)throw Error('The IFC file is empty.');
 if(file.size>IFC_LIMITS.fileBytes)throw Error('This browser inspector accepts IFC files up to 25 MB.');
 return true;
}
function scalar(value){
 if(value==null)return null;
 if(typeof value==='string')return text(value);
 if(typeof value==='number')return Number.isFinite(value)?String(value):null;
 if(typeof value==='boolean')return String(value);
 if(typeof value==='object'&&'value'in value&&value.type!==5)return scalar(value.value);
 return null;
}
export function readIfcGeometry(api,bytes,{onProgress=()=>{},limits=IFC_LIMITS}={}){
 if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>limits.fileBytes)throw Error('IFC file exceeds the supported source limit.');
 const header=new TextDecoder().decode(bytes.subarray(0,4096));
 if(!/^\s*ISO-10303-21\s*;/i.test(header)||!header.includes('FILE_SCHEMA'))throw Error('This file is not an uncompressed IFC STEP model.');
 const modelId=api.OpenModel(bytes,{COORDINATE_TO_ORIGIN:true,CIRCLE_SEGMENTS:16,MEMORY_LIMIT:256*1024*1024});
 if(modelId<0)throw Error('The IFC parser could not open this model.');
 try{
  const schema=api.GetModelSchema(modelId);if(!schema)throw Error('Unsupported IFC schema.');
  const elements=[],parts=[],geometries=[],cache=new Map();let geometryBytes=0,triangles=0;
  api.StreamAllMeshes(modelId,(mesh,index,total)=>{
   if(elements.length>=limits.elements||parts.length+mesh.geometries.size()>limits.parts)throw Error('Model exceeds this inspector’s 6,000 element / 12,000 part limit.');
   const id=mesh.expressID,line=api.GetLine(modelId,id),type=api.GetNameFromTypeCode(api.GetLineType(modelId,id));
   elements.push({id,type,name:text(scalar(line?.Name),200)||`Element #${id}`,globalId:text(scalar(line?.GlobalId),100)||null});
   for(let i=0;i<mesh.geometries.size();i++){
    const placed=mesh.geometries.get(i),geometryId=placed.geometryExpressID;
    if(!placed.flatTransformation||placed.flatTransformation.length!==16||!Array.from(placed.flatTransformation).every(Number.isFinite))throw Error('IFC placement matrix is invalid.');
    if(!cache.has(geometryId)){
     const geometry=api.GetGeometry(modelId,geometryId);
     try{
      const vertexView=api.GetVertexArray(geometry.GetVertexData(),geometry.GetVertexDataSize()),indexView=api.GetIndexArray(geometry.GetIndexData(),geometry.GetIndexDataSize());
      geometryBytes+=vertexView.byteLength+indexView.byteLength;
      if(geometryBytes>limits.geometryBytes)throw Error('Decoded geometry exceeds the 128 MB browser budget.');
      if(vertexView.length%6||indexView.length%3)throw Error('IFC geometry contains invalid coordinates.');
      for(const n of vertexView)if(!Number.isFinite(n))throw Error('IFC geometry contains non-finite vertices.');
      for(const n of indexView)if(n>=vertexView.length/6)throw Error('IFC geometry contains an invalid vertex index.');
      cache.set(geometryId,geometries.length);geometries.push({vertices:vertexView.slice(),indices:indexView.slice()});
     }finally{geometry.delete();}
    }
    const geometryIndex=cache.get(geometryId);triangles+=geometries[geometryIndex].indices.length/3;
    if(triangles>limits.triangles)throw Error('Model exceeds the two-million-triangle browser budget.');
    const c=placed.color;parts.push({id,geometryIndex,matrix:Array.from(placed.flatTransformation),color:[c.x,c.y,c.z,c.w].map(n=>Number.isFinite(n)?Math.min(1,Math.max(0,n)):1)});
   }
   if(index%100===0)onProgress({current:index+1,total});
  });
  if(!parts.length)throw Error('No supported 3D geometry was found in this IFC.');
  return {modelId,schema,elements,parts,geometries,geometryBytes,triangles};
 }catch(error){api.CloseModel(modelId);throw error;}
}
export async function readIfcProperties(api,modelId,id){
 const line=api.GetLine(modelId,id);if(!line)throw Error('That element is unavailable in the current model.');
 const properties=[];const add=(group,name,value)=>{const s=scalar(value);if(s!==null&&properties.length<IFC_LIMITS.properties)properties.push({group:text(group,120),name:text(name,160),value:s});};
 for(const [name,value]of Object.entries(line))if(!['expressID','type'].includes(name))add('Element',name,value);
 const sets=await api.properties.getPropertySets(modelId,id,false);
 for(const set of sets.slice(0,60)){
  const group=scalar(set.Name)||'Property set';
  for(const reference of (set.HasProperties||set.Quantities||[]).slice(0,100)){
   const property=reference?.type===5?api.GetLine(modelId,reference.value):reference;
   if(!property)continue;const name=scalar(property.Name)||`Property #${reference.value}`;
   if(property.NominalValue!=null)add(group,name,property.NominalValue);
   else for(const [key,value]of Object.entries(property))if(/Value$/.test(key))add(group,`${name} · ${key}`,value);
  }
 }
 return {id,type:api.GetNameFromTypeCode(api.GetLineType(modelId,id)),name:scalar(line.Name),globalId:scalar(line.GlobalId),properties,limited:properties.length>=IFC_LIMITS.properties};
}
