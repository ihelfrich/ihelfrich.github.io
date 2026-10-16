import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutbox} from '../../src/scripts/econ-outbox.mjs';
function memory(){const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
const event=id=>({sessionId:'session',payload:{eventId:id,submittedAt:'2026-10-12T12:00:00Z',response:2}});
test('independent tabs cannot overwrite each other’s queued submissions',()=>{
 const storage=memory(),a=createOutbox(storage),b=createOutbox(storage),first=event('a'),second=event('b');
 assert.equal(a.list().length,0);assert.equal(b.list().length,0);a.enqueue(first);b.enqueue(second);assert.equal(a.list().length,2);
 a.acknowledge(first,{persisted:true,eventId:'a'});assert.deepEqual(b.list(),[second]);
});
test('acknowledgment requires a matching receipt and preserves changed events',()=>{
 const storage=memory(),queue=createOutbox(storage),a=event('a');queue.enqueue(a);
 assert.throws(()=>queue.acknowledge(a,{persisted:true,eventId:'b'}));assert.throws(()=>queue.acknowledge(a,{persisted:false,eventId:'a'}));assert.equal(queue.list().length,1);
 assert.throws(()=>queue.enqueue({...a,payload:{...a.payload,response:3}}),/conflict/);assert.deepEqual(queue.list(),[a]);
});
test('legacy queues migrate without losing answers and malformed legacy data remain intact',()=>{
 const storage=memory(),a=event('a');storage.setItem('econ-answer-outbox-v1',JSON.stringify([a]));const queue=createOutbox(storage);assert.deepEqual(queue.list(),[a]);assert.equal(storage.getItem('econ-answer-outbox-v1'),null);
 storage.setItem('econ-answer-outbox-v1','bad');assert.throws(()=>queue.list(),/preserved/);assert.equal(storage.getItem('econ-answer-outbox-v1'),'bad');
});
