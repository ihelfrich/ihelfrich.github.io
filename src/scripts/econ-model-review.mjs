import {renderModelRelease} from './econ-model-release.mjs';
export async function renderModelReview(record,panel,request,status,doc=document){
 const node=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n;};
 const result=await request('/admin/model-packages/'+encodeURIComponent(record.id));
 if(result.artifact?.id!==record.id)throw new Error('Returned package identity did not match.');
 const artifact=result.artifact;
 panel.append(node('p',`${artifact.model} · ${Object.keys(artifact.parameters??{}).length} fitted items · Bank ${artifact.bankVersion}`));
 const evidence=node('details','');evidence.append(node('summary','Saved fit report and review evidence'));
 const pre=node('pre',JSON.stringify({report:artifact.report,review:artifact.review},null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';evidence.append(pre);panel.append(evidence);
 panel.append(node('p',`${result.approvalCount??0} recorded approvals. Approval alone does not activate this model.`));
 for(const approval of result.approvals??[])panel.append(node('p',`${approval.approved_at}: ${approval.rationale}`));
 if((result.approvalCount??0)>(result.approvals?.length??0))panel.append(node('p','Showing the most recent 100 approvals.'));
 const form=node('form',''),label=node('label','Approval rationale'),reason=doc.createElement('textarea');reason.required=true;reason.maxLength=2000;label.append(reason);
 const confirmLabel=node('label',''),confirm=doc.createElement('input');confirm.type='checkbox';confirm.required=true;confirmLabel.append(confirm,doc.createTextNode(' I have reviewed the saved fit, diagnostics, and evidence and approve this package.'));
 const approve=node('button','Record approval');approve.type='submit';form.append(label,confirmLabel,approve);
 form.addEventListener('submit',async event=>{event.preventDefault();if(!confirm.checked||!reason.value.trim()){status.textContent='Review confirmation and an approval rationale are required.';return;}approve.disabled=true;try{const saved=await request('/admin/model-packages/'+encodeURIComponent(record.id)+'/approve',{confirmApproval:true,rationale:reason.value.trim()});status.textContent=`Approval recorded: ${saved.approvalId}. Student scoring has not changed.`;form.remove();panel.append(node('p','Approval recorded. Reload evidence to see the saved history.'));}catch(error){status.textContent=error.message;}finally{approve.disabled=false;}});
 panel.append(form);
 await renderModelRelease(artifact,result.approvals??[],panel,request,status,doc);
}
