import { snapshotField, sampleAt } from './atlas-math.mjs';

function nearestDateIndex(dates,target) {
  if(!dates?.length)return 0;
  const wanted=Date.parse(target);
  if(!Number.isFinite(wanted))return 0;
  return dates.reduce((best,date,i)=>Math.abs(Date.parse(date)-wanted)<Math.abs(Date.parse(dates[best])-wanted)?i:best,0);
}

// Layers remain discrete: each row samples one released depth and the nearest
// available time. Strict four-corner sampling leaves land/missing cells blank.
export function velocityDepthProfile(layers,{date,lon,lat}) {
  return [...layers].sort((a,b)=>a.depth-b.depth).map(layer=>{
    const frame=nearestDateIndex(layer.dates,date),selectedDate=layer.dates?.[frame]??null;
    const velocity=sampleAt(snapshotField(layer,frame),lon,lat);
    if(!velocity)return {depth:layer.depth,date:selectedDate,u:null,v:null,speed:null,direction:null};
    const [u,v]=velocity,speed=Math.hypot(u,v),direction=speed>0?(Math.atan2(u,v)*180/Math.PI+360)%360:null;
    return {depth:layer.depth,date:selectedDate,u,v,speed,direction};
  });
}
