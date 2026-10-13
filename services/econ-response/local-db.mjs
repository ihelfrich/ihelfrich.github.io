import {DatabaseSync} from 'node:sqlite';
export function createLocalDB(path=':memory:'){
 const sqlite=new DatabaseSync(path);
 const wrap=(sql,args=[])=>({bind:(...values)=>wrap(sql,values),first:async()=>sqlite.prepare(sql).get(...args)??null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>({success:true,meta:sqlite.prepare(sql).run(...args)})});
 return {prepare:sql=>wrap(sql),exec:sql=>sqlite.exec(sql),close:()=>sqlite.close(),batch:async statements=>{sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
