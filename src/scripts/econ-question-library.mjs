import {renderGraph} from '../lib/econ-practice/figures.mjs';
export function setupQuestionLibrary(request,document=globalThis.document){
 const $=id=>document.getElementById(id),form=$('question-library-form'),results=$('question-library-results'),status=$('question-library-status'),more=$('question-library-more');
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 let filter='',cursor='',bankVersion='',revision=0;

 function card(q){
  const detail=document.createElement('details');detail.className='question-library-item';
  detail.append(node('summary',`${q.id} · ${q.title}`),node('p',`${q.course} · Unit ${q.unit} · ${q.topicName} · Family ${q.family} · Variant ${q.variant}`),node('p',q.prompt));
  if(q.graph){const graph=document.createElement('div');graph.className='econ-graph';graph.innerHTML=renderGraph(q.graph);detail.append(graph);}
  if(q.options){const choices=document.createElement('ol');choices.type='A';q.options.forEach((option,index)=>choices.append(node('li',`${option}${index===q.answerIndex?' : correct answer':''}`)));detail.append(choices);}
  if(q.parts){for(const part of q.parts)detail.append(node('p',`${part.prompt??part.label??part.id}: ${part.answerDisplay??part.answer} (points ${part.points??1}). ${part.explanation??""}`));}
  else if(q.format==='numeric')detail.append(node('p',`Answer: ${q.answerDisplay??q.answer} · tolerance: ${q.tolerance}`));
  detail.append(node('h3','Explanation'),node('p',q.explanation),node('p',`Bank ${q.version} · Release status: ${q.review}. Author-specified difficulty is not an empirical IRT estimate.`));
  return detail;
 }
 async function load(reset){
  const ticket=++revision;
  if(reset){filter=new URLSearchParams({course:$('question-course').value,unit:$('question-unit').value,q:$('question-search').value}).toString();cursor='';bankVersion='';results.replaceChildren();}
  more.hidden=true;more.disabled=true;results.setAttribute('aria-busy','true');status.textContent='Loading questions…';
  try{const page=await request(`/admin/questions?${filter}&after=${encodeURIComponent(cursor)}${bankVersion?`&version=${encodeURIComponent(bankVersion)}`:''}`);if(ticket!==revision)return;
   if(bankVersion&&page.bankVersion!==bankVersion)throw new Error('The question bank changed. Start a new search.');
   bankVersion=page.bankVersion;
   for(const q of page.items)results.append(card(q));cursor=page.nextCursor??'';more.hidden=!page.hasMore;
   status.textContent=`${page.total} matching items across ${page.families} families. Showing ${results.children.length}. Bank ${page.bankVersion}.`;
  }catch(error){if(ticket===revision){status.textContent=error.message;if(!reset)more.hidden=false;}}finally{if(ticket===revision){results.setAttribute('aria-busy','false');more.disabled=false;}}
 }
 form.addEventListener('submit',event=>{event.preventDefault();load(true);});more.addEventListener('click',()=>load(false));
}
