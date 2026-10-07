#!/usr/bin/env node
/**
 * Reproducible 48-second film of the actual browser renderer.
 *
 * npm run build:fast
 * node scripts/hidden-rivers/record_observatory.cjs
 * node scripts/hidden-rivers/record_observatory.cjs --preview
 * node scripts/hidden-rivers/record_observatory.cjs --composite
 *
 * The capture uses explicit model times and camera coordinates for every frame.
 * It does not record a wall-clock animation or invent vertical trajectories.
 * ffmpeg and Playwright Chromium must be installed. Temporary frames go to /tmp.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'public/hidden-rivers');
const TMP = fs.mkdtempSync('/tmp/ocean-film-');
const arg = key => { const i = process.argv.indexOf(key); return i < 0 ? null : process.argv[i + 1]; };
const PREVIEW = process.argv.includes('--preview');
const FPS = Number(arg('--fps') || 24);
const WIDTH = 1920, HEIGHT = 1080, CHAPTER_SECONDS = 12;
const DAY = 86400;
const CHAPTERS = [
  { mode: 'flow', depth: 0, title: 'Following the current', kicker: '01 / TRANSPORT',
    text: 'Particles follow the evolving velocity field.\nBrighter colors mark faster horizontal motion.',
    note: 'SURFACE · SPEED IN m/s · RELIEF ×60', start: DAY, end: 5 * DAY, angle: [-.20, .08], elevation: [.71, .82], distance: [1.05, .98] },
  { mode: 'vorticity', depth: 0, title: 'The sense of rotation', kicker: '02 / ROTATION',
    text: 'Blue: clockwise. Coral: counterclockwise.\nPearl paths follow the modeled horizontal velocity.',
    note: 'SURFACE · VERTICAL RELATIVE VORTICITY · PEARL PATHS: TRAJECTORIES · RELIEF ×60', start: DAY, end: 5 * DAY, angle: [.08, .27], elevation: [.82, 1.02], distance: [1.00, .94] },
  { mode: 'stretching', depth: 0, title: 'Where neighbors separate', kicker: '03 / DEFORMATION',
    text: 'Forty-eight hours of trajectory separation.\nBright ridges identify stronger forward stretching.',
    note: 'SURFACE · FIXED START: 30 SEP · HORIZON: 48 HOURS · RELIEF ×60', start: DAY, end: DAY, angle: [.27, .08], elevation: [1.02, .79], distance: [.94, 1.00] },
  { mode: 'column', depth: 'all', title: 'Motion at three depths', kicker: '04 / THE WATER COLUMN',
    text: 'Surface, 200 m and 1,000 m, seen together.\nEach path stays on its sampled depth surface.',
    note: 'THREE HORIZONTAL LAYERS · 24-HOUR COMPARISON CADENCE · VERTICAL SCALE ×160', start: DAY, end: 5 * DAY, angle: [.08, -.19], elevation: [.66, .58], distance: [1.07, 1.02] },
];
const lerp = (a, b, p) => a + (b - a) * p;
const smooth = p => p * p * (3 - 2 * p);
const mime = ext => ({ '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2', '.bin':'application/octet-stream' }[ext] || 'application/octet-stream');
let server, browser, encoder, compositing=false;

async function localServer() {
  const dist = path.join(ROOT, process.argv.includes('--composite') || compositing ? 'public' : 'dist');
  if (!process.argv.includes('--composite') && !compositing && !fs.existsSync(path.join(dist, 'hidden-rivers/index.html'))) throw new Error('Build the site before recording.');
  server = http.createServer((req, res) => {
    if (new URL(req.url,'http://localhost').pathname === '/__film-plate') { res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><body></body></html>');return; }
    let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(dist + path.sep) && file !== dist) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': mime(path.extname(file)), 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}/hidden-rivers/?capture=1`;
}

async function installFilmFurniture(page) {
  await page.addStyleTag({ content: `
    .stage-heading,.stage-location,.stage-legend,#film-copy,#film-clock,#film-footer{transform:translateZ(0);backface-visibility:hidden;will-change:transform}
    html,body{margin:0!important;overflow:hidden!important;background:#000103!important}
    html.ocean-capture .ocean-stage{height:1080px!important;width:1920px!important;overflow:hidden!important}
    html.ocean-capture .stage-heading{left:80px!important;top:59px!important}
    html.ocean-capture .stage-heading .eyebrow{font-size:11px!important;letter-spacing:.18em!important}
    html.ocean-capture .stage-heading h1{font-size:96px!important;line-height:.8!important;margin:30px 0 0!important}
    html.ocean-capture .stage-deck,html.ocean-capture .stage-evidence,html.ocean-capture .stage-caption{display:none!important}
    html.ocean-capture .stage-location{top:65px!important;right:80px!important;font-size:16px!important}
    html.ocean-capture .stage-location small{font-size:10px!important}
    html.ocean-capture .stage-legend{right:80px!important;bottom:74px!important;width:270px!important;background:rgba(0,2,6,.7)!important;font-size:12px!important;padding:18px!important}
    html.ocean-capture .stage-legend small{font-size:10px!important;line-height:1.6!important}
    html.ocean-capture .stage-shade{background:linear-gradient(90deg,rgba(0,1,3,.93),transparent 37%),linear-gradient(0deg,rgba(0,1,3,.96),transparent 37%,transparent 90%,rgba(0,1,3,.35))!important}
    #film-copy{position:absolute;left:80px;bottom:112px;z-index:6;max-width:900px;color:#e2efea;pointer-events:none}
    #film-kicker{font:500 12px var(--font-data,monospace);letter-spacing:.21em;color:#80a5a9;margin:0 0 19px}
    #film-title{color:#e2efea!important;text-shadow:0 2px 16px #000103;font:400 46px/1.12 var(--font-text,serif);letter-spacing:-.018em;margin:0 0 16px}
    #film-text{font:400 17px/1.62 var(--font-display,sans-serif);white-space:pre-line;color:#a6bfc2;margin:0}
    #film-note{font:500 10px var(--font-data,monospace);letter-spacing:.1em;color:#719295;margin-top:24px}
    #film-speed{position:absolute;right:98px;bottom:261px;z-index:6;width:270px;font:400 10px var(--font-data,monospace);color:#9cbfc1}#film-speed>i{display:block;height:4px;margin:10px 0 6px;background:linear-gradient(90deg,#102e50,#17688b,#32c8cf,#a4f3c1,#fff0a4)}#film-speed>span{display:flex;justify-content:space-between;font-style:normal}#film-clock{position:absolute;top:124px;right:80px;z-index:6;font:400 13px var(--font-data,monospace);color:#adcdce;text-align:right}
    #film-progress{position:absolute;bottom:0;left:0;width:0;height:2px;background:#81ccc3;z-index:9;opacity:.8}
    #film-footer{position:absolute;left:80px;right:80px;bottom:39px;z-index:7;display:flex;justify-content:space-between;font:400 9px var(--font-data,monospace);letter-spacing:.05em;color:#638188}
    #film-fade{position:absolute;inset:0;z-index:10;background:#000103;opacity:0;pointer-events:none}
  ` });
  await page.evaluate(() => {
    const stage = document.querySelector('.ocean-stage');
    stage.insertAdjacentHTML('beforeend', `<div id="film-copy"><p id="film-kicker"></p><h2 id="film-title"></h2><p id="film-text"></p><p id="film-note"></p></div><div id="film-speed" hidden>TRAJECTORIES: HORIZONTAL SPEED<i></i><span><b>0</b><b>1</b><b>2+ m/s</b></span></div><div id="film-clock"></div><div id="film-progress"></div><div id="film-footer"><span>HYCOM ESPC-D-V02 · 3-HOUR VELOCITY FIELDS · NOAA ETOPO1</span><span>IMAGERY © ESRI, MAXAR, EARTHSTAR GEOGRAPHICS · ihelfrich.github.io/hidden-rivers</span></div><div id="film-fade"></div>`);
    document.querySelector('.stage-heading h1').innerHTML = 'Hidden<br/><em>Rivers</em>';
    window.scrollTo(0, 0);
  });
}

async function frame(page, chapter, index, frames) {
  const p = index / (frames - 1), e = smooth(p), c = CHAPTERS[chapter];
  const modelTime = lerp(c.start, c.end, p);
  // Camera progress uses elapsed film fraction. Integration uses model seconds.
  const pose = { angle: lerp(...c.angle, e), elevation: lerp(...c.elevation, e), distance: lerp(...c.distance, e) };
  const fade = Math.max(chapter === 0 ? 1 - p * CHAPTER_SECONDS / .8 : 0, chapter === 3 ? (p * CHAPTER_SECONDS - 11.2) / .8 : 0, p < .03 && chapter > 0 ? 1 - p / .03 : 0, p > .97 && chapter < 3 ? (p - .97) / .03 : 0);
  await page.evaluate(async ({ modelTime, pose, chapter, p, fade }) => {
    const api = window.__oceanExpedition, renderer = api.renderer;
    const effectiveTime = await api.setTime(modelTime);
    const base = window.__filmCamera, target = base.target, radius = Math.hypot(base.position[0] - target[0], base.position[1] - target[1], base.position[2] - target[2]) * pose.distance;
    renderer.setCamera({ position: [target[0] + Math.sin(pose.angle) * Math.cos(pose.elevation) * radius, target[1] + Math.sin(pose.elevation) * radius, target[2] + Math.cos(pose.angle) * Math.cos(pose.elevation) * radius], target });
    const d = new Date(Date.UTC(2026,8,29) + effectiveTime * 1000);
    document.querySelector('#film-clock').textContent = chapter === 2 ? '30 SEP → 02 OCT 2026 · 48 HOURS' : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    document.querySelector('#film-fade').style.opacity = Math.max(0, Math.min(1, fade));
    document.querySelector('#film-progress').style.width = `${(chapter + p) / 4 * 100}%`;
    document.querySelectorAll('.stage-heading,.stage-location,.stage-legend,#film-copy,#film-clock,#film-footer').forEach(node=>{node.style.transform=`translateZ(${Math.round(p*10000)%2 ? '.001' : '0'}px)`;});
    if (renderer.renderFrame) renderer.renderFrame();
    else renderer.snapshot();
  }, { modelTime, pose, chapter, p, fade });
}

async function chapter(page, index) {
  const c = CHAPTERS[index];
  await page.evaluate(async ({ c }) => {
    const api = window.__oceanExpedition;
    await api.setScene({ region:'agulhas', mode:c.mode, depth:c.depth, time:c.start, view:'oblique', film:false });
    await api.renderer.whenReady?.();
    api.renderer.setFilm(false); api.renderer.setPlaying(false);
    api.renderer.setExaggeration(c.mode === 'column' ? 160 : 60);
    api.renderer.resetView();
    window.__filmCamera = api.renderer.getCamera();
    document.querySelector('#film-speed').hidden = true;
    document.querySelector('#film-footer span').textContent = c.mode === 'column' ? 'HYCOM ESPC-D-V02 · DAILY COMPARISON FIELDS · NOAA ETOPO1' : 'HYCOM ESPC-D-V02 · 3-HOUR VELOCITY FIELDS · NOAA ETOPO1';
    for (const key of ['kicker', 'title', 'text', 'note']) document.querySelector(`#film-${key}`).textContent = c[key];
  }, { c });
}

async function main() {
  const url = arg('--url') || await localServer();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM || chromium.executablePath(), headless:true, args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport:{width:WIDTH,height:HEIGHT}, deviceScaleFactor:1, reducedMotion:'reduce' });
  const errors=[]; page.on('pageerror', err => errors.push(err.message));
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForFunction(() => window.__oceanExpedition?.ready, null, { timeout:300000 });
  await page.evaluate(() => { window.__oceanExpedition.renderer.setManualRendering?.(true); return document.fonts.ready; });
  await installFilmFurniture(page);
  const frames = Math.round(CHAPTER_SECONDS * FPS);
  if (!PREVIEW) {
    const destination = path.join(OUT, 'film-v3.mp4');
    encoder=spawn(process.env.FFMPEG || 'ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','title=Hidden Rivers | An Agulhas observatory','-metadata','comment=HYCOM ESPC-D-V02 analysis, 29 September–4 October 2026. Fixed-depth time-dependent trajectories; 48-hour forward FTLE. Camera motion is illustrative. No vertical trajectories.',destination],{stdio:['pipe','inherit','inherit']});
  }
  const started=Date.now();
  for(let ci=0;ci<CHAPTERS.length;ci++) {
    await chapter(page,ci);
    const indices=PREVIEW?[Math.floor(frames*.6)]:Array.from({length:frames},(_,i)=>i);
    for (const i of indices) {
      const frameStarted = Date.now();
      await frame(page,ci,i,frames);
      const drawMilliseconds = Date.now() - frameStarted;
      const buffer=await page.screenshot({type:'jpeg',quality:90,animations:'allow',timeout:120000});
      if(PREVIEW || i===Math.floor(frames*.6)) fs.writeFileSync(path.join(TMP,`chapter-${ci+1}.jpg`),buffer);
      if(!PREVIEW && !encoder.stdin.write(buffer)) await once(encoder.stdin,'drain');
      if(!PREVIEW && ci===0 && i===Math.floor(frames*.6))fs.writeFileSync(path.join(OUT,'film-v3-poster.jpg'),buffer);
      if(i<5 || i===10 || i===24 || i%48===0)console.log(JSON.stringify({chapter:ci+1,frame:i,frames,drawMilliseconds,frameMilliseconds:Date.now()-frameStarted,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
    }
  }
  if(encoder){encoder.stdin.end();const [code]=await once(encoder,'close');if(code!==0)throw new Error(`ffmpeg exited ${code}`);}
  if(errors.length)throw new Error(`Browser errors: ${errors.join('; ')}`);
  if(!PREVIEW) fs.writeFileSync(path.join(OUT,'film-v3.vtt'),`WEBVTT\n\n00:00.000 --> 00:12.000\nAgulhas retroflection. Surface particles follow HYCOM's evolving horizontal velocity field. Color gives speed in meters per second; seed density is not transport. Model time: 30 September–4 October 2026. Relief is exaggerated 60 times in the first three chapters.\n\n00:12.000 --> 00:24.000\nVertical relative vorticity: blue is clockwise, coral is counterclockwise. Color measures local rotation; it does not classify eddy boundaries. Pearl paths follow the modeled horizontal velocity.\n\n00:24.000 --> 00:36.000\n48-hour forward finite-time Lyapunov exponent, starting 30 September 2026 and ending 2 October. Brighter colors show stronger modeled trajectory separation. The field is held fixed as the camera moves.\n\n00:36.000 --> 00:48.000\nSurface, 200-meter and 1,000-meter horizontal trajectories. Each particle stays on its sampled depth surface. The comparison uses daily temporal samples. Vertical display scale is exaggerated 160 times. No vertical velocity is reconstructed.\n`);
  console.log(JSON.stringify({complete:true,preview:PREVIEW,temp:TMP,output:PREVIEW?null:path.join(OUT,'film-v3.mp4'),bytes:PREVIEW?null:fs.statSync(path.join(OUT,'film-v3.mp4')).size,seconds:48,fps:FPS,resolution:[WIDTH,HEIGHT]}));
}
async function compositeTypography() {
  compositing=true;
  // Software Chromium can lose cached glyphs during long WebGL capture. Render
  // the scientific annotations independently, then composite them deterministically.
  const destination = path.join(OUT, 'film-v3.mp4');
  const source = arg('--source') || destination;
  if (!fs.existsSync(source)) throw new Error('Record the film before compositing.');
  const url = await localServer();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM || chromium.executablePath(), headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const platePage = await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1});
  await platePage.goto(new URL('/__film-plate',url).href);
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT,'data/diagnostics.json'),'utf8'));
  const layer = manifest.regions.find(r=>r.id==='agulhas').layers.find(l=>l.depth===0);
  const schemes = {
    flow:{title:'Horizontal speed',units:'m/s',lo:0,hi:2,colors:['#102e50','#17688b','#32c8cf','#a4f3c1','#fff0a4'],note:'Color encodes speed. Seed density does not measure volume transport.'},
    vorticity:{title:'Vertical relative vorticity',units:'10⁻⁵ s⁻¹',lo:layer.fields.vorticity.displayDomain[0]*1e5,hi:layer.fields.vorticity.displayDomain[1]*1e5,colors:['#6857d8','#4bb4e3','#233344','#ffc57b','#ed655e'],note:'Negative: clockwise. Positive: counterclockwise. Pearl paths are trajectories.'},
    stretching:{title:'48-hour forward stretching',units:'day⁻¹',lo:layer.fields.ftle.displayDomain[0],hi:layer.fields.ftle.displayDomain[1],colors:['#080d20','#392867','#a7447b','#f38c61','#fff2b0'],note:'Forward FTLE. Fixed start30September; the trajectory window ends2October.'},
  };
  const esc = s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const label = n=>Math.abs(n)<.01?n.toFixed(3):Number(n.toFixed(2)).toString();
  const plates=[];
  for(let ci=0;ci<4;ci++){
    const c=CHAPTERS[ci],s=schemes[c.mode]||schemes.flow;
    await platePage.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:Geist;src:url('/fonts/geist-variable.woff2')}@font-face{font-family:Newsreader;src:url('/fonts/newsreader-variable.woff2')}@font-face{font-family:Mono;src:url('/fonts/geist-mono-variable.woff2')}
    *{box-sizing:border-box}html,body{width:1920px;height:1080px;margin:0;background:transparent;overflow:hidden;color:#e2efea;font-family:Geist,sans-serif}
    .top-left{position:absolute;left:0;top:0;width:440px;height:305px;background:linear-gradient(90deg,#000103 0%,#000103 85%,transparent);mask-image:linear-gradient(180deg,#000 0%,#000 89%,transparent)}
    .eyebrow-mask{position:absolute;left:0;top:0;width:540px;height:112px;background:linear-gradient(90deg,#000103 0%,#000103 91%,transparent)}
    .top-right{position:absolute;right:0;top:0;width:490px;height:190px;background:linear-gradient(270deg,#000103 0%,#000103 92%,transparent)}
    .bottom{position:absolute;bottom:45px;left:0;width:1100px;height:345px;background:linear-gradient(90deg,#000103 0%,#000103 85%,transparent);mask-image:linear-gradient(0deg,#000 0%,#000 78%,transparent)}
    .legend-mask{position:absolute;right:0;top:${ci===2?823:ci===3?853:845}px;bottom:45px;width:415px;background:linear-gradient(270deg,#000103 0%,#000103 91%,transparent)}
    .footer-mask{position:absolute;left:0;right:0;bottom:0;height:72px;background:linear-gradient(0deg,#000103 0%,#000103 76%,transparent)}
    .brand{position:absolute;top:70px;left:80px;font:500 11px Mono;letter-spacing:.18em;color:#a9bbbf}.brand:before{content:'';display:inline-block;width:22px;height:2px;background:#718ab1;vertical-align:middle;margin-right:10px}
    h1{position:absolute;left:80px;top:111px;font:500 96px/.79 Geist;letter-spacing:-7px;margin:0;color:#e8efed}h1 em{display:block;font:italic 400 106px/.85 Newsreader;letter-spacing:-7px}
    .region{position:absolute;top:65px;right:80px;text-align:right;font-size:16px}.region small{display:block;font:10px Mono;letter-spacing:.04em;margin-top:13px;color:#819aa3}
    .copy{position:absolute;left:80px;bottom:112px;width:1120px}.kicker{font:500 12px Mono;letter-spacing:.21em;color:#80a5a9;margin:0 0 19px}h2{font:400 46px/1.12 Newsreader;letter-spacing:-.018em;margin:0 0 16px}.text{font:400 17px/1.62 Geist;color:#a6bfc2;margin:0;white-space:pre-line}.note{font:500 10px Mono;letter-spacing:.1em;color:#719295;margin:24px 0 0}
    .legend{position:absolute;right:80px;bottom:77px;width:286px;font:12px/1.45 Mono;background:#000103}.legend .ramp{height:6px;margin:14px 0 8px;background:linear-gradient(90deg,${s.colors.join(',')})}.ticks{display:flex;justify-content:space-between;font-size:11px}.legend p{font:10px/1.6 Mono;color:#7b979f;margin:14px 0 0}
    footer{position:absolute;left:80px;right:80px;bottom:39px;display:flex;justify-content:space-between;font:9px Mono;letter-spacing:.02em;color:#638188}
    </style></head><body><div class="top-left"></div><div class="eyebrow-mask"></div><div class="top-right"></div><div class="bottom"></div><div class="legend-mask"></div><div class="footer-mask"></div><div class="brand">IAN HELFRICH / OCEANOGRAPHIC SYSTEMS</div><h1>Hidden<em>Rivers</em></h1><div class="region">Agulhas retroflection<small>SOUTH ATLANTIC / INDIAN OCEAN</small></div><div class="copy"><p class="kicker">${esc(c.kicker)}</p><h2>${esc(c.title)}</h2><p class="text">${esc(c.text)}</p><p class="note">${esc(c.note)}</p></div><div class="legend">${esc(s.title)}<div class="ramp"></div><div class="ticks"><span>${label(s.lo)}</span><span>${label((s.lo+s.hi)/2)}</span><span>${label(s.hi)} ${s.units}</span></div><p>${esc(s.note.replace('start30September','start 30 September').replace('ends2October','ends 2 October'))} Values outside this scale are color-clipped.</p></div><footer><span>HYCOM ESPC-D-V02 · ${ci===3?'DAILY COMPARISON FIELDS':'3-HOUR VELOCITY FIELDS'} · NOAA ETOPO1</span><span>IMAGERY © ESRI, MAXAR, EARTHSTAR GEOGRAPHICS · ihelfrich.github.io/hidden-rivers</span></footer></body></html>`);
    await platePage.evaluate(()=>document.fonts.ready);
    const file=path.join(TMP,`plate-${ci}.png`);await platePage.screenshot({path:file,omitBackground:true,animations:'allow'});plates.push(file);
  }
  await browser.close();browser=null;await new Promise(r=>server.close(r));server=null;
  const assTime = frame => { const n=Math.floor(frame/FPS*100);return `0:${String(Math.floor(n/6000)).padStart(2,'0')}:${String(Math.floor(n/100)%60).padStart(2,'0')}.${String(n%100).padStart(2,'0')}`; };
  let subtitles=`[Script Info]\nScriptType: v4.00+\nPlayResX:1920\nPlayResY:1080\nScaledBorderAndShadow:yes\n[V4+ Styles]\nFormat:Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle:Clock,DejaVu Sans Mono,15,&H00CECDAD,&H00CECDAD,&H00010300,&H00000000,0,0,0,0,100,100,0,0,1,0,0,9,0,80,126,1\n[Events]\nFormat:Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`;
  const count=Math.round(CHAPTER_SECONDS*FPS);
  for(let ci=0;ci<4;ci++)for(let i=0;i<count;i++){
    const p=i/(count-1),c=CHAPTERS[ci];let time=lerp(c.start,c.end,p);if(['vorticity','stretching'].includes(c.mode))time=Math.round(time/DAY)*DAY;
    const date=ci===2?'30 SEP → 02 OCT 2026 · 48 HOURS':new Date(Date.UTC(2026,8,29)+time*1000).toISOString().slice(0,16).replace('T',' ')+' UTC';
    const fade=Math.max(ci===0?1-p*CHAPTER_SECONDS/.8:0,ci===3?(p*CHAPTER_SECONDS-11.2)/.8:0,p<.03&&ci>0?1-p/.03:0,p>.97&&ci<3?(p-.97)/.03:0),alpha=Math.round(Math.max(0,Math.min(1,fade))*255).toString(16).padStart(2,'0');
    const n=ci*count+i;subtitles+=`Dialogue:0,${assTime(n)},${assTime(n+1)},Clock,,0,0,0,,{\\alpha&H${alpha}&}${date}\n`;
  }
  const assFile=path.join(TMP,'model-clock.ass');fs.writeFileSync(assFile,subtitles);
  const filters=[];let previous='0:v';
  for(let ci=0;ci<4;ci++){
    const start=ci*12,end=(ci+1)*12,inFade=ci===0?.8:.36,outFade=ci===3?.8:.36;
    filters.push(`[${ci+1}:v]format=rgba,fade=t=in:st=${start}:d=${inFade}:alpha=1,fade=t=out:st=${end-outFade}:d=${outFade}:alpha=1[plate${ci}]`);
    filters.push(`[${previous}][plate${ci}]overlay=0:0:enable='between(t,${start},${end})':shortest=1[typed${ci}]`);previous=`typed${ci}`;
  }
  filters.push(`[${previous}]ass=${assFile},format=yuv420p[final]`);
  const final=path.join(TMP,'film-v3-composited.mp4'),args=['-hide_banner','-loglevel','error','-y','-i',source];
  plates.forEach(file=>args.push('-loop','1','-framerate',String(FPS),'-i',file));
  args.push('-filter_complex_threads','2','-filter_complex',filters.join(';'),'-map','[final]','-t','48','-an','-c:v','libx264','-preset','medium','-crf','24','-threads','4','-maxrate','3800k','-bufsize','7600k','-movflags','+faststart','-metadata','title=Hidden Rivers | An Agulhas observatory','-metadata','comment=1152 unique 1920x1080 model frames at24fps. Deterministic model time, camera and annotations. Static typography composited offline to avoid software Chromium glyph-cache damage.',final);
  const task=spawn(process.env.FFMPEG||'ffmpeg',args,{stdio:'inherit'});const [code]=await once(task,'close');if(code!==0)throw new Error(`Typography compositing failed: ${code}`);
  fs.copyFileSync(source,path.join(TMP,'film-v3-browser-original.mp4'));fs.copyFileSync(final,destination);
  const poster=spawn(process.env.FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','7.2','-i',destination,'-frames:v','1','-q:v','2',path.join(OUT,'film-v3-poster.jpg')],{stdio:'inherit'});const [posterCode]=await once(poster,'close');if(posterCode!==0)throw new Error('Poster extraction failed.');
  console.log(JSON.stringify({composited:true,temp:TMP,bytes:fs.statSync(destination).size,plates}));
}

(async()=>{
  if(process.argv.includes('--composite')) return compositeTypography();
  await main();
  if(!PREVIEW){
    await browser?.close(); browser=null;
    if(server){await new Promise(resolve=>server.close(resolve));server=null;}
    await compositeTypography();
  }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{encoder?.stdin?.destroy();await browser?.close();await new Promise(r=>server?server.close(r):r());});
