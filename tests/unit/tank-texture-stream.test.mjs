import test from 'node:test';
import assert from 'node:assert/strict';
import {createTankTextureStream} from '../../src/scripts/hidden-rivers/tank-texture-stream.mjs';
test('consecutive computed endpoints reuse textures without copying or mutating arrays',()=>{
 const uploads=[],gl={createTexture:()=>({}),bindTexture(){},texParameteri(){},texImage3D(...args){uploads.push(args.at(-1));},texSubImage3D(...args){uploads.push(args.at(-1));}};
 const stream=createTankTextureStream(gl,true),frame=x=>({nx:16,ny:16,nz:16,volume:new Float32Array(16**3*4).fill(x),vorticity:new Float32Array(16**3*4).fill(x+1)});
 const a=frame(0),b=frame(1),c=frame(2);stream.push(a,b);assert.equal(uploads.length,4);assert.equal(uploads[0],a.volume);assert.equal(uploads[3],b.vorticity);
 stream.push(b,c);assert.equal(uploads.length,6);assert.equal(uploads[4],c.volume);assert.equal(uploads[5],c.vorticity);stream.push(b,c);assert.equal(uploads.length,6);
 assert.equal(a.volume[0],0);assert.equal(b.volume[0],1);assert.equal(c.volume[0],2);assert.equal(stream.getStats().uploadBytes,6*16**3*4*4);
 stream.reset();stream.push(c,c);assert.equal(uploads.length,8);
});
