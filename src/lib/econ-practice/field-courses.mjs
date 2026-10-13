import econometrics from '../../../content/econ-drafts/intro-econometrics.json' with {type:'json'};
import release from '../../../content/econ-drafts/intro-econometrics-release.json' with {type:'json'};
import {family,choice} from './bank.mjs';
// Only explicitly reviewed batches are registered. Other draft files are not imported.
for(const q of econometrics){
 if(!release.reviewedIds.includes(q.id))throw new Error(`Unreviewed item: ${q.id}`);
 family(q.id,q.topic,q.title,2,()=>choice(q.prompt,q.correct,q.wrong,q.explanation,{skill:q.skill,sourceUrls:q.sourceUrls,review:release.reviewStatus,reviewSourceSHA256:release.sourceSHA256}),q.course,1);
}
