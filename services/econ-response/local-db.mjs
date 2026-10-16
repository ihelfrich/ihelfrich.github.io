import {DatabaseSync} from 'node:sqlite';
export function createLocalDB(path=':memory:'){
 const sqlite=new DatabaseSync(path);
 const wrap=(sql,args=[])=>{
  const runSync=()=>({success:true,meta:sqlite.prepare(sql).run(...args)});
  return {bind:(...values)=>wrap(sql,values),first:async()=>sqlite.prepare(sql).get(...args)??null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>runSync(),runSync};
 };
 // SQLite's synchronous transaction must not yield between statements: another request
 // could otherwise issue BEGIN inside this transaction, unlike an atomic D1 batch.
 return {prepare:sql=>wrap(sql),exec:sql=>sqlite.exec(sql),close:()=>sqlite.close(),batch:async statements=>{sqlite.exec('BEGIN');try{const results=statements.map(s=>s.runSync());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
