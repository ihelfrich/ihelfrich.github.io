import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import {replayHistory} from '../../services/econ-response/history.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';

test('history replay crosses 10000 answers without truncation and excludes other owners and late receipts',async()=>{
 const DB=createLocalDB();
 DB.exec(`CREATE TABLE responses(ledger_sequence INTEGER PRIMARY KEY,participant_id TEXT,presentation_id TEXT,session_id TEXT,attempt_number INTEGER,event_id TEXT,raw_answer_json TEXT,server_received_at TEXT,hints_used INTEGER,calibration_eligible INTEGER,validity TEXT);
 CREATE TABLE presentations(id TEXT PRIMARY KEY,item_snapshot_json TEXT,model_version TEXT DEFAULT 'author-seeded-rasch-v1',measurement_parameters_json TEXT,first_family_exposure INTEGER,session_id TEXT);
 CREATE TABLE sessions(id TEXT PRIMARY KEY,mode TEXT);`);
 const item=buildBank().find(q=>q.format==='numeric');
 await DB.prepare('INSERT INTO presentations (id,item_snapshot_json) VALUES (?,?)').bind('q',JSON.stringify(item)).run();
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
 const row=n=>({model_version:'author-seeded-rasch-v1',measurement_parameters_json:null,ledger_sequence:n,item_snapshot_json:JSON.stringify(item),raw_answer_json:JSON.stringify(item.answer),server_received_at:'2026-10-12T00:00:00Z',mode:'practice',hints_used:0,event_id:`e${n}`,session_id:'s',validity:'valid',calibration_eligible:0});
 const DB={prepare(sql){return {bind(...args){return {
 first:async()=>({last:501}),
 all:async()=>{assert.ok(sql.includes('r.ledger_sequence<=?'));const [owner,after,last]=args;assert.equal(owner,'owner');assert.equal(last,501);pages++;return {results:Array.from({length:502},(_,i)=>row(i+1)).filter(r=>r.ledger_sequence>after&&r.ledger_sequence<=last).slice(0,500)};}
 };}};}};
 const state=await replayHistory({DB},'owner');assert.equal(pages,2);assert.equal(state.history.length,501);assert.equal(state.history.at(-1).eventId,'e501');
});

test('history replay uses stored measurement parameters rather than current authored difficulty',async()=>{
 const {prior,posteriorUpdate}=await import('../../src/lib/econ-practice/irt.mjs');
 const item=buildBank().find(q=>q.format==='numeric'),parameters={a:1.7,b:-.8,c:0,d:1,status:'calibrated',modelVersion:'fixture-model'};
 const row={first_family_exposure:1,presentation_session_id:'s',attempt_number:1,feedback_before_answer:0,ledger_sequence:1,item_snapshot_json:JSON.stringify(item),measurement_parameters_json:JSON.stringify(parameters),model_version:'fixture-model',raw_answer_json:JSON.stringify(item.answer),server_received_at:'2026-10-12T00:00:00Z',mode:'assessment',hints_used:0,event_id:'e',session_id:'s',validity:'valid',calibration_eligible:1};
 const DB={prepare(){return {bind(){return {first:async()=>({last:1}),all:async()=>({results:[row]})};}};}};
 const state=await replayHistory({DB},'owner');assert.deepEqual(state.posteriors[JSON.stringify(['s',item.course,item.unit])],posteriorUpdate(prior(),true,parameters));assert.equal(state.history[0].modelVersion,'fixture-model');assert.equal(state.history[0].parameterStatus,'calibrated');
 row.model_version='different-model';await assert.rejects(replayHistory({DB},'owner'),/does not match/);
 row.measurement_parameters_json=null;await assert.rejects(replayHistory({DB},'owner'),/unavailable/);
 row.measurement_parameters_json=JSON.stringify({...parameters,a:-1});await assert.rejects(replayHistory({DB},'owner'),/Invalid/);
});


test('persisted first-presentation assessment evidence survives reversed receipt ordering',async()=>{
 const item=buildBank().find(q=>q.format==='numeric');
 const base={item_snapshot_json:JSON.stringify(item),measurement_parameters_json:null,model_version:'author-seeded-rasch-v1',raw_answer_json:JSON.stringify(item.answer),server_received_at:'2026-10-12T00:00:00Z',hints_used:0,validity:'valid',attempt_number:1,feedback_before_answer:0};
 const assessment={...base,mode:'assessment',event_id:'a',session_id:'assessment',presentation_session_id:'assessment',first_family_exposure:1,calibration_eligible:1};
 const practice={...base,mode:'practice',event_id:'p',session_id:'practice',presentation_session_id:'practice',first_family_exposure:0,calibration_eligible:0};
 const replay=async rows=>{const events=rows.map((r,i)=>({...r,ledger_sequence:i+1}));return replayHistory({DB:{prepare(){return {bind(){return {first:async()=>({last:events.length}),all:async()=>({results:events})};}};}}},'owner');};
 const chronological=await replay([assessment,practice]),reversed=await replay([practice,assessment]);
 assert.deepEqual(reversed.posteriors,chronological.posteriors);
 assert.equal(reversed.history.find(h=>h.eventId==='a').psychometricEligible,true);
 assert.equal(reversed.history.find(h=>h.eventId==='a').firstExposure,false); // Receipt-order descriptive field only.
 assert.equal(reversed.history.find(h=>h.eventId==='p').psychometricEligible,false);
 for(const patch of [{first_family_exposure:0},{presentation_session_id:'other'},{attempt_number:2},{feedback_before_answer:1},{mode:'practice'},{hints_used:1},{validity:'rapid-response'}])await assert.rejects(replay([{...assessment,...patch}]),/inconsistent presentation provenance/);
 const ineligible=await replay([{...assessment,calibration_eligible:0}]);assert.deepEqual(ineligible.posteriors,{});
});

