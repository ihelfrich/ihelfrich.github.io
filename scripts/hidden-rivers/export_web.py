import json,numpy as np,os,sys
from netCDF4 import Dataset,num2date
from pathlib import Path
source=Path(sys.argv[1] if len(sys.argv)>1 else '../ocean_atlas');out=Path('public/hidden-rivers/data');out.mkdir(parents=True,exist_ok=True)
regions=[('agulhas','Agulhas retroflection',[10,-43,35,-30],[0,200,1000]),('bahamas','Florida Current & Bahamas',[-82,22,-72,31],[200]),('denmark','Denmark Strait & Irminger Sea',[-44,59,-18,69],[1000])]
meta={'source':'HYCOM / ESPC-D-V02 analysis','created':'2026-10-06','velocityScale':.001,'missing':-32768,'regions':[]}
for name,title,bounds,depths in regions:
 r={'id':name,'title':title,'bounds':bounds,'layers':[]}
 for depth in depths:
  prefix=name+'_'+str(depth) if name=='agulhas' and depth!=200 else name
  with Dataset(source/(prefix+'_u.nc')) as d:
   u=np.ma.filled(d['water_u'][:,0],np.nan);lat=np.array(d['lat'][:]);lon=np.array(d['lon'][:]);lon=np.where(lon>180,lon-360,lon);ts=[x.isoformat()+'Z' for x in num2date(d['time'][:],d['time'].units)];assert float(d['depth'][0])==depth
  with Dataset(source/(prefix+'_v.nc')) as d:v=np.ma.filled(d['water_v'][:,0],np.nan)
  # Binary layout: component, time, latitude(south->north), longitude(west->east).
  arr=np.stack([u,v]);packed=np.where(np.isfinite(arr),np.rint(np.nan_to_num(arr)*1000),-32768).astype('<i2');fn=f'{name}_{depth}.bin';packed.tofile(out/fn)
  r['layers'].append({'depth':depth,'file':fn,'shape':list(u.shape),'lat0':float(lat[0]),'lon0':float(lon[0]),'dlat':float(lat[1]-lat[0]),'dlon':float(lon[1]-lon[0]),'dates':ts,'speedMax':float(np.nanmax(np.hypot(u,v)))})
 if (source/(name+'_bathy.nc')).exists():
  with Dataset(source/(name+'_bathy.nc')) as d:
   z=np.array(d['altitude'][:]);la=np.array(d['latitude'][:]);lo=np.array(d['longitude'][:]);
   if la[1]<la[0]:la=la[::-1];z=z[::-1]
   z.astype('<i2').tofile(out/(name+'_bathy.bin'));r['terrain']={'file':name+'_bathy.bin','shape':list(z.shape),'lon0':float(lo[0]),'lat0':float(la[0]),'dlon':float(lo[1]-lo[0]),'dlat':float(la[1]-la[0]),'source':'NOAA ETOPO1, subsampled every 12 grid cells (0.2 degrees)'}
 meta['regions'].append(r)
json.dump(meta,open(out/'manifest.json','w'),indent=2)
print([(r['id'],[d['depth'] for d in r['layers']],'terrain' in r) for r in meta['regions']])
