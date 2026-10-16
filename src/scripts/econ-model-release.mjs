export async function renderModelRelease(artifact,approvals,panel,request,status,doc=document){
 const node=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n;};
 const scope={bankVersion:artifact.bankVersion,course:artifact.course,unit:artifact.unit};
 const response=await request('/admin/model-releases?'+new URLSearchParams(scope));
 if(response.bankVersion!==scope.bankVersion||response.course!==scope.course||response.unit!==scope.unit)throw new Error('Release scope did not match this package.');
 const current=response.current;
 const history=node('details',''),historyList=node('ol','');history.append(node('summary','Release decision history'),historyList);
 const showHistory=rows=>{for(const row of rows){historyList.append(node('li',`Revision ${row.revision} · ${row.released_at} · ${row.approval_id?'Selected approval '+row.approval_id:'Withdrew calibration'} · ${row.rationale}`));}};
 showHistory(response.history??[]);let before=response.nextBefore;
 const more=node('button','Show earlier decisions');more.type='button';more.hidden=!response.hasMore;history.append(more);
 more.addEventListener('click',async()=>{more.disabled=true;try{const page=await request('/admin/model-releases?'+new URLSearchParams({...scope,before}));if(page.bankVersion!==scope.bankVersion||page.course!==scope.course||page.unit!==scope.unit||!Array.isArray(page.history)||page.hasMore&&(!page.nextBefore||page.nextBefore>=before))throw new Error('Release history could not be continued. Reload this review.');showHistory(page.history);before=page.nextBefore;more.hidden=!page.hasMore;}catch(error){status.textContent=error.message;}finally{more.disabled=false;}});
 const section=node('section','');section.append(node('h4','Use in new assessments'));
 section.append(node('p',current?.approval_id?`An approved calibration is selected for this bank, course and unit (revision ${current.revision}).`:'New assessments use provisional parameters for this bank, course and unit.'));
 if(current)section.append(node('p',`Last decision: ${current.released_at}. ${current.rationale}`));
 section.append(node('p','Changes apply to new assessments. Assessments already started keep their original models. Coverage checks can prevent a start if a released model has too few question families.'));
 if(!approvals.length&&!current?.approval_id){section.append(history);section.append(node('p','Record an approval, then reload this review to enable release.'));panel.append(section);return;}
 section.append(history);
 const form=node('form',''),choice=doc.createElement('select'),choiceLabel=node('label','Release decision');choice.required=true;
 const blank=node('option','Choose a decision');blank.value='';choice.append(blank);
 for(const approval of approvals){const option=node('option',`Use this package: approval ${approval.approved_at}`);option.value=approval.id;choice.append(option);}
 if(current?.approval_id){const option=node('option','Withdraw calibration and use provisional parameters');option.value='withdraw';choice.append(option);}
 choiceLabel.append(choice);
 const reason=doc.createElement('textarea'),reasonLabel=node('label','Reason for this release decision');reason.required=true;reason.maxLength=2000;reasonLabel.append(reason);
 const confirm=doc.createElement('input');confirm.type='checkbox';confirm.required=true;const label=node('label','');label.append(confirm,doc.createTextNode(' I intend to change the model selected for new assessments in this bank, course and unit.'));
 const submit=node('button','Save release decision');submit.type='submit';form.append(choiceLabel,reasonLabel,label,submit);
 form.addEventListener('submit',async event=>{event.preventDefault();if(!choice.value||!reason.value.trim()||!confirm.checked){status.textContent='Choose a decision, provide a reason, and confirm its effect on new assessments.';return;}submit.disabled=true;try{
  const result=await request('/admin/model-releases',{...scope,approvalId:choice.value==='withdraw'?null:choice.value,expectedReleaseId:current?.id??null,rationale:reason.value.trim(),confirmRelease:true});
  if(result.release?.bank_version!==scope.bankVersion||result.release?.course!==scope.course||result.release?.unit!==scope.unit)throw new Error('Unexpected release receipt. Reload to verify the saved decision.');
  form.remove();section.append(node('p',`Saved revision ${result.release.revision}. Reload this review to see the current release.`));status.textContent='Release decision saved. Existing assessments retain their original models.';
 }catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
 section.append(form);panel.append(section);
}
