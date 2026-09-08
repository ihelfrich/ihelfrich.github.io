const KEY='econometric-argument-v1';
export function initializeReading(){
  let state:{notes:Record<string,string>,completed:string[]}={notes:{},completed:[]}, storage=true;
  try {const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw && typeof raw.notes==='object' && raw.notes!==null && Array.isArray(raw.completed)){state={notes:Object.fromEntries(Object.entries(raw.notes).filter(([,v])=>typeof v==='string')),completed:raw.completed.filter(v=>typeof v==='string')};}}catch{storage=false;}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{storage=false;return false;}};
  document.querySelectorAll('[data-chapter-status]').forEach(el=>{if(state.completed.includes((el as HTMLElement).dataset.chapterStatus||''))el.textContent='explored ✓';});
  const progress=document.querySelector('[data-course-progress]');if(progress&&state.completed.length)progress.textContent=`${state.completed.length} chapters marked explored on this device.`;
  const chapter=document.querySelector('[data-reading-chapter]') as HTMLElement;
  if(chapter){
    const id=chapter.dataset.readingChapter!,note=chapter.querySelector('[data-reading-note]') as HTMLTextAreaElement,button=chapter.querySelector('[data-reading-complete]') as HTMLButtonElement,status=chapter.querySelector('[data-save-state]')!;
    note.value=state.notes[id]||'';
    const update=()=>{const done=state.completed.includes(id);button.setAttribute('aria-pressed',String(done));button.textContent=done?'Explored ✓ · undo':'Mark chapter explored';};update();
    note.addEventListener('input',()=>{state.notes[id]=note.value;status.textContent=save()?'Saved on this device.':'Browser storage is unavailable. Export your notes before leaving.';});
    button.addEventListener('click',()=>{state.completed=state.completed.includes(id)?state.completed.filter(v=>v!==id):[...state.completed,id];status.textContent=save()?'Progress saved on this device.':'Progress could not be saved in this browser.';update();});
    chapter.querySelector('[data-clear-note]')?.addEventListener('click',()=>{if(note.value&&!window.confirm('Clear this chapter’s saved note? Export it first if you want to keep a copy.'))return;delete state.notes[id];note.value='';status.textContent=save()?'This chapter’s note was cleared.':'Could not update browser storage.';});
    chapter.querySelector('[data-export-notes]')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({edition:'September 2026',exported:new Date().toISOString(),...state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-econometric-argument-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    if(!storage)status.textContent='Browser storage is unavailable. Notes can still be exported.';
  }
  const menu=document.querySelector('[data-mobile-contents]') as HTMLDetailsElement;
  if(menu && window.matchMedia('(max-width: 800px)').matches)menu.open=false;
  const search=document.querySelector('[data-chapter-search]') as HTMLInputElement;
  if(search)search.addEventListener('input',()=>{let count=0;document.querySelectorAll('[data-chapter-record]').forEach((el:HTMLElement)=>{el.hidden=!(el.dataset.search||'').includes(search.value.toLowerCase().trim());if(!el.hidden)count++;});(document.querySelector('[data-no-chapters]') as HTMLElement).hidden=count>0;});
  const paths={all:[],first:[1,2,3,4,5,6],applied:[1,4,6,8,10,11,12],theory:[2,3,4,7,10,12]};
  const descriptions={all:'Read in order, or follow a question. Every chapter states its prerequisites and links to the next step.',first:'Begin with chapters 1–6: turn a verbal question into a target, an estimator, and a defensible comparison. The highlighted chapters form your first pass.',applied:'A working-analyst path: revisit identification and uncertainty, audit measurement, then follow the design through panels, learning, forecasting, and a decision.',theory:'A formal path through expectation, projection, asymptotic inference, moment restrictions, orthogonal scores, and decision loss. Read the worked examples alongside the derivations.'};
  document.querySelectorAll('[data-path]').forEach((button:HTMLButtonElement)=>button.addEventListener('click',()=>{const key=button.dataset.path as keyof typeof paths;document.querySelectorAll('[data-path]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('[data-chapter-order]').forEach((el:HTMLElement)=>el.dataset.recommended=String(paths[key].includes(Number(el.dataset.chapterOrder))));const description=document.querySelector('[data-path-description]');if(description)description.textContent=descriptions[key];}));
  const openSolutions=()=>document.querySelectorAll('details').forEach(d=>d.open=true);
  document.querySelector('[data-print-book]')?.addEventListener('click',()=>{openSolutions();window.print();});
  window.addEventListener('beforeprint',openSolutions);
}
