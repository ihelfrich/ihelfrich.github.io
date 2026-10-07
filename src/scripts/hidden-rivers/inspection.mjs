import { sampleVelocity } from './field.mjs';

export function velocityAt(layer, longitude, latitude, seconds) {
  const velocity = sampleVelocity(layer, (longitude-layer.lon0)/layer.dlon, (latitude-layer.lat0)/layer.dlat, seconds);
  if (!velocity) return null;
  const [east,north] = velocity;
  const speed = Math.hypot(east,north);
  return {east,north,speed,bearing:speed < .0005 ? null : (Math.atan2(east,north)*180/Math.PI+360)%360};
}

export function pointSeries(layers, longitude, latitude) {
  return layers.flatMap(layer=>layer.dates.map((date,index)=>({date,depth:layer.depth,longitude,latitude,...(velocityAt(layer,longitude,latitude,(Date.parse(date)-Date.parse(layer.dates[0]))/1000)||{east:null,north:null,speed:null,bearing:null})})));
}

export function seriesCSV(rows) {
  const header='date_utc,longitude_deg_east,latitude_deg_north,depth_m,eastward_m_s,northward_m_s,speed_m_s,direction_toward_deg_true';
  const value=x=>x===null?'':Number(x).toFixed(5);
  return header+'\n'+rows.map(r=>[r.date,value(r.longitude),value(r.latitude),r.depth,value(r.east),value(r.north),value(r.speed),value(r.bearing)].join(',')).join('\n')+'\n';
}

export function formatCoordinate(lon,lat) {
  return `${Math.abs(lat).toFixed(3)}° ${lat<0?'S':'N'}, ${Math.abs(lon).toFixed(3)}° ${lon<0?'W':'E'}`;
}

export function readView(search) {
  const p=new URLSearchParams(search),number=(key,fallback,min,max)=>{const raw=p.get(key);if(raw===null)return fallback;const n=Number(raw);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
  return {region:['agulhas','bahamas','denmark'].includes(p.get('region'))?p.get('region'):'agulhas',depth:['all','0','200','1000'].includes(p.get('depth'))?p.get('depth'):'all',palette:['aurora','ember','ice'].includes(p.get('palette'))?p.get('palette'):'aurora',view:p.get('view')==='map'?'map':'3d',scale:p.get('scale')==='regional'?'regional':'common',shading:p.get('shading')!=='0',time:number('time',0,0,432000),vertical:number('vertical',80,1,200),longitude:p.has('lon')?number('lon',null,-180,180):null,latitude:p.has('lat')?number('lat',null,-90,90):null};
}
