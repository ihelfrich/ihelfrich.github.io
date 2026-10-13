export const courses = {
 'ap-micro': {name:'AP Microeconomics', units:['Choice and opportunity cost','Markets and price formation','Production and competitive firms','Market power and strategic behavior','Labor and other inputs','Welfare and public policy'], weights:[.135,.225,.235,.18,.115,.11]},
 'ap-macro': {name:'AP Macroeconomics', units:['Economic foundations','Measuring the economy','Aggregate demand and supply','Money and finance','Inflation, policy, and growth','International economics'], weights:[.075,.145,.22,.205,.24,.115]},
 'college-micro': {name:'Intermediate Microeconomics', units:['Preferences and choice','Demand and exchange','Technology and costs','Competition and market power','Strategic interaction','Welfare and information'],weights:[.2,.15,.15,.2,.15,.15]},
 'college-macro': {name:'Intermediate Macroeconomics', units:['National accounts','Long-run growth','Consumption and investment','Business cycles','Monetary and fiscal policy','Open-economy models'],weights:[.15,.2,.15,.2,.15,.15]},
 'intro-econometrics':{name:'Introductory Econometrics',units:['Data and estimands','Simple linear regression','Multiple regression and confounding','Inference and uncertainty','Functional forms and prediction','Introduction to causal designs'],weights:[1/6,1/6,1/6,1/6,1/6,1/6]},
 'labor-economics':{name:'Labor Economics',units:['Labor supply and participation','Labor demand and tax incidence','Human capital and signaling','Wage differences and discrimination','Monopsony, search, and institutions','Empirical methods and migration'],weights:[1/6,1/6,1/6,1/6,1/6,1/6]},
 'public-economics':{name:'Public Economics',units:['Welfare and policy objectives','Tax incidence','Tax efficiency and behavioral responses','Public goods and local finance','Social insurance','Redistribution and policy evaluation'],weights:[1/6,1/6,1/6,1/6,1/6,1/6]},
 'industrial-organization':{name:'Industrial Organization',units:['Market power, demand, and costs','Quantity and price competition','Differentiation, search, and advertising','Entry, dynamic competition, and collusion','Discrimination and vertical relations','Regulation, mergers, and platforms'],weights:[1/6,1/6,1/6,1/6,1/6,1/6]}
};
export const microTopics = {
 '1.1':'Scarcity','1.2':'Allocation and economic systems','1.3':'Production possibilities','1.4':'Comparative advantage','1.5':'Cost-benefit analysis','1.6':'Marginal analysis and consumer choice',
 '2.1':'Demand','2.2':'Supply','2.3':'Price elasticity of demand','2.4':'Price elasticity of supply','2.5':'Other elasticities','2.6':'Equilibrium and surplus','2.7':'Changes in equilibrium','2.8':'Government intervention','2.9':'International trade',
 '3.1':'Production functions','3.2':'Short-run costs','3.3':'Long-run costs','3.4':'Types of profit','3.5':'Profit maximization','3.6':'Short-run production and long-run exit','3.7':'Perfect competition',
 '4.1':'Market structure','4.2':'Monopoly','4.3':'Price discrimination','4.4':'Monopolistic competition','4.5':'Oligopoly and game theory',
 '5.1':'Factor markets','5.2':'Changes in factor demand and supply','5.3':'Competitive factor markets','5.4':'Monopsony',
 '6.1':'Efficiency','6.2':'Externalities','6.3':'Public and private goods','6.4':'Policy across market structures','6.5':'Inequality'
};
export const prerequisites = {'1.4':['1.3'],'1.6':['1.5'],'2.3':['2.1'],'2.4':['2.2'],'2.6':['2.1','2.2'],'2.7':['2.6'],'2.8':['2.6'],'2.9':['1.4','2.6'],'3.2':['3.1'],'3.5':['3.2','1.6'],'3.6':['3.5'],'3.7':['3.6'],'4.2':['3.5'],'4.3':['4.2'],'4.4':['3.7','4.2'],'4.5':['4.1'],'5.3':['3.1','1.6'],'5.4':['5.3'],'6.1':['2.6'],'6.2':['6.1'],'6.4':['6.2','4.2']};
// Topic numbers are local to a course. These are authored formative scaffolds,
// not empirically established prerequisite or mastery relationships.
export const prerequisitesByCourse={
 'ap-micro':prerequisites,
 'ap-macro':{'2.2':['2.1'],'3.2':['3.1'],'3.4':['3.1','3.3'],'4.3':['4.1'],'4.4':['4.1','4.2'],'5.2':['2.4','4.1'],'5.3':['2.1'],'6.2':['6.1'],'6.4':['4.2','6.1']},
 'college-micro':{'1.4':['1.1'],'2.1':['1.1','1.2'],'2.2':['1.1'],'3.2':['3.1'],'4.1':['3.1'],'4.2':['4.1','5.1'],'4.3':['4.1'],'5.2':['5.1'],'6.1':['3.1','4.1']},
 'college-macro':{'2.2':['2.1'],'2.3':['2.1'],'3.1':['3.2'],'4.1':['1.1'],'4.2':['4.1'],'5.1':['4.2'],'5.2':['1.1'],'6.1':['3.2'],'6.2':['1.1']}
};

// Operational scopes come from the course registry, not a fixed AP-sized unit count.
export function knownCourse(course){return typeof course==='string'&&Object.hasOwn(courses,course);}
export function validCourseUnit(course,unit,{allowAll=false}={}){
 return knownCourse(course)&&Number.isInteger(unit)&&unit>=(allowAll?0:1)&&unit<=courses[course].units.length;
}
