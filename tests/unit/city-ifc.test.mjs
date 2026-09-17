import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {IfcAPI} from 'web-ifc';
import {Box3,Vector3,Matrix4} from 'three';
import {validateIfcFile,readIfcGeometry,readIfcProperties,IFC_LIMITS} from '../../src/lib/city-ifc.mjs';

test('local IFC admission rejects wrong formats, empty files, and oversized source before reading',()=>{
 assert.equal(validateIfcFile({name:'Building.IFC',size:100}),true);
 for(const file of [{name:'a.zip',size:100},{name:'a.ifc',size:0},{name:'a.ifc',size:IFC_LIMITS.fileBytes+1}])assert.throws(()=>validateIfcFile(file));
});
test('the invented IFC parses actual geometry and keeps exact element IDs and source properties',async()=>{
 const api=new IfcAPI();await api.Init();const bytes=new Uint8Array(await readFile(new URL('../../public/st-louis/models/example-pavilion.ifc',import.meta.url)));
 const result=readIfcGeometry(api,bytes);try{
  assert.equal(result.schema,'IFC4');assert.ok(result.elements.length>=9);assert.ok(result.parts.length>=result.elements.length);
  assert.ok(result.elements.some(x=>x.type==='IfcWall'));assert.ok(result.elements.some(x=>x.type==='IfcSlab'));assert.ok(result.elements.some(x=>x.type==='IfcColumn'));
  assert.equal(new Set(result.elements.map(x=>x.id)).size,result.elements.length);
  for(const geometry of result.geometries){assert.ok(geometry.vertices.length>0);assert.equal(geometry.vertices.length%6,0);assert.ok([...geometry.vertices].every(Number.isFinite));assert.ok(geometry.indices.length>0);}
  const bounds=new Box3();for(const part of result.parts){const vertices=result.geometries[part.geometryIndex].vertices,matrix=new Matrix4().fromArray(part.matrix);for(let i=0;i<vertices.length;i+=6)bounds.expandByPoint(new Vector3(vertices[i],vertices[i+1],vertices[i+2]).applyMatrix4(matrix));}
  const size=bounds.getSize(new Vector3());assert.ok(Math.abs(size.x-12.8)<1e-5);assert.ok(Math.abs(size.y-3.87)<1e-5);assert.ok(Math.abs(size.z-8.8)<1e-5,'IFC placements and model-unit scaling produce the intended invented pavilion');
  const wall=result.elements.find(x=>x.type==='IfcWall'),details=await readIfcProperties(api,result.modelId,wall.id);
  assert.equal(details.id,wall.id);assert.equal(details.globalId,wall.globalId);assert.ok(details.properties.some(p=>p.name==='Evidence'&&p.value.includes('Invented example')));
  assert.ok(details.properties.some(p=>p.name==='DesignNote'));
 }finally{api.CloseModel(result.modelId);api.Dispose();}
});
test('invalid STEP payload does not produce an empty successful model',async()=>{
 const api=new IfcAPI();await api.Init();try{assert.throws(()=>readIfcGeometry(api,new TextEncoder().encode('<html>Not an IFC</html>')),/IFC|STEP/);}finally{api.Dispose();}
});
test('decoded geometry budget failure closes the actual WASM model',async()=>{
 const api=new IfcAPI();await api.Init();const bytes=new Uint8Array(await readFile(new URL('../../public/st-louis/models/example-pavilion.ifc',import.meta.url)));
 try{assert.throws(()=>readIfcGeometry(api,bytes,{limits:{...IFC_LIMITS,geometryBytes:1}}),/128 MB/);assert.equal(api.IsModelOpen(0),false);}finally{api.Dispose();}
});
test('a reused geometry cannot bypass per-instance matrix validation and releases the model',()=>{
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];let closed=false,geometryReads=0;
 const part={geometryExpressID:42,color:{x:1,y:1,z:1,w:1},flatTransformation:identity};
 const api={OpenModel:()=>0,GetModelSchema:()=> 'IFC4',GetLine:()=>({Name:{value:'Shared geometry'}}),GetLineType:()=>1,GetNameFromTypeCode:()=> 'IfcWall',CloseModel(){closed=true;},StreamAllMeshes(_id,callback){for(const matrix of[identity,[...identity.slice(0,15),NaN]])callback({expressID:2,geometries:{size:()=>1,get:()=>({...part,flatTransformation:matrix})}},0,2);},GetGeometry(){geometryReads++;return{GetVertexData:()=>0,GetVertexDataSize:()=>18,GetIndexData:()=>0,GetIndexDataSize:()=>3,delete(){}};},GetVertexArray:()=>new Float32Array(18),GetIndexArray:()=>new Uint32Array([0,1,2])};
 assert.throws(()=>readIfcGeometry(api,new TextEncoder().encode("ISO-10303-21; HEADER; FILE_SCHEMA(('IFC4'));")),/placement matrix/);assert.equal(closed,true);assert.equal(geometryReads,1);
});
