import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';

test('participant ledger migration removes sort work and supports bounded range and high-water reads',async()=>{
 const DB=createLocalDB(),directory=new URL('../../services/econ-response/migrations/',import.meta.url);
 for(const file of readdirSync(directory).filter(n=>n.endsWith('.sql')&&n<'0003').sort())DB.exec(readFileSync(new URL(file,directory),'utf8'));
 const paging='SELECT r.* FROM responses r WHERE r.participant_id=? AND r.ledger_sequence>? AND r.ledger_sequence<=? ORDER BY r.ledger_sequence LIMIT 501';
 const plan=async(sql,args)=>(await DB.prepare('EXPLAIN QUERY PLAN '+sql).bind(...args).all()).results.map(r=>r.detail).join('\n');
 const before=await plan(paging,['participant',0,1000]);assert.match(before,/TEMP B-TREE/);
 DB.exec(readFileSync(new URL('0003_participant_ledger_index.sql',directory),'utf8'));
 const after=await plan(paging,['participant',0,1000]);assert.match(after,/response_participant_ledger/);assert.doesNotMatch(after,/TEMP B-TREE|SCAN r/);
 const highWater=await plan('SELECT COALESCE(MAX(ledger_sequence),0) FROM responses WHERE participant_id=?',['participant']);assert.match(highWater,/COVERING INDEX response_participant_ledger/);
 DB.close();
});
