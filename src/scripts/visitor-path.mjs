import {resolveVisitorPath,visitorDraft} from '../data/visitor-paths.mjs';
export function mountVisitorPath(root){
 if(!root)return()=>{};
 const doc=root.ownerDocument,cleanups=[],radios=[...root.querySelectorAll('[name=visitor-intent]')],select=root.querySelector('[data-visitor-focus]');
 const on=(el,type,fn)=>{el?.addEventListener(type,fn);cleanups.push(()=>el?.removeEventListener(type,fn));};
 let intent='';
 const updateDraft=()=>{const draft=visitorDraft(intent,select.value,root.querySelector('[data-visitor-name]')?.value,root.querySelector('[data-visitor-question]')?.value);if(!draft||root.dataset.compose!=='true')return;root.querySelector('[data-draft-subject]').textContent=draft.subject;root.querySelector('[data-draft-body]').textContent=draft.body;root.querySelector('[data-visitor-email]').href=draft.href;};
 const render=()=>{
  const selected=resolveVisitorPath(intent,select.value);if(!selected)return;
  root.querySelector('[data-visitor-title]').textContent=selected.option.title;
  root.querySelector('[data-visitor-body]').textContent=selected.option.body;
  const resource=root.querySelector('[data-visitor-resource]');resource.textContent=selected.option.resource;resource.href=selected.option.href;
  const contact=root.querySelector('[data-visitor-contact]');if(contact)contact.href=`/contact?intent=${intent}&focus=${selected.option.id}`;
  root.querySelector('[data-visitor-next]').hidden=false;
  const compose=root.querySelector('[data-visitor-compose]');if(compose)compose.hidden=false;
  updateDraft();
 };
 const choose=(value,focus)=>{
  const selected=resolveVisitorPath(value,focus);if(!selected)return;
  intent=selected.intent;const pickerLabel=root.querySelector('[data-visitor-picker-label]');if(pickerLabel)pickerLabel.textContent=`${selected.path.label} — change purpose`;for(const radio of radios)radio.checked=radio.value===intent;
  root.querySelector('[data-focus-label]').textContent=selected.path.question;
  select.replaceChildren(...selected.path.options.map(item=>{const option=doc.createElement('option');option.value=item.id;option.textContent=item.label;return option;}));
  select.value=selected.option.id;render();
 };
 for(const radio of radios)on(radio,'change',()=>{if(radio.checked)choose(radio.value);});
 on(select,'change',render);on(root.querySelector('[data-visitor-name]'),'input',updateDraft);on(root.querySelector('[data-visitor-question]'),'input',updateDraft);
 root.querySelector('[data-visitor-controls]').hidden=false;root.querySelector('[data-visitor-fallback]').hidden=true;
 const checked=radios.find(radio=>radio.checked);if(checked)choose(checked.value,select.value);else if(root.dataset.compose==='true'){const params=new URLSearchParams(doc.defaultView.location.search);choose(params.get('intent'),params.get('focus'));if(intent)root.querySelector('[data-visitor-picker]').open=false;}
 return()=>cleanups.forEach(fn=>fn());
}
