import {createServer} from 'node:http';
import {readFileSync,mkdirSync,readdirSync} from 'node:fs';
import {Readable} from 'node:stream';
import worker from './worker.mjs';
import {createLocalDB} from './local-db.mjs';
mkdirSync('.local/econ-response',{recursive:true});
// A new synthetic database preserves the earlier browser-verification fixture.
const DB=createLocalDB('.local/econ-response/development-v2.sqlite');
DB.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const name of readdirSync(new URL('./migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
 if(await DB.prepare('SELECT name FROM local_migrations WHERE name=?').bind(name).first())continue;
 DB.exec('BEGIN');
 try{DB.exec(readFileSync(new URL(`./migrations/${name}`,import.meta.url),'utf8'));await DB.prepare('INSERT INTO local_migrations VALUES (?)').bind(name).run();DB.exec('COMMIT');}catch(error){DB.exec('ROLLBACK');throw error;}
}
const env={DB,ALLOWED_ORIGINS:'http://localhost:4321,http://127.0.0.1:4321',GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID,INSTRUCTOR_SUBJECT_HASHES:process.env.INSTRUCTOR_SUBJECT_HASHES};
createServer(async(req,res)=>{try{const request=new Request(`http://localhost:8787${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});const out=await worker.fetch(request,env);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));}catch{res.writeHead(500);res.end('Local response service error');}}).listen(8787,'127.0.0.1',()=>console.log('Local response service on http://127.0.0.1:8787'));
