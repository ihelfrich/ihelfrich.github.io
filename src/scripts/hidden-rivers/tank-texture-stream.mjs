// Two immutable computed endpoints. Reuse the preceding endpoint on each segment.
export function createTankTextureStream(gl,linear){
 const slots=Array.from({length:2},()=>({frame:null,grid:null,textures:[gl.createTexture(),gl.createTexture()]}));let pair=null,bytes=0,uploads=0;
 for(const slot of slots)for(const tex of slot.textures){gl.bindTexture(gl.TEXTURE_3D,tex);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,p,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,linear?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,linear?gl.LINEAR:gl.NEAREST);}
 function upload(slot,frame){
  const grid=frame.nx+'/'+frame.ny+'/'+frame.nz,resized=slot.grid!==grid;
  for(let i=0;i<2;i++){const data=i?frame.vorticity:frame.volume;gl.bindTexture(gl.TEXTURE_3D,slot.textures[i]);if(resized)gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA32F,frame.nx,frame.ny,frame.nz,0,gl.RGBA,gl.FLOAT,data||null);else if(data)gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,frame.nx,frame.ny,frame.nz,gl.RGBA,gl.FLOAT,data);if(data){bytes+=data.byteLength;uploads++;}}
  slot.frame=frame;slot.grid=grid;
 }
 return {
  push(from,to){
   if(pair&&pair.from===from&&pair.to===to)return pair.textures;
   let a=slots.find(s=>s.frame===from);if(!a){a=slots.find(s=>s.frame!==to)||slots[0];upload(a,from);}
   let b=from===to?a:slots.find(s=>s.frame===to);if(!b){b=slots.find(s=>s!==a);upload(b,to);}
   const textures=[a.textures[0],b.textures[0],a.textures[1],b.textures[1]];pair={from,to,textures};return textures;
  },
  getStats:()=>({uploadBytes:bytes,textureUploads:uploads}),
  reset(){pair=null;for(const s of slots)s.frame=null;}
 };
}
