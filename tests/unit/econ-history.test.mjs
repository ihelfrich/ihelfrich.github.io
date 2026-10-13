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
