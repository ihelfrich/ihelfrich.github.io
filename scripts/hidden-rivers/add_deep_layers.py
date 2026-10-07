"""Fetch two additional depth surfaces from the same dated HYCOM analysis.

No vertical interpolation: verify each returned depth and coordinate/time axis.
Build in a scratch directory first; publish only after diagnostics validate.
"""
from pathlib import Path
import concurrent.futures, hashlib, json, shutil, urllib.request, urllib.parse
import numpy as np
from netCDF4 import Dataset, num2date

ROOT=Path(__file__).resolve().parents[2]
OUT=Path('/tmp/hidden-rivers-deep-layers');OUT.mkdir(exist_ok=True)
SOURCE=ROOT/'public/hidden-rivers/data'
original=json.loads((SOURCE/'manifest.json').read_text())
requests=[]
for depth in [500,2000]:
    for component in ['u','v']:
        params={'var':'water_'+component,'north':-30,'south':-43,'west':10,'east':35,
                'horizStride':2,'time_start':'2026-09-29T00:00:00Z','time_end':'2026-10-04T00:00:00Z',
                'timeStride':8,'vertCoord':depth,'accept':'netcdf4','addLatLon':'true'}
        requests.append({'depth':depth,'component':component,'file':f'agulhas_{depth}_{component}.nc',
                         'url':f'https://ncss.hycom.org/thredds/ncss/grid/ESPC-D-V02/{component}3z/2026?'+urllib.parse.urlencode(params)})
def fetch(item):
    file=OUT/item['file']
    if not file.exists():
        with urllib.request.urlopen(item['url'],timeout=150) as response:raw=response.read()
        temporary=file.with_suffix('.part');temporary.write_bytes(raw);temporary.replace(file)
    item['sourceSha256']=hashlib.sha256(file.read_bytes()).hexdigest()
    print('Fetched',item['file'],file.stat().st_size,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(fetch,requests))
region={**original['regions'][0],'layers':[]}
for depth in [500,2000]:
    components=[];axes=[]
    for component in ['u','v']:
        with Dataset(OUT/f'agulhas_{depth}_{component}.nc') as ds:
            assert float(ds['depth'][0])==depth, 'Unexpected returned depth'
            arr=np.ma.filled(ds['water_'+component][:,0],np.nan).astype(float)
            lon=np.asarray(ds['lon'][:],dtype=float);lon=np.where(lon>180,lon-360,lon)
            lat=np.asarray(ds['lat'][:],dtype=float)
            dates=[t.isoformat()+'Z' for t in num2date(ds['time'][:],ds['time'].units)]
            assert len(dates)==6 and dates[0]=='2026-09-29T00:00:00Z' and dates[-1]=='2026-10-04T00:00:00Z'
            units=ds['water_'+component].units
            assert units in ('m/s','m s-1')
            assert np.nanmax(np.abs(arr))<32
            axes.append((lon,lat,dates));components.append(arr)
            item=next(r for r in requests if r['depth']==depth and r['component']==component)
            item.update(region='agulhas',dates=dates,shape=list(arr.shape),units=units,sha256=item['sourceSha256'])
    assert np.array_equal(axes[0][0],axes[1][0]) and np.array_equal(axes[0][1],axes[1][1]) and axes[0][2]==axes[1][2]
    dlon=float((lon[-1]-lon[0])/(len(lon)-1));dlat=float((lat[-1]-lat[0])/(len(lat)-1))
    residual=max(float(np.max(np.abs(lon-(lon[0]+np.arange(len(lon))*dlon)))),float(np.max(np.abs(lat-(lat[0]+np.arange(len(lat))*dlat)))))
    assert residual<1e-3
    values=np.stack(components);good=np.isfinite(values).all(axis=0)
    packed=np.where(good[None],np.rint(np.nan_to_num(values)*1000),-32768).astype('<i2')
    filename=f'agulhas_{depth}.bin';packed.tofile(OUT/filename)
    region['layers'].append({'depth':depth,'file':filename,'shape':list(components[0].shape),'lon0':float(lon[0]),'lat0':float(lat[0]),'dlon':dlon,'dlat':dlat,
        'dates':dates,'speedMax':float(np.nanmax(np.hypot(*components))),'timeStepSeconds':86400,'units':'m s-1','coordinateResidualMaxDegrees':residual,
        'provenance':'source-requests-deep.json','sha256':hashlib.sha256((OUT/filename).read_bytes()).hexdigest()})
shutil.copy2(SOURCE/region['terrain']['file'],OUT/region['terrain']['file'])
(OUT/'source-requests-deep.json').write_text(json.dumps({'requests':requests},indent=2)+'\n')
(OUT/'manifest.json').write_text(json.dumps({**original,'provenance':'source-requests-deep.json','regions':[region]},indent=2)+'\n')
print('Two depth surfaces staged with matching components, units, dates, and regular geographic grids.',flush=True)
