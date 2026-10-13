import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import {replayHistory} from '../../services/econ-response/history.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';

test('history replay crosses 10000 answers without truncation and excludes other owners and late receipts',async()=>{
 const DB=createLocalDB();
 DB.exec(`CREATE TABLE responses(ledger_sequence INTEGER PRIMARY KEY,participant_id TEXT,presentation_id TEXT,session_id TEXT,attempt_number INTEGER,event_id TEXT,raw_answer_json TEXT,server_received_at TEXT,hints_used INTEGER,calibration_eligible INTEGER,validity TEXT);
 CREATE TABLE presentations(id TEXT PRIMARY KEY,item_snapshot_json TEXT);
 CREATE TABLE sessions(id TEXT PRIMARY KEY,mode TEXT);`);
 const item=buildBank().find(q=>q.format==='numeric');
 await DB.prepare('INSERT INTO presentations VALUES (?,?)').bind('q',JSON.stringify(item)).run();
 await DB.prepare('INSERT INTO sessions VALUES (?,?)').bind('s','practice').run();
 for(let i=1;i<=10005;i++)await DB.prepare('INSERT INTO responses VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(i,'owner','q','s',1,`e${i}`,JSON.stringify(item.answer),'2026-10-12T00:00:00.000Z',0,0,'valid').run();
 await DB.prepare('INSERT INTO responses VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(10006,'other','q','s',1,'other',JSON.stringify(item.answer),'2026-10-12T00:00:00.000Z',0,0,'valid').run();
 await DB.prepare('INSERT INTO responses VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(10007,'owner','q','s',1,'late',JSON.stringify(item.answer),'2026-10-12T00:00:00.000Z',0,0,'late-receipt').run();
 const state=await replayHistory({DB},'owner');assert.equal(state.history.length,10005);assert.equal(state.history.at(-1).eventId,'e10005');assert.equal(state.topics[`${item.course}:${item.topic}`].attempts,10005);assert.equal(state.history.filter(h=>h.firstExposure).length,1);
 DB.close();
});

test('indexed replay matches ordinary scoring including duplicates, assisted answers and family exposure',async()=>{
 const {newState,recordAnswer,createAnswerRecorder}=await import('../../src/lib/econ-practice/adaptive.mjs');
 const items=buildBank().filter(q=>q.course==='ap-micro').slice(0,90),plain=newState(),indexed=newState(),record=createAnswerRecorder(indexed);
 for(let i=0;i<items.length;i++){
  const item=items[i],options={eventId:`event-${i}`,response:item.format==='choice'?item.answerIndex:item.answer,mode:'assessment',at:1000+i,hints:i%3===0?1:0,sessionId:'session'};
  recordAnswer(plain,item,options);record(item,options);record(item,options);
 }
 assert.deepEqual(indexed,plain);
 const resumed=JSON.parse(JSON.stringify(indexed)),append=createAnswerRecorder(resumed),item=items[0];
 append(item,{eventId:'event-0',response:item.answer,at:2000});assert.deepEqual(resumed,indexed);
 append(item,{eventId:'new-event',response:item.answer,at:2000});assert.equal(resumed.history.at(-1).firstExposure,false);
});

test('replay excludes receipts arriving after its captured high-water mark',async()=>{
 const item=buildBank().find(q=>q.format==='numeric');let pages=0;
 const row=n=>({ledger_sequence:n,item_snapshot_json:JSON.stringify(item),raw_answer_json:JSON.stringify(item.answer),server_received_at:'2026-10-12T00:00:00Z',mode:'practice',hints_used:0,event_id:`e${n}`,session_id:'s',validity:'valid',calibration_eligible:0});
 const DB={prepare(sql){return {bind(...args){return {
 first:async()=>({last:501}),
 all:async()=>{assert.ok(sql.includes('r.ledger_sequence<=?'));const [owner,after,last]=args;assert.equal(owner,'owner');assert.equal(last,501);pages++;return {results:Array.from({length:502},(_,i)=>row(i+1)).filter(r=>r.ledger_sequence>after&&r.ledger_sequence<=last).slice(0,500)};}
 };}};}};
 const state=await replayHistory({DB},'owner');assert.equal(pages,2);assert.equal(state.history.length,501);assert.equal(state.history.at(-1).eventId,'e501');
});
