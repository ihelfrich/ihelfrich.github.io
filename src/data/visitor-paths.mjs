export const visitorPaths = {
 learn: {
  label:'Learn or get unstuck', description:'Economics, statistics, research design, or code.', question:'Where would support help most?',
  options:[
   {id:'ideas',label:'Understanding a difficult idea',title:'Economics and statistics tutoring',body:'Individual instruction in economics, statistics, and econometrics. The open course includes worked examples and exercises.',href:'/econometrics/',resource:'Explore the open econometrics course'},
   {id:'code',label:'Working with data or code',title:'Programming and data analysis',body:'Help with Python, SQL, statistical software, debugging, and interpreting results.',href:'/projects/applied-statistics',resource:'Try the Applied Statistics workflow'},
   {id:'study',label:'Designing a study or dissertation',title:'Study and dissertation design',body:'Review the question, study design, data requirements, and analysis for a dissertation or research project.',href:'/teaching#coaching',resource:'See how research-design coaching works'}
  ]
 },
 research:{
  label:'Work on a research problem',description:'Study design, spatial environments, or analytical software.',question:'What kind of problem?',
  options:[
   {id:'design',label:'Empirical design or policy analysis',title:'Empirical research',body:'Research design and policy analysis. My NMTC paper compares rural and urban financing within the same intermediaries.',href:'/work#case-nmtc-rural-gap',resource:'See a place-based policy research example'},
   {id:'spatial',label:'Geography, trade, or measurement',title:'Trade and spatial measurement',body:'I study bilateral distance using population and night-light data and their role in gravity models of trade.',href:'/work#case-trade-in-the-spotlight',resource:'See the trade and spatial measurement work'},
   {id:'environment',label:'Ocean mapping or environmental visualization',title:'Oceanographic mapping',body:'3D seafloor mapping, ocean-current analysis, and visualization of scientific model outputs.',href:'/projects/oceanographic-systems',resource:'Explore oceanographic systems'},
   {id:'software',label:'Scientific software or audio tools',title:'Scientific and audio software',body:'Yellowjacket combines transcript editing, signal analysis, and music production in a browser.',href:'/projects/yellowjacket',resource:'Explore Yellowjacket'},
   {id:'analysis',label:'An analysis or research workflow',title:'Quantitative analysis',body:'Data preparation, quantitative analysis, and research software. Please describe the question, available data, and deadline.',href:'/work',resource:'Browse selected work'}
  ]
 },
 opportunity:{
  label:'Discuss a role or partnership',description:'Research, teaching, advisory work, or collaboration.',question:'What would you like to discuss?',
  options:[
   {id:'academic',label:'An academic or research role',title:'Academic and research roles',body:'My CV and research pages cover econometrics, applied economics, spatial analysis, and teaching.',href:'/job-market',resource:'View the candidate page and CV'},
   {id:'applied',label:'An applied role or project',title:'Applied research and consulting',body:'Selected research and software projects, with papers, code, and my role in each.',href:'/work',resource:'Explore selected cases'},
   {id:'teaching',label:'Teaching, a workshop, or a partnership',title:'Teaching and workshops',body:'Individual instruction, quantitative-methods workshops, and institutional teaching.',href:'/teaching',resource:'Explore teaching and coaching'}
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
