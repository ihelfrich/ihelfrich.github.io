from pathlib import Path
import urllib.request,urllib.parse,json,hashlib
import numpy as np
from netCDF4 import Dataset,num2date
root=Path(__file__).resolve().parents[2]/'public/hidden-rivers/water-atlas'
for resolution in [2,6]:
    params=[('var','u'),('var','v'),('north',37),('south',32),('west',-79),('east',-73),('horizStride',1),('time','2026-09-25T17:00:00Z'),('vertCoord',0.3),('accept','netcdf4'),('addLatLon','true')]
    url=f'https://dods.ndbc.noaa.gov/thredds/ncss/grid/hfradar_usegc_{resolution}km?'+urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url,timeout=50) as response:body=response.read()
        with Dataset('radar.nc',memory=body) as nc:
            print('variables',list(nc.variables),flush=True)
            u=np.ma.filled(nc['u'][:],np.nan);v=np.ma.filled(nc['v'][:],np.nan);u=u.reshape(-1,*u.shape[-2:]);v=v.reshape(-1,*v.shape[-2:]);valid=np.isfinite(u)&np.isfinite(v)
            lat=np.asarray(nc['lat'][:],float);lon=np.asarray(nc['lon'][:],float);dates=[t.isoformat()+'Z' for t in num2date(nc['time'][:],nc['time'].units)]
            print(json.dumps({'resolution':resolution,'valid':int(valid.sum()),'date':dates,'shape':u.shape}),flush=True)
            nc_count=int((valid & (lat[None,:,None]<36.55)).sum());print('North Carolina cells',nc_count,flush=True)
            if nc_count<20:continue
            assert nc['u'].units in ['m s-1','m/s'] and nc['v'].units==nc['u'].units and np.nanmax(np.hypot(u,v))<10
            packed=np.where(valid[None],np.rint(np.nan_to_num(np.stack([u,v]))*1000),-32768).astype('<i2');data=packed.tobytes()
            meta={'id':'nc-radar','title':'Hatteras coastal radar','bounds':[-79,32,-73,37],'group':'Ocean currents','note':'Measured surface currents off North Carolina. Radar coverage varies; the gaps remain visible.','source':'radar','file':'nc-radar.bin','shape':list(u.shape),'lon0':float(lon[0]),'lat0':float(lat[0]),'dlon':float((lon[-1]-lon[0])/(len(lon)-1)),'dlat':float((lat[-1]-lat[0])/(len(lat)-1)),'dates':dates,'depth':float(nc['depth'][0]),'nominalResolutionKm':resolution,'validCells':int(valid.sum()),'ncValidCells':nc_count,'units':'m s-1','timeStepSeconds':3600,'sourceRequest':url,'sourceSha256':hashlib.sha256(body).hexdigest(),'sha256':hashlib.sha256(data).hexdigest(),'coverage':'Observed HF radar total vectors at the recorded timestamp, not a complete shoreline product. All returned valid native cells retained. Gaps are not filled from a model.'}
            (root/'nc-radar.bin').write_bytes(data);(root/'nc-radar.json').write_text(json.dumps(meta,indent=2)+'\n');break
    except Exception as e:print(type(e).__name__,str(e)[:200],flush=True)
