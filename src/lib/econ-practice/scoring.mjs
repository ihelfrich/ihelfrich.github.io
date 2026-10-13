// Rubric parts are distinct observations for feedback, not independent IRT items.
const finiteAnswer=value=>(typeof value==='number'||typeof value==='string')&&String(value).trim()!==''&&Number.isFinite(Number(value));
export function gradeResponse(item,response){
 if(item.format==='multipart'){
  if(!Array.isArray(item.parts)||item.parts.length===0||new Set(item.parts.map(p=>p.id)).size!==item.parts.length)throw new Error('Invalid multipart rubric');
  const object=response&&typeof response==='object'&&!Array.isArray(response)?response:{};
  const parts=item.parts.map(part=>{
   if(!Number.isFinite(part.points)||part.points<=0||!Number.isFinite(part.answer)||!Number.isFinite(part.tolerance)||part.tolerance<0)throw new Error('Invalid numeric rubric part');
   const correct=finiteAnswer(object[part.id])&&Math.abs(Number(object[part.id])-part.answer)<=part.tolerance;
   return {id:part.id,correct,earned:correct?part.points:0,possible:part.points};
  });
  const earned=parts.reduce((s,p)=>s+p.earned,0),possible=parts.reduce((s,p)=>s+p.possible,0);
  return {correct:earned===possible,score:earned/possible,earned,possible,parts};
 }
 const correct=item.format==='choice'?Number.isInteger(response)&&response>=0&&response<item.options.length&&response===item.answerIndex:finiteAnswer(response)&&Math.abs(Number(response)-item.answer)<=item.tolerance;
 return {correct,score:Number(correct),earned:Number(correct),possible:1};
}
export function publicQuestion(item){
 const {answer,answerDisplay,answerIndex,explanation,tolerance,parts,...visible}=item;
 if(parts)visible.parts=parts.map(({id,prompt,points})=>({id,prompt,points}));
 return visible;
}
export function responseFeedback(item,response){
 const result=gradeResponse(item,response);
 if(item.format==='multipart')return {...result,answer:item.parts.map(p=>`${p.id}: ${p.answerDisplay??p.answer}`).join('; '),explanation:item.explanation,parts:result.parts.map((p,i)=>({...p,answer:item.parts[i].answerDisplay??String(item.parts[i].answer),explanation:item.parts[i].explanation}))};
 return {...result,answer:item.format==='choice'?item.options[item.answerIndex]:item.answerDisplay,explanation:item.explanation};
}
export function validResponseShape(item,response){
 if(item.format==='choice')return Number.isInteger(response)&&response>=0&&response<item.options.length;
 if(item.format==='multipart')return !!response&&typeof response==='object'&&!Array.isArray(response)&&Object.keys(response).length===item.parts.length&&item.parts.every(p=>Object.hasOwn(response,p.id)&&finiteAnswer(response[p.id])&&String(response[p.id]).length<=100);
 return finiteAnswer(response)&&String(response).length<=100;
}
