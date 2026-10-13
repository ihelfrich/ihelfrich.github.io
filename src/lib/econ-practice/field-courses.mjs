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
// Explicit imports define active batches; the build audit verifies source-byte review hashes.
const batches=[[econometrics,econometricsRelease],[labor,laborRelease],[publicEconomics,publicRelease],[io,ioRelease],[trade,tradeRelease],[development,developmentRelease]];
// Hot module reload can preserve the bank registry while re-evaluating this module.
// Validate the entire replacement before removing only the courses owned here.
for(const [items,release] of batches)for(const q of items){
 if(q.course!==release.course||!release.reviewedIds.includes(q.id))throw new Error(`Unreviewed item: ${q.id}`);
}
const ownedCourses=new Set(batches.map(([,release])=>release.course));
const insertionIndex=families.findIndex(f=>ownedCourses.has(f.course));
for(let i=families.length-1;i>=0;i--)if(ownedCourses.has(families[i].course))families.splice(i,1);
const replacementStart=families.length;
for(const [items,release] of batches){
 for(const q of items){
  family(q.id,q.topic,q.title,2,i=>fieldQuestionAt(q,[],i,{skill:q.skill,...(q.scenarioType?{scenarioType:q.scenarioType}:{}),sourceUrls:q.sourceUrls,review:release.reviewStatus,reviewSourceSHA256:release.sourceSHA256}),q.course,1);
 }
}
// Preserve deterministic bank order as well as membership across a reload.
if(insertionIndex>=0){const replacement=families.splice(replacementStart);families.splice(insertionIndex,0,...replacement);}
