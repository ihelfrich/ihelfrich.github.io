export const visitorPaths = {
 learn: {
  label:'Learn or get unstuck', description:'Economics, statistics, research design, or code.', question:'Where would support help most?',
  options:[
   {id:'ideas',label:'Understanding a difficult idea',title:'Connect the idea to an example.',body:'Start with an explanation you can change and inspect. For individual support, bring the step that stops making sense.',href:'/econometrics/',resource:'Explore the open econometrics course'},
   {id:'code',label:'Working with data or code',title:'Make the analysis inspectable.',body:'See a complete inference workflow, then bring your own question about Python, SQL, statistical software, or interpretation.',href:'/projects/applied-statistics',resource:'Try the Applied Statistics workflow'},
   {id:'study',label:'Designing a study or dissertation',title:'Clarify the claim before the estimator.',body:'We can work through the question, target quantity, available evidence, and comparison your argument needs.',href:'/teaching#coaching',resource:'See how research-design coaching works'}
  ]
 },
 research:{
  label:'Work on a research problem',description:'Study design, spatial analysis, or quantitative evidence.',question:'What kind of problem?',
  options:[
   {id:'design',label:'Empirical design or policy analysis',title:'Start with the comparison.',body:'A useful first conversation identifies the decision, the evidence you have, and the uncertainty that matters.',href:'/work#case-nmtc-rural-gap',resource:'See a place-based policy research example'},
   {id:'spatial',label:'Geography, trade, or measurement',title:'Make the geography part of the question.',body:'My work connects economic activity, distance, spatial data, and the choices that turn observations into measures.',href:'/work#case-trade-in-the-spotlight',resource:'See the trade and spatial measurement work'},
   {id:'analysis',label:'An analysis or research workflow',title:'Connect the result to its reasoning.',body:'Bring the question, the intended output, and a description of your data or workflow. We can identify where a quantitative contribution would help.',href:'/work',resource:'Browse selected work'}
  ]
 },
 opportunity:{
  label:'Discuss a role or partnership',description:'Research, teaching, advisory work, or collaboration.',question:'What would you like to discuss?',
  options:[
   {id:'academic',label:'An academic or research role',title:'Start with the research record.',body:'My background combines econometrics, applied economics, spatial analysis, and quantitative teaching.',href:'/job-market',resource:'View the candidate page and CV'},
   {id:'applied',label:'An applied role or project',title:'See how I approach real questions.',body:'The selected cases describe the question, my contribution, the available evidence, and the limits of each result.',href:'/work',resource:'Explore selected cases'},
   {id:'teaching',label:'Teaching, a workshop, or a partnership',title:'Build researchers who can teach others.',body:'I work across individual coaching, institutional teaching, quantitative methods, and reusable public learning tools.',href:'/teaching',resource:'Explore teaching and coaching'}
  ]
 }
};
export function resolveVisitorPath(intent,focus){
 const path=Object.hasOwn(visitorPaths,intent)?visitorPaths[intent]:null;
 return path?{intent,path,option:path.options.find(option=>option.id===focus)||path.options[0]}:null;
}
export function visitorDraft(intent,focus,name='',question=''){
 const selected=resolveVisitorPath(intent,focus);if(!selected)return null;
 const subject=`${selected.path.label}: ${selected.option.label}`;
 const body=`Hello Ian,\n\nI’d like to discuss ${selected.option.label.toLowerCase()}.\n\n${question.trim()||'[My question, context, and timeline]'}\n\n${name.trim()||'[My name]'}`;
 return {subject,body,href:`mailto:ianthelfrich@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`};
}
