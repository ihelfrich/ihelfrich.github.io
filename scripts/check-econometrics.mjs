import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {load} from 'js-yaml';
import katex from 'katex';

const root=process.cwd(),source=path.join(root,'src/content/econometrics');
const files=(await readdir(source)).filter(f=>f.endsWith('.md')).sort();
assert.equal(files.length,12,'The edition promises twelve chapters');
let words=0,expressions=0,solutions=0;
const orders=[],chapters=[];
for(const file of files){
  const raw=await readFile(path.join(source,file),'utf8');
  const front=raw.match(/^---\n([\s\S]*?)\n---/); assert.ok(front,`${file}: frontmatter`);
  const meta=load(front[1]);orders.push(meta.order);chapters.push({id:file.replace(/\.md$/,''),...meta});
  assert.ok(Array.isArray(meta.requires)&&meta.requires.every(r=>Number.isInteger(r)&&r<meta.order),`${file}: requires lists earlier chapters`);
  let body=raw.slice(front[0].length);words+=body.split(/\s+/).length;
  const count=(body.match(/class="solution"/g)||[]).length;
  assert.ok(count>=2,`${file}: two solved exercises`);solutions+=count;
  assert.ok(body.split(/\s+/).length>=650,`${file}: substantive text`);
  assert.ok(/https:\/\//.test(body),`${file}: linked sources`);
  body=body.replace(/~~~[\s\S]*?~~~/g,'').replace(/```[\s\S]*?```/g,'');
  body=body.replace(/\$\$([\s\S]*?)\$\$/g,(_,math)=>{katex.renderToString(math,{throwOnError:true,strict:'error',displayMode:true});expressions++;return '';});
  for(const match of body.matchAll(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g)){katex.renderToString(match[1],{throwOnError:true,strict:'error'});expressions++;}
}
assert.deepEqual(orders,[1,2,3,4,5,6,7,8,9,10,11,12]);
const measurementSource=path.join(root,'src/content/measurement');
const measurementFiles=(await readdir(measurementSource)).filter(f=>f.endsWith('.md')).sort();
assert.deepEqual(measurementFiles,['field-guide.md','story.md','technical.md']);
let measurementWords=0,measurementMath=0,measurementSolutions=0;
const measurementOrders=[];
for(const file of measurementFiles){
  const raw=await readFile(path.join(measurementSource,file),'utf8');
  const front=raw.match(/^---\n([\s\S]*?)\n---/);assert.ok(front,`${file}: frontmatter`);
  const meta=load(front[1]);measurementOrders.push(meta.order);
  assert.ok(meta.title&&meta.description,`${file}: reading metadata`);
  let body=raw.slice(front[0].length);const count=body.split(/\s+/).length;measurementWords+=count;
  assert.ok(count>=1200,`${file}: substantive companion`);
  const solved=(body.match(/class="solution"/g)||[]).length;measurementSolutions+=solved;
  if(file!=='story.md')assert.ok(solved>=3,`${file}: three fully solved exercises`);
  body=body.replace(/\$\$([\s\S]*?)\$\$/g,(_,math)=>{katex.renderToString(math,{throwOnError:true,strict:'error',displayMode:true});measurementMath++;return '';});
  for(const match of body.matchAll(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g)){katex.renderToString(match[1],{throwOnError:true,strict:'error'});measurementMath++;}
}
assert.deepEqual(measurementOrders.sort(),[1,2,3]);
const dist=path.join(root,'dist'),pages=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(entry.name.endsWith('.html'))pages.push(p);}}
await walk(path.join(dist,'econometrics'));
assert.equal(pages.length,22,'12 chapters, 6 course/support routes, and 4 measurement routes');
const docs=new Map();
async function documentFor(p){if(!docs.has(p)){const w=new Window();w.document.write(await readFile(p,'utf8'));docs.set(p,w);}return docs.get(p).document;}
for(const p of pages){
  const doc=await documentFor(p);
  assert.equal(doc.querySelectorAll('.katex-error').length,0,`${p}: math render`);
  assert.equal(doc.querySelectorAll('h1').length,1,`${p}: one primary heading`);
  assert.ok(doc.querySelector('link[rel=canonical]')?.getAttribute('href')?.startsWith('https://ihelfrich.github.io/econometrics/'),`${p}: canonical`);
  for(const anchor of doc.querySelectorAll('a[href]')){
    const href=anchor.getAttribute('href');if(!href.startsWith('/econometrics/')&&!href.startsWith('/teaching/'))continue;
    const url=new URL(href,'https://ihelfrich.github.io');
    let target=path.join(dist,decodeURIComponent(url.pathname));
    try {if((await stat(target)).isDirectory())target=path.join(target,'index.html');}
    catch {throw new Error(`${p}: broken local link ${href}`);}
    // The Distribution Lab keeps its state in #s=…, which is not an element id.
    if(url.hash && !url.hash.startsWith('#s=') && target.endsWith('.html'))assert.ok((await documentFor(target)).getElementById(decodeURIComponent(url.hash.slice(1))),`${p}: missing anchor ${href}`);
  }
}
// Titles lead with the method a reader searches for, and each chapter header states its objective.
const methodTerms={1:'identification',2:'conditional expectation',3:'least squares',4:'standard errors',5:'randomized',6:'missing data',7:'instrumental variables',8:'difference-in-differences',9:'regression discontinuity',10:'machine learning',11:'forecasting',12:'partial identification'};
assert.equal(new Set(chapters.map(c=>c.title)).size,12,'chapter titles are distinct');
for(const c of chapters){
  const doc=await documentFor(path.join(dist,'econometrics',c.id,'index.html'));
  const title=doc.querySelector('title')?.textContent||'';
  assert.ok(title.startsWith(c.title),`${c.id}: <title> starts with the chapter title`);
  assert.ok(title.toLowerCase().includes(methodTerms[c.order]),`${c.id}: <title> names ${methodTerms[c.order]}`);
  assert.equal(doc.querySelector('h1')?.textContent.trim(),c.title,`${c.id}: heading`);
  assert.ok(doc.querySelector('[data-chapter-objective]')?.textContent.includes(c.description),`${c.id}: objective under the title`);
}
for(const id of ['02-probability','03-projection','04-uncertainty']){
  const hrefs=[...(await documentFor(path.join(dist,'econometrics',id,'index.html'))).querySelectorAll('.ea-prose a[href]')].map(a=>a.getAttribute('href'));
  assert.ok(hrefs.some(h=>h.startsWith('/teaching/distributions/')||h.startsWith('/teaching/ols-assumptions/#')),`${id}: links the Distribution Lab or an OLS assumption panel`);
}
const labLinks=[...(await documentFor(path.join(dist,'econometrics/lab/index.html'))).querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
for(const href of ['/teaching/distributions/','/teaching/ols-assumptions/'])assert.ok(labLinks.includes(href),`lab page lists ${href}`);
assert.ok((await documentFor(path.join(dist,'econometrics/edition/index.html'))).getElementById('notation'),'edition notation table');
assert.ok((await documentFor(path.join(dist,'econometrics/print/index.html'))).getElementById('print-notation'),'print notation table');
for(const route of ['index.html','teaching/index.html'])assert.ok((await readFile(path.join(dist,route),'utf8')).includes('href="/econometrics/"'),`${route}: portfolio feature`);
assert.ok((await readFile(path.join(dist,'sitemap.xml'),'utf8')).includes('/econometrics/10-learning/'),'chapters in sitemap');
for(const w of docs.values())w.happyDOM.abort();
console.log(`Econometrics checks passed: ${files.length} chapters, ${words} source words, ${expressions} math expressions, ${solutions} solved exercises, ${pages.length} rendered routes and their course links.`);
console.log(`Measurement extension: ${measurementWords} source words, ${measurementMath} math expressions, ${measurementSolutions} solved exercises, three reading companions.`);
