export function renderAnswerInputs(field,item){
 const doc=field.ownerDocument;field.disabled=false;field.replaceChildren();const legend=doc.createElement('legend');legend.textContent='Your answer';field.append(legend);
 function numeric(name,prompt){const label=doc.createElement('label'),input=doc.createElement('input');label.textContent=prompt;input.type='number';input.step='any';input.name=name;input.required=true;input.inputMode='decimal';input.setAttribute('aria-describedby',`${field.id||'economics-answer'}-guidance`);label.className='numeric-answer';label.append(input);field.append(label);}
 if(item.format==='choice')item.options.forEach((text,i)=>{const label=doc.createElement('label'),input=doc.createElement('input'),span=doc.createElement('span');input.type='radio';input.name='answer';input.value=String(i);input.required=true;label.className='choice-answer';span.textContent=text;label.append(input,span);field.append(label);});
 else if(item.format==='multipart')item.parts.forEach(p=>numeric(`part:${p.id}`,`${p.prompt} (${p.points} point${p.points===1?'':'s'})`));
 else numeric('answer','Numerical answer');
 if(item.format!=='choice'){const note=doc.createElement('p');note.id=`${field.id||'economics-answer'}-guidance`;note.className='answer-guidance';note.textContent='Use the requested units. Keep at least three decimal places when rounding.';field.append(note);}
}
export function readAnswerInputs(field,item){
 if(item.format==='choice'){const selected=field.querySelector('input:checked');if(!selected)throw new Error('Choose an answer first.');return Number(selected.value);}
 const inputs=[...field.querySelectorAll('input')];
 if(inputs.some(i=>i.value.trim()===''||!Number.isFinite(Number(i.value))))throw new Error('Enter a finite number for every part.');
 if(item.format==='multipart')return Object.fromEntries(item.parts.map(p=>{const input=inputs.find(i=>i.name===`part:${p.id}`);if(!input)throw new Error('A required answer field is missing.');return [p.id,input.value];}));
 return inputs[0].value;
}
export function formatResponse(item,response){
 if(item.format==='choice')return item.options[response];
 if(item.format==='multipart')return item.parts.map(p=>`${p.id}: ${response?.[p.id]??'unanswered'}`).join('; ');
 return String(response);
}
