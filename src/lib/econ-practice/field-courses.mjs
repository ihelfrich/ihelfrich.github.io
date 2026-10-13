import econometrics from '../../../content/econ-drafts/intro-econometrics.json' with {type:'json'};
import econometricsRelease from '../../../content/econ-drafts/intro-econometrics-release.json' with {type:'json'};
import labor from '../../../content/econ-drafts/labor-economics.json' with {type:'json'};
import laborRelease from '../../../content/econ-drafts/labor-economics-release.json' with {type:'json'};
import publicEconomics from '../../../content/econ-drafts/public-economics.json' with {type:'json'};
import publicRelease from '../../../content/econ-drafts/public-economics-release.json' with {type:'json'};
import {family,choice} from './bank.mjs';
// Explicit imports define active batches; the build audit verifies source-byte review hashes.
for(const [items,release] of [[econometrics,econometricsRelease],[labor,laborRelease],[publicEconomics,publicRelease]]){
 for(const q of items){
  if(q.course!==release.course||!release.reviewedIds.includes(q.id))throw new Error(`Unreviewed item: ${q.id}`);
  family(q.id,q.topic,q.title,2,()=>choice(q.prompt,q.correct,q.wrong,q.explanation,{skill:q.skill,sourceUrls:q.sourceUrls,review:release.reviewStatus,reviewSourceSHA256:release.sourceSHA256}),q.course,1);
 }
}
