// Regional Web Mercator pyramids. The last level keeps every source pixel;
// earlier levels are downsampled previews, not additional observations.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root='public/hidden-rivers/water-atlas';
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
for(const place of manifest.places){
  for(const frame of place.frames){
    const high=frame.highResolution;
    if(!high)continue;
    const maxLevel=3,tileWidth=high.width/2**maxLevel,tileHeight=high.height/2**maxLevel;
    if(Object.entries(high.tiles||{}).every(([src,t])=>t.encoding===`WebP quality ${src===high.rgb?84:90}`)&&Object.keys(high.tiles||{}).length===7)continue;
    if(!Number.isInteger(tileWidth)||!Number.isInteger(tileHeight))throw Error('Pyramid must retain the raster pixel grid');
    high.tiles={};
    const sources=[high.rgb,...Object.values(high.lenses).flatMap(v=>Object.values(v))];
    for(const src of sources){
      const quality=src===high.rgb?84:90,encoding=`WebP quality ${quality}`;
      const stem=src.replace(/\.webp$/,'-tiles');
      let complete=high.tiles?.[src]?.encoding===encoding;
      for(let level=0;level<=maxLevel&&complete;level++)for(let y=0;y<2**level&&complete;y++)for(let x=0;x<2**level;x++){try{const info=await sharp(path.join(root,stem,String(level),`${x}-${y}.webp`)).metadata();if(info.width!==tileWidth||info.height!==tileHeight)complete=false;}catch{complete=false;break;}}
      for(let level=0;!complete&&level<=maxLevel;level++){
        const count=2**level;
        const {data,info}=await sharp(path.join(root,src)).resize(tileWidth*count,tileHeight*count).ensureAlpha().raw().toBuffer({resolveWithObject:true});
        await fs.mkdir(path.join(root,stem,String(level)),{recursive:true});
        for(let y=0;y<count;y++)await Promise.all(Array.from({length:count},(_,x)=>sharp(data,{raw:info}).extract({left:x*tileWidth,top:y*tileHeight,width:tileWidth,height:tileHeight}).webp({quality,alphaQuality:100,effort:5}).toFile(path.join(root,stem,String(level),`${x}-${y}.webp`))));
      }
      high.tiles[src]={url:`${stem}/{z}/{x}-{y}.webp`,tileWidth,tileHeight,maximumLevel:maxLevel,width:high.width,height:high.height,crs:'EPSG:3857',bounds:place.bounds,encoding,method:'Display tiles from the existing raster; finest level retains its pixel grid and lossless alpha mask. Lower levels downsample for navigation. Reflectance calibration, PCA basis and scientific samples are unchanged.'};
    }
    console.log(`${place.id}: ${sources.length} native-detail tile pyramids`);
    await fs.writeFile(path.join(root,place.id,'provenance.json'),JSON.stringify(place,null,2)+'\n');
  }
}
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
