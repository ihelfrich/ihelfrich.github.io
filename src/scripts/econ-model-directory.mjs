import {renderModelReview} from './econ-model-review.mjs';
import {courses} from '../lib/econ-practice/curriculum.mjs';
export function setupModelDirectory(request,download,doc=document){
 const $=id=>doc.getElementById(id),list=$('model-directory'),status=$('model-directory-status'),refresh=$('model-directory-refresh'),more=$('model-directory-more');
 let cursor='',busy=false;const seen=new Set();
 const node=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n;};
 async function load(reset=false){
  if(busy)return;busy=true;refresh.disabled=more.disabled=true;
  if(reset){cursor='';seen.clear();list.replaceChildren();more.hidden=true;}
  status.textContent='Loading saved candidates…';
  try{
   const page=await request(`/admin/model-packages?after=${encodeURIComponent(cursor)}`);
   if(!Array.isArray(page.packages)||page.hasMore&&(!page.nextCursor||page.nextCursor===cursor))throw new Error('Candidate list could not be continued. Refresh to try again.');
   for(const record of page.packages){
    if(seen.has(record.id))continue;seen.add(record.id);
    const card=node('article',''),title=node('h3',`${courses[record.course]?.name??record.course} · Unit ${record.unit} · ${record.model}`);
    card.append(title,node('p',`Bank ${record.bank_version} · Registered ${record.created_at}`),node('p',record.activated?'Selected for new assessments in this bank, course and unit.':'Not selected for new assessments. Review approval and release separately.'));
    const id=node('p',record.id);id.style.overflowWrap='anywhere';card.append(id);
    const button=node('button','Download registered package');button.type='button';button.className='secondary';
    button.addEventListener('click',async()=>{button.disabled=true;try{const result=await request(`/admin/model-packages/${encodeURIComponent(record.id)}`);if(result.artifact?.id!==record.id)throw new Error('Returned package identity did not match.');download(result.artifact,`${record.id}.json`);status.textContent='Registered package downloaded. Keep its response and review evidence private.';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
    const inspect=node('button','Review evidence, approval and release');inspect.type='button';inspect.className='secondary';const panel=node('div','');
    inspect.addEventListener('click',async()=>{inspect.disabled=true;panel.replaceChildren();try{await renderModelReview(record,panel,request,status,doc);}catch(error){status.textContent=error.message;}finally{inspect.disabled=false;}});
    card.append(button,inspect,panel);list.append(card);
   }
   cursor=page.nextCursor??cursor;more.hidden=!page.hasMore;
   status.textContent=seen.size?`${seen.size} saved candidates shown${page.hasMore?'; more are available.':'.'}`:'No calibration candidates have been registered.';
  }catch(error){status.textContent=error.message;}finally{busy=false;refresh.disabled=more.disabled=false;}
 }
 refresh.addEventListener('click',()=>load(true));more.addEventListener('click',()=>load());
 return {refresh:()=>load(true)};
}
