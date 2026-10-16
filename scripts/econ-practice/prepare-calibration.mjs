import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const csv=value=>`"${String(value??'').replaceAll('"','""')}"`;
export {prepare} from '../../src/lib/econ-practice/prepare-calibration.mjs';
import {prepare} from '../../src/lib/econ-practice/prepare-calibration.mjs';

export function writePrepared(prepared,directory){fs.mkdirSync(directory,{recursive:true});const {manifest,items,people,matrix}=prepared;const lines=[['person',...items].map(csv).join(','),...matrix.map((row,i)=>[sha(people[i]).slice(0,20),...row].map(csv).join(','))];const text=lines.join('\n')+'\n';const exportedManifest={...manifest,matrixArtifact:{file:'responses.csv',sha256:sha(text),encoding:'UTF-8',personKey:'SHA-256 truncated to 20 hexadecimal characters',missing:'empty CSV cell',rows:people.length,columns:items.length+1}};fs.writeFileSync(path.join(directory,'responses.csv'),text);fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(exportedManifest,null,2)+'\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [input,output,course,unit,version]=process.argv.slice(2);if(!version)throw new Error('Usage: node prepare-calibration.mjs INPUT.json OUTPUT_DIR COURSE UNIT BANK_VERSION');const raw=fs.readFileSync(input,'utf8'),data=JSON.parse(raw);const result=prepare(Array.isArray(data)?data:data.rows,{course,unit:Number(unit),bankVersion:version});result.manifest.sourceSHA256=sha(raw);writePrepared(result,output);console.log(JSON.stringify({ready:result.manifest.readyForCandidateFit,reasons:result.manifest.blockingReasons,people:result.people.length,items:result.items.length}));}
