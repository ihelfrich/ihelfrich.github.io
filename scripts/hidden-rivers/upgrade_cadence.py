"""Download validated three-hour HYCOM slices and atomically replace web inputs."""
from pathlib import Path
import argparse
from datetime import datetime
import concurrent.futures
import hashlib
import json
import urllib.parse
import urllib.request
import numpy as np
from netCDF4 import Dataset, num2date

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/hidden-rivers/data'
CACHE=ROOT.parent/'hycom_3hour'
CACHE.mkdir(exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('--cached-only',action='store_true',help='Import only fully downloaded component pairs, preserving other existing layers.')
args=parser.parse_args()
manifest=json.loads((OUT/'manifest.json').read_text())
requests=[]
for region in manifest['regions']:
    for layer in region['layers']:
        for comp in ['u','v']:
            west,south,east,north=region['bounds']
            params=dict(var='water_'+comp,north=north,south=south,west=west%360,east=east%360,
                        horizStride=2,time_start='2026-09-29T00:00:00Z',time_end='2026-10-04T00:00:00Z',
                        timeStride=1,vertCoord=layer['depth'],accept='netcdf4',addLatLon='true')
            url='https://ncss.hycom.org/thredds/ncss/grid/ESPC-D-V02/'+comp+'3z/2026?'+urllib.parse.urlencode(params)
            requests.append(dict(region=region['id'],depth=layer['depth'],component=comp,
                                 file=f'{region["id"]}_{layer["depth"]}_{comp}.nc',url=url))

def download(req):
    path=CACHE/req['file']
    if not path.exists():
        with urllib.request.urlopen(req['url'],timeout=180) as response:body=response.read()
        if body[:4] not in [b'\x89HDF',b'CDF\x01',b'CDF\x02']:raise ValueError('Not NetCDF: '+repr(body[:200]))
        path.write_bytes(body)
    req['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
    req['bytes']=path.stat().st_size
    print('Downloaded',req['file'],req['bytes'],flush=True)

if not args.cached_only:
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(download,requests))
else:
    requests=[req for req in requests if (CACHE/req['file']).exists()]
    for req in requests:download(req)

# Validate every downloaded pair before replacing any public files.
replacements=[]
for region in manifest['regions']:
    for layer in region['layers']:
        pair=[req for req in requests if req['region']==region['id'] and req['depth']==layer['depth']]
        if len(pair)!=2:
            assert args.cached_only
            layer.setdefault('timeStepSeconds',86400)
            layer.setdefault('units','m s-1')
            layer['sha256']=hashlib.sha256((OUT/layer['file']).read_bytes()).hexdigest()
            layer.setdefault('provenance','source-requests.json')
            continue
        compdata=[]; coords=[]
        for comp in ['u','v']:
            req=next(x for x in requests if x['region']==region['id'] and x['depth']==layer['depth'] and x['component']==comp)
            with Dataset(CACHE/req['file']) as nc:
                var=nc['water_'+comp]
                assert var.units in ('m/s','m s-1','m s^-1'),var.units
                assert var.dimensions==('time','depth','lat','lon'),var.dimensions
                assert len(nc['depth'])==1 and abs(float(nc['depth'][0])-layer['depth'])<1e-6
                dates=[t.isoformat()+'Z' for t in num2date(nc['time'][:],nc['time'].units)]
                assert len(dates)==41 and dates[0]=='2026-09-29T00:00:00Z' and dates[-1]=='2026-10-04T00:00:00Z',dates
                decoded=[datetime.fromisoformat(date.replace('Z','+00:00')).timestamp() for date in dates]
                assert np.allclose(np.diff(decoded),10800),nc['time'].units
                lat=np.asarray(nc['lat'][:],float); lon=np.asarray(nc['lon'][:],float);lon=np.where(lon>180,lon-360,lon)
                values=np.ma.filled(var[:,0],np.nan)
                assert np.nanmax(np.abs(values))<10,'Implausible current speed'
                coords.append((dates,lat,lon));compdata.append(values)
                req['units']=var.units;req['shape']=list(values.shape);req['dates']=dates
        assert coords[0][0]==coords[1][0]
        np.testing.assert_array_equal(coords[0][1],coords[1][1]);np.testing.assert_array_equal(coords[0][2],coords[1][2])
        dates,lat,lon=coords[0]
        assert np.all(np.diff(lat)>0) and np.all(np.diff(lon)>0)
        # Recover the uniform angular grid from endpoints, avoiding accumulated
        # float32 error when a single first-cell difference is repeated.
        dlat=float((lat[-1]-lat[0])/(len(lat)-1));dlon=float((lon[-1]-lon[0])/(len(lon)-1))
        residual=max(float(np.max(np.abs(lat-(lat[0]+np.arange(len(lat))*dlat)))),
                     float(np.max(np.abs(lon-(lon[0]+np.arange(len(lon))*dlon)))))
        assert residual<2e-4,residual
        arr=np.stack(compdata)
        encoded=np.where(np.isfinite(arr),np.rint(np.nan_to_num(arr)*1000),-32768).astype('<i2')
        body=encoded.tobytes()
        layer.update(shape=list(compdata[0].shape),dates=dates,timeStepSeconds=10800,
                     lat0=float(lat[0]),lon0=float(lon[0]),dlat=dlat,dlon=dlon,
                     coordinateResidualMaxDegrees=residual,units='m s-1',provenance='source-requests-3hour.json',
                     speedMax=float(np.nanmax(np.hypot(*compdata))),sha256=hashlib.sha256(body).hexdigest())
        replacements.append((OUT/layer['file'],body))
manifest.update(created='2026-10-07',
                encoding='int16 little-endian [component(u,v),time,latitude,longitude]',
                provenance='source-requests-3hour.json')
steps={layer['timeStepSeconds'] for region in manifest['regions'] for layer in region['layers']}
if len(steps)==1:manifest['timeStepSeconds']=next(iter(steps))
else:manifest.pop('timeStepSeconds',None)
manifest['temporalSampling']='Per-layer timeStepSeconds and dates are authoritative; source cadence may differ between layers.'
for path,body in replacements:
    temporary=path.with_suffix('.tmp');temporary.write_bytes(body);temporary.replace(path)
(OUT/'source-requests-3hour.json').write_text(json.dumps(dict(retrieved='2026-10-07',source='HYCOM ESPC-D-V02',
    provider='https://www.hycom.org/dataserver/espc-d-v02/global-analysis',requests=[req for req in requests if any(req['region']==region['id'] and req['depth']==layer['depth'] and layer.get('provenance')=='source-requests-3hour.json' for region in manifest['regions'] for layer in region['layers'])]),indent=2)+'\n')
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('VERIFIED AND EXPORTED',len(replacements),'three-hour layers',flush=True)
