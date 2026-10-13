import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {Readable} from 'node:stream';
import worker from './worker.mjs';
import {createLocalDB} from './local-db.mjs';
mkdirSync('.local/econ-response',{recursive:true});
const DB=createLocalDB('.local/econ-response/development.sqlite');
// Schema detection must await the async adapter.
await DB.prepare('SELECT id FROM participants LIMIT 1').first().catch(()=>DB.exec(readFileSync(new URL('./migrations/0001.sql',import.meta.url),'utf8')));
const env={DB,ALLOWED_ORIGINS:'http://localhost:4321,http://127.0.0.1:4321',ADMIN_TOKEN:process.env.ECON_ADMIN_TOKEN};
createServer(async(req,res)=>{try{const request=new Request(`http://localhost:8787${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});const out=await worker.fetch(request,env);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));}catch{res.writeHead(500);res.end('Local response service error');}}).listen(8787,'127.0.0.1',()=>console.log('Local response service on http://127.0.0.1:8787'));