test('ordinary local recorder does not treat repeated assessment families as new evidence',async()=>{
 const {newState,recordAnswer}=await import('../../src/lib/econ-practice/adaptive.mjs');
 const item=buildBank().find(q=>q.format==='numeric'),state=newState();
 recordAnswer(state,item,{response:item.answer,mode:'practice',sessionId:'practice'});
 recordAnswer(state,item,{response:item.answer,mode:'assessment',sessionId:'assessment',measurementEligible:true});
 assert.equal(state.history.at(-1).psychometricEligible,false);assert.deepEqual(state.posteriors,{});
});


test('course/session scopes preserve selection and occasion estimates after linking and delayed receipts',async()=>{
 const {progress,selectItem}=await import('../../src/lib/econ-practice/adaptive.mjs');
 const DB=createLocalDB();
 DB.exec(`CREATE TABLE responses(ledger_sequence INTEGER PRIMARY KEY,participant_id TEXT,presentation_id TEXT,session_id TEXT,attempt_number INTEGER,event_id TEXT,raw_answer_json TEXT,server_received_at TEXT,hints_used INTEGER,calibration_eligible INTEGER,validity TEXT,feedback_before_answer INTEGER);
 CREATE TABLE presentations(id TEXT PRIMARY KEY,item_snapshot_json TEXT,model_version TEXT,measurement_parameters_json TEXT,first_family_exposure INTEGER,session_id TEXT);
 CREATE TABLE sessions(id TEXT PRIMARY KEY,mode TEXT,course TEXT,participant_id TEXT);`);
 const bank=buildBank(),item=bank.find(q=>q.course==='ap-micro'&&q.format==='numeric'),other=bank.find(q=>q.course!==item.course&&q.format==='numeric');
 const historical={a:1.4,b:-.7,c:0,d:1,status:'calibrated',modelVersion:'archived-fixture-model'};
 const add=async(sequence,owner,session,mode,q,eligible,parameters=null)=>{
  await DB.prepare('INSERT OR IGNORE INTO sessions VALUES (?,?,?,?)').bind(session,mode,q.course,owner).run();
  await DB.prepare('INSERT INTO presentations VALUES (?,?,?,?,?,?)').bind(`p${sequence}`,JSON.stringify(q),parameters?.modelVersion??'author-seeded-rasch-v1',parameters?JSON.stringify(parameters):null,eligible,session).run();
  await DB.prepare('INSERT INTO responses VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(sequence,owner,`p${sequence}`,session,1,`e${sequence}`,JSON.stringify(q.answer),'2026-10-12T00:00:00Z',0,eligible,'valid',0).run();
 };
 await add(1,'anonymous','practice','practice',item,0);
 const historicalItem=bank.find(q=>q.course===item.course&&q.family!==item.family&&q.format==='numeric');
 await add(2,'anonymous','historical','assessment',historicalItem,1,historical);
 await add(3,'anonymous','other-course','assessment',other,1);
 // This presentation was first even though its receipt arrives after practice.
 await add(4,'anonymous','current','assessment',item,1);
 await add(5,'unrelated-owner','unrelated','assessment',item,1);
 await DB.prepare("UPDATE responses SET participant_id='account' WHERE participant_id='anonymous'").run();
 await DB.prepare("UPDATE sessions SET participant_id='account' WHERE participant_id='anonymous'").run();
 const full=await replayHistory({DB},'account'),course=await replayHistory({DB},'account',{course:item.course}),occasion=await replayHistory({DB},'account',{course:item.course,sessionId:'current'});
 assert.equal(course.history.length,3);assert.equal(occasion.history.length,1);
 assert.deepEqual(course.history,full.history.filter(h=>h.course===item.course));
 assert.deepEqual(course.topics,Object.fromEntries(Object.entries(full.topics).filter(([key])=>key.startsWith(`${item.course}:`))));
 for(const mode of ['practice','assessment']){
  const options={course:item.course,mode,sessionId:'current',rng:()=>.37,now:12345};
  assert.deepEqual(selectItem(bank,course,options),selectItem(bank,full,options));
 }
 assert.deepEqual(progress(occasion,item.course,{sessionId:'current'}),progress(full,item.course,{sessionId:'current'}));
 const old=await replayHistory({DB},'account',{sessionId:'historical'});
 assert.equal(old.history[0].modelVersion,historical.modelVersion);
 assert.deepEqual(progress(old,item.course,{sessionId:'historical'}),progress(full,item.course,{sessionId:'historical'}));
 assert.equal((await replayHistory({DB},'account',{course:other.course,sessionId:'current'})).history.length,0);
 assert.equal((await replayHistory({DB},'anonymous',{course:item.course})).history.length,0);
 // A receipt arriving between the scoped high-water read and page read waits
 // until the next replay; scope predicates and ownership apply to both reads.
 let injected=false;
 const concurrent={prepare(sql){const prepared=DB.prepare(sql);return {bind(...args){const bound=prepared.bind(...args);return {...bound,first:async()=>{const value=await bound.first();if(!injected){injected=true;await add(6,'account','current','assessment',item,0);}return value;}};}};}};
 const pinned=await replayHistory({DB:concurrent},'account',{course:item.course,sessionId:'current'});
 assert.equal(pinned.history.length,1);
 assert.equal((await replayHistory({DB},'account',{course:item.course,sessionId:'current'})).history.length,2);
 DB.close();
});
