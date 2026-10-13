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
const batches=[[econometrics,econometricsRelease],[labor,laborRelease],[publicEconomics,publicRelease],[io,ioRelease],[trade,tradeRelease],[development,developmentRelease],[financial,financialRelease],[behavioral,behavioralRelease],[environmental,environmentalRelease]];
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
