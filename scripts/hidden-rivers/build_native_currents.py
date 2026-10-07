"""Retain every native HYCOM grid cell; stage and validate before publication."""
import concurrent.futures,gzip,hashlib,json,urllib.parse,urllib.request
from pathlib import Path
import numpy as np
from netCDF4 import Dataset,num2date

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/hidden-rivers/water-atlas/native-hycom'
CACHE=Path('/tmp/hidden-rivers-native-hycom');CACHE.mkdir(exist_ok=True)
catalog=json.loads((ROOT/'public/hidden-rivers/data/manifest.json').read_text())
requests=[]
for region in catalog['regions']:
    for layer in region['layers']:
        for component in ['u','v']:
            west,south,east,north=region['bounds']
            params=dict(var='water_'+component,north=north,south=south,west=west%360,east=east%360,horizStride=1,time_start=layer['dates'][0],time_end=layer['dates'][-1],timeStride=8,vertCoord=layer['depth'],accept='netcdf4',addLatLon='true')
            requests.append(dict(region=region['id'],depth=layer['depth'],component=component,file=f"{region['id']}_{layer['depth']}_{component}{'_daily' if layer['shape'][0]>6 else ''}.nc",url=f'https://ncss.hycom.org/thredds/ncss/grid/ESPC-D-V02/{component}3z/2026?'+urllib.parse.urlencode(params)))
def download(req):
    file=CACHE/req['file']
    if not file.exists():
        with urllib.request.urlopen(req['url'],timeout=150) as response:body=response.read()
        if body[:4] not in [b'\x89HDF',b'CDF\x01',b'CDF\x02']:raise ValueError('Server did not return NetCDF')
        file.write_bytes(body)
    req['sha256']=hashlib.sha256(file.read_bytes()).hexdigest()
    print('Native source',req['file'],file.stat().st_size,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(download,requests))
staged=[]
for region in catalog['regions']:
    for layer in region['layers']:
        arrays=[];axes=[]
        for component in ['u','v']:
            req=next(r for r in requests if r['region']==region['id'] and r['depth']==layer['depth'] and r['component']==component)
            with Dataset(CACHE/req['file']) as nc:
                var=nc['water_'+component];assert var.units in ('m/s','m s-1')
                assert var.dimensions==('time','depth','lat','lon') and abs(float(nc['depth'][0])-layer['depth'])<1e-6
                a=np.ma.filled(var[:,0],np.nan);lat=np.asarray(nc['lat'][:],float);lon=np.asarray(nc['lon'][:],float);lon=np.where(lon>180,lon-360,lon)
                dates=[t.isoformat()+'Z' for t in num2date(nc['time'][:],nc['time'].units)]
                assert all(d in layer['dates'] for d in dates) and dates[0]==layer['dates'][0] and dates[-1]==layer['dates'][-1] and np.nanmax(np.abs(a))<10
                arrays.append(a);axes.append((lat,lon,dates))
        np.testing.assert_array_equal(axes[0][0],axes[1][0]);np.testing.assert_array_equal(axes[0][1],axes[1][1]);assert axes[0][2]==axes[1][2]
        dx=float((lon[-1]-lon[0])/(len(lon)-1));dy=float((lat[-1]-lat[0])/(len(lat)-1))
        assert 0<dx<.09 and 0<dy<.05
        residual=max(float(np.max(np.abs(lon-(lon[0]+np.arange(len(lon))*dx)))),float(np.max(np.abs(lat-(lat[0]+np.arange(len(lat))*dy)))))
        assert residual<2e-4
        values=np.stack(arrays);valid=np.isfinite(values).all(axis=0);packed=np.where(valid[None],np.rint(np.nan_to_num(values)*1000),-32768).astype('<i2');body=packed.tobytes()
        layer.update(dates=dates,timeStepSeconds=86400,shape=list(arrays[0].shape),lon0=float(lon[0]),lat0=float(lat[0]),dlon=dx,dlat=dy,coordinateResidualMaxDegrees=residual,spatialStride=1,validSourceCellsPerFrame=valid.sum(axis=(1,2)).tolist(),sha256=hashlib.sha256(body).hexdigest(),provenance='source-requests.json')
        layer['file']+='.gz';layer['compression']='gzip';compressed=gzip.compress(body,compresslevel=9,mtime=0);layer['compressedSha256']=hashlib.sha256(compressed).hexdigest();staged.append((layer['file'],compressed));print('Validated',region['id'],layer['depth'],layer['shape'],flush=True)
catalog.update(dataBase='/hidden-rivers/water-atlas/native-hycom/',spatialStride=1,coverage='All returned native source cells retained. HYCOM land masks and missing values remain missing; shoreline observations are not inferred.')
OUT.mkdir(exist_ok=True)
for name,body in staged:(OUT/name).write_bytes(body)
(OUT/'source-requests.json').write_text(json.dumps({'requests':requests},indent=2)+'\n')
(OUT/'manifest.json').write_text(json.dumps(catalog,indent=2)+'\n')
