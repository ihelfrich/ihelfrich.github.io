import test from 'node:test';
import assert from 'node:assert/strict';
import {createIfcClient} from '../../src/lib/city-ifc-client.mjs';
function fixture(){const workers=[];const client=createIfcClient({workerFactory:()=>{const w={postMessage(m){this.sent=m;},terminate(){this.terminated=true;}};workers.push(w);return w;},timeoutMs:1000});return{client,workers};}
test('cancelling a parse terminates its worker and a stale response cannot satisfy the next model',async()=>{
 const {client,workers}=fixture(),first=client.load(new ArrayBuffer(1));const rejection=assert.rejects(first,{name:'AbortError'});client.cancel();await rejection;
 const next=client.load(new ArrayBuffer(2));workers[0].onmessage({data:{id:workers[0].sent.id,type:'result',result:{schema:'stale'}}});workers[1].onmessage({data:{id:workers[1].sent.id,type:'result',result:{schema:'current'}}});
 assert.equal((await next).schema,'current');assert.equal(workers[0].terminated,true);client.destroy();
});
test('worker failures reject pending source work and terminate the parser',async()=>{
 const {client,workers}=fixture(),load=client.load(new ArrayBuffer(1));const failed=assert.rejects(load,/could not run/);workers[0].onerror({preventDefault(){}});await failed;assert.equal(workers[0].terminated,true);client.destroy();
});
