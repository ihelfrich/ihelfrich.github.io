import law from '../../../content/econ-drafts/law-economics.json' with {type:'json'};
import lawRelease from '../../../content/econ-drafts/law-economics-release.json' with {type:'json'};
import economicHistory from '../../../content/econ-drafts/economic-history.json' with {type:'json'};
import economicHistoryRelease from '../../../content/econ-drafts/economic-history-release.json' with {type:'json'};
import empiricalMacro from '../../../content/econ-drafts/empirical-macroeconomics.json' with {type:'json'};
import empiricalMacroRelease from '../../../content/econ-drafts/empirical-macroeconomics-release.json' with {type:'json'};
import statistics from '../../../content/econ-drafts/statistics-economics.json' with {type:'json'};
import statisticsRelease from '../../../content/econ-drafts/statistics-economics-release.json' with {type:'json'};
import advancedEconometrics from '../../../content/econ-drafts/advanced-econometrics.json' with {type:'json'};
import advancedEconometricsRelease from '../../../content/econ-drafts/advanced-econometrics-release.json' with {type:'json'};
import marketDesign from '../../../content/econ-drafts/market-design.json' with {type:'json'};
import marketDesignRelease from '../../../content/econ-drafts/market-design-release.json' with {type:'json'};
import contract from '../../../content/econ-drafts/contract-theory.json' with {type:'json'};
import contractRelease from '../../../content/econ-drafts/contract-theory-release.json' with {type:'json'};
import growth from '../../../content/econ-drafts/economic-growth.json' with {type:'json'};
import growthRelease from '../../../content/econ-drafts/economic-growth-release.json' with {type:'json'};
import education from '../../../content/econ-drafts/education-economics.json' with {type:'json'};
import educationRelease from '../../../content/econ-drafts/education-economics-release.json' with {type:'json'};
import causal from '../../../content/econ-drafts/causal-inference.json' with {type:'json'};
import causalRelease from '../../../content/econ-drafts/causal-inference-release.json' with {type:'json'};
import internationalMacro from '../../../content/econ-drafts/international-macroeconomics.json' with {type:'json'};
import internationalMacroRelease from '../../../content/econ-drafts/international-macroeconomics-release.json' with {type:'json'};
import monetary from '../../../content/econ-drafts/monetary-economics.json' with {type:'json'};
import monetaryRelease from '../../../content/econ-drafts/monetary-economics-release.json' with {type:'json'};
import gameTheory from '../../../content/econ-drafts/game-theory.json' with {type:'json'};
import gameTheoryRelease from '../../../content/econ-drafts/game-theory-release.json' with {type:'json'};
import advancedMacro from '../../../content/econ-drafts/advanced-macroeconomics.json' with {type:'json'};
import advancedMacroRelease from '../../../content/econ-drafts/advanced-macroeconomics-release.json' with {type:'json'};
import advancedMicro from '../../../content/econ-drafts/advanced-microeconomics.json' with {type:'json'};
import advancedMicroRelease from '../../../content/econ-drafts/advanced-microeconomics-release.json' with {type:'json'};
import urban from '../../../content/econ-drafts/urban-economics.json' with {type:'json'};
import urbanRelease from '../../../content/econ-drafts/urban-economics-release.json' with {type:'json'};
import political from '../../../content/econ-drafts/political-economy.json' with {type:'json'};
import politicalRelease from '../../../content/econ-drafts/political-economy-release.json' with {type:'json'};
import health from '../../../content/econ-drafts/health-economics.json' with {type:'json'};
import healthRelease from '../../../content/econ-drafts/health-economics-release.json' with {type:'json'};
import environmental from '../../../content/econ-drafts/environmental-economics.json' with {type:'json'};
import environmentalRelease from '../../../content/econ-drafts/environmental-economics-release.json' with {type:'json'};
import behavioral from '../../../content/econ-drafts/behavioral-economics.json' with {type:'json'};
import behavioralRelease from '../../../content/econ-drafts/behavioral-economics-release.json' with {type:'json'};
import financial from '../../../content/econ-drafts/financial-economics.json' with {type:'json'};
import financialRelease from '../../../content/econ-drafts/financial-economics-release.json' with {type:'json'};
import developmentExtensions from '../../../content/econ-drafts/development-economics-variants.json' with {type:'json'};
import tradeExtensions from '../../../content/econ-drafts/international-trade-variants.json' with {type:'json'};
import ioExtensions from '../../../content/econ-drafts/industrial-organization-variants.json' with {type:'json'};
import {replaceFieldVariantHints} from './field-variant-hints.mjs';
import development from '../../../content/econ-drafts/development-economics.json' with {type:'json'};
import developmentRelease from '../../../content/econ-drafts/development-economics-release.json' with {type:'json'};
import trade from '../../../content/econ-drafts/international-trade.json' with {type:'json'};
import tradeRelease from '../../../content/econ-drafts/international-trade-release.json' with {type:'json'};
import io from '../../../content/econ-drafts/industrial-organization.json' with {type:'json'};
import ioRelease from '../../../content/econ-drafts/industrial-organization-release.json' with {type:'json'};
import econometrics from '../../../content/econ-drafts/intro-econometrics.json' with {type:'json'};
import econometricsRelease from '../../../content/econ-drafts/intro-econometrics-release.json' with {type:'json'};
import labor from '../../../content/econ-drafts/labor-economics.json' with {type:'json'};
import laborRelease from '../../../content/econ-drafts/labor-economics-release.json' with {type:'json'};
import publicEconomics from '../../../content/econ-drafts/public-economics.json' with {type:'json'};
import publicRelease from '../../../content/econ-drafts/public-economics-release.json' with {type:'json'};
import {family,families} from './bank.mjs';
import {fieldQuestionAt} from './field-expansions.mjs';
import {auditFieldRelease} from './field-release.mjs';
// Explicit imports define active batches; the build audit verifies source-byte review hashes.
const batches=[[econometrics,econometricsRelease],[labor,laborRelease],[publicEconomics,publicRelease],[io,ioRelease],[trade,tradeRelease],[development,developmentRelease],[financial,financialRelease],[behavioral,behavioralRelease],[environmental,environmentalRelease],[health,healthRelease],[political,politicalRelease],[urban,urbanRelease],[advancedMicro,advancedMicroRelease],[advancedMacro,advancedMacroRelease],[gameTheory,gameTheoryRelease],[monetary,monetaryRelease],[internationalMacro,internationalMacroRelease],[causal,causalRelease],[education,educationRelease],[growth,growthRelease],[contract,contractRelease],[statistics,statisticsRelease],[advancedEconometrics,advancedEconometricsRelease],[marketDesign,marketDesignRelease],[law,lawRelease],[economicHistory,economicHistoryRelease],[empiricalMacro,empiricalMacroRelease]];
// Hot module reload can preserve the bank registry while re-evaluating this module.
// Validate the entire replacement before removing only the courses owned here.
const extensionsByCourse=new Map([['industrial-organization',ioExtensions],['international-trade',tradeExtensions],['development-economics',developmentExtensions]]);
for(const [items,release] of batches){
 const errors=auditFieldRelease(items,release,extensionsByCourse.get(release.course)??[]);
 if(errors.length)throw new Error(`Invalid field release ${release.course}: ${errors.join('; ')}`);
}
const ownedCourses=new Set(batches.map(([,release])=>release.course));
const insertionIndex=families.findIndex(f=>ownedCourses.has(f.course));
for(let i=families.length-1;i>=0;i--)if(ownedCourses.has(families[i].course))families.splice(i,1);
const replacementStart=families.length;
for(const [items,release] of batches){
 const extensions=extensionsByCourse.get(release.course)??[];
 replaceFieldVariantHints(release.course,extensions);
 const byBase=new Map(extensions.map(e=>[e.baseId,e.variants]));
 for(const q of items){
  const variants=byBase.get(q.id)??[];
  family(q.id,q.topic,q.title,2,i=>fieldQuestionAt(q,variants,i,{skill:q.skill,...(q.scenarioType?{scenarioType:q.scenarioType}:{}),sourceUrls:q.sourceUrls,review:release.reviewStatus,reviewSourceSHA256:release.sourceSHA256,...(i>0?{reviewExtensionSHA256:release.extensions.sourceSHA256}:{})}),q.course,1+variants.length,{numericExtensions:variants.length>0});
 }
}
// Preserve deterministic bank order as well as membership across a reload.
if(insertionIndex>=0){const replacement=families.splice(replacementStart);families.splice(insertionIndex,0,...replacement);}
