"""Georeferenced Sentinel-2/PCA and HydroRIVERS subsets for the interactive atlas.

uv run --no-project --with rasterio --with numpy --with pillow --with fiona \
  --with shapely --with netCDF4 python scripts/hidden-rivers/build_water_atlas.py
Source COG crops and search results are cached outside the repository. Images
are Web Mercator, not unreferenced screenshots. One PCA basis and color stretch
per place are fitted across all its dates; cloud pixels remain transparent.
"""
from __future__ import annotations
import argparse, hashlib, json, urllib.request, urllib.parse
from pathlib import Path
import numpy as np
from PIL import Image
import rasterio
from rasterio.warp import reproject, transform_bounds
from rasterio.transform import from_bounds
from rasterio.enums import Resampling
from rasterio.windows import from_bounds as window_from_bounds
from shapely.geometry import box, shape, mapping
import fiona
from netCDF4 import Dataset

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/hidden-rivers/water-atlas'
CACHE = Path('/tmp/hidden-rivers-water-cache')
OUT.mkdir(parents=True, exist_ok=True); CACHE.mkdir(parents=True, exist_ok=True)
SEARCH = 'https://earth-search.aws.element84.com/v1/search'
PLACES = [
    ('manaus', 'Meeting of the Waters', [-60.12,-3.33,-59.78,-2.98], 'Amazon basin', 'The dark Rio Negro meets the sediment-rich Solimões east of Manaus.', 'sa'),
    ('santarem', 'Tapajós & Amazon', [-54.98,-2.58,-54.58,-2.12], 'Amazon basin', 'Clearer Tapajós water joins the Amazon beside Santarém.', 'sa'),
    ('xingu', 'Xingu River', [-52.28,-3.53,-51.83,-3.12], 'Amazon basin', 'The Xingu around Altamira, upstream of the Volta Grande and Belo Monte complex.', 'sa'),
    ('guiana', 'Amaila Falls, Guyana', [-59.64,5.15,-59.38,5.41], 'Rivers & coasts', 'River country around Amaila Falls and the proposed hydropower site on the Kuribrong.', 'sa'),
    ('outer-banks', 'Outer Banks', [-75.82,35.12,-75.32,35.70], 'Rivers & coasts', 'Inlets, shoals and barrier islands between Pamlico Sound and the Atlantic.', 'na'),
    ('wilmington', 'Cape Fear estuary', [-78.10,33.87,-77.78,34.29], 'Rivers & coasts', 'The Cape Fear widens below Wilmington before reaching the Atlantic.', 'na'),
    ('fayetteville', 'Fayetteville · Cape Fear', [-78.98,34.95,-78.72,35.20], 'Rivers & coasts', 'The Cape Fear through Fayetteville, upstream of Wilmington.', 'na'),
    ('blue-hole', 'Great Blue Hole', [-87.65,17.25,-87.42,17.42], 'Reefs & open ocean', 'Lighthouse Reef and its circular submarine sinkhole, Belize.', None),
    ('reef', 'Great Barrier Reef', [145.82,-16.91,146.16,-16.53], 'Reefs & open ocean', 'Reef flats and channels off northeastern Queensland.', None),
]
PERIODS = [('2023-07-01','2023-12-31'), ('2024-01-01','2024-06-30'), ('2024-07-01','2024-12-31')]
SIZE = 960

def request_json(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
        headers={'Content-Type':'application/json','User-Agent':'HiddenRivers/2.0'})
    with urllib.request.urlopen(req, timeout=35) as r: return json.load(r)

def candidates(bbox, period):
    query = {'collections':['sentinel-2-l2a'],'bbox':bbox,
        'datetime':f'{period[0]}T00:00:00Z/{period[1]}T23:59:59Z',
        'query':{'eo:cloud_cover':{'lt':35}},'limit':100}
    cache = CACHE / (hashlib.sha256(json.dumps(query).encode()).hexdigest()[:16]+'.json')
    if not cache.exists(): cache.write_text(json.dumps(request_json(SEARCH,query)))
    items = json.loads(cache.read_text())['features']
    aoi = box(*bbox)
    # Reject a neighboring tile even if its bounding rectangle intersects us.
    items = [i for i in items if shape(i['geometry']).intersection(aoi).area/aoi.area > .90]
    return sorted(items, key=lambda i:i['properties'].get('eo:cloud_cover',100))

def read_asset(item, name, bbox, categorical=False):
    asset = item['assets'][name]
    suffix=f"{item['id']}-{name}-{hashlib.sha256(str(bbox).encode()).hexdigest()[:8]}"
    cache = CACHE / (suffix+'-calibrated.npy')
    if cache.exists(): return np.load(cache)
    meta = asset.get('raster:bands',[{}])[0]
    applied=item['properties'].get('earthsearch:boa_offset_applied',False)
    # The original COG collection can report -0.1 in STAC after its pixels
    # were already offset-corrected (Earth Search issues 66/71). Honor the
    # conversion flag, retain both metadata and effective calibration below.
    offset=0 if applied else meta.get('offset',0)
    legacy=CACHE/(suffix+'.npy')
    if legacy.exists():
        dest=np.load(legacy)
        if not categorical:dest+=offset-meta.get('offset',0)
        np.save(cache,dest);return dest
    dst_bounds = transform_bounds('EPSG:4326','EPSG:3857',*bbox)
    dest = np.full((SIZE,SIZE),np.nan,dtype='float32')
    with rasterio.Env(GDAL_HTTP_TIMEOUT='35', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
        with rasterio.open(asset['href']) as ds:
            bounds = transform_bounds('EPSG:4326',ds.crs,*bbox)
            window = window_from_bounds(*bounds, transform=ds.transform).round_offsets().round_lengths()
            # Read only the AOI, then warp its real coordinates onto the map.
            raw = ds.read(1,window=window,boundless=True,fill_value=0)
            reproject(raw,dest,src_transform=ds.window_transform(window),src_crs=ds.crs,
                dst_transform=from_bounds(*dst_bounds,SIZE,SIZE),dst_crs='EPSG:3857',
                src_nodata=0,dst_nodata=np.nan,resampling=Resampling.nearest if categorical else Resampling.bilinear)
    if not categorical:
        dest = dest * meta.get('scale',.0001) + offset
    np.save(cache,dest)
    return dest

def scene(item,bbox):
    scl = read_asset(item,'scl',bbox,True)
    valid = np.isfinite(scl) & ~np.isin(scl,[0,1,3,8,9,10,11])
    cube = np.stack([read_asset(item,b,bbox) for b in ['blue','green','red','nir']],axis=-1)
    valid &= np.isfinite(cube).all(axis=-1)
    return cube,valid,scl

def save_rgba(rgb,valid,path):
    rgba = np.dstack([np.uint8(np.clip(np.nan_to_num(rgb),0,1)*255),np.uint8(valid)*255])
    Image.fromarray(rgba,'RGBA').save(path,quality=93,method=6)

def perceptual_pca(components):
    """PC1 controls lightness; PC2/PC3 control two restrained opponent colors."""
    c=np.clip(components,0,1)
    light=28+54*c[:,:,0];a=-23+46*c[:,:,1];b=-30+60*c[:,:,2]
    fy=(light+16)/116;fx=fy+a/500;fz=fy-b/200
    f=np.stack([fx,fy,fz],axis=-1)
    xyz=np.where(f>6/29,f**3,3*(6/29)**2*(f-4/29))*np.array([.95047,1,1.08883])
    linear=xyz@np.array([[3.2404542,-.9692660,.0556434],[-1.5371385,1.8760108,-.2040259],[-.4985314,.0415560,1.0572252]])
    rgb=np.where(linear>.0031308,1.055*np.maximum(linear,0)**(1/2.4)-.055,12.92*linear)
    return np.clip(rgb,0,1)

def make_place(spec):
    pid,title,bbox,group,note,continent = spec
    folder=OUT/pid;folder.mkdir(exist_ok=True)
    dates=[];cubes=[];masks=[];classes=[]
    for period in PERIODS:
        chosen=None
        for item in candidates(bbox,period)[:8]:
            scl=read_asset(item,'scl',bbox,True)
            valid=np.isfinite(scl)&~np.isin(scl,[0,1,3,8,9,10,11])
            if valid.mean() < (.82 if pid=='guiana' else .88): continue
            cube,valid,scl=scene(item,bbox);chosen=item
            cubes.append(cube);masks.append(valid);classes.append(scl);dates.append(item)
            print(pid,item['id'],'valid',round(float(valid.mean()),3),flush=True)
            break
        if chosen is None: print(pid,'no clear full-coverage scene',period,flush=True)
    if not cubes: raise RuntimeError(f'No defensible scene for {pid}')
    # Common covariance eigenvectors prevent PCA channels flipping between dates.
    samples=np.concatenate([c[m][::5] for c,m in zip(cubes,masks)])
    mean=samples.mean(axis=0);cov=np.cov(samples-mean,rowvar=False)
    ev,basis=np.linalg.eigh(cov);order=np.argsort(ev)[::-1];ev=ev[order];basis=basis[:,order]
    for j in range(4):
        if basis[np.argmax(np.abs(basis[:,j])),j]<0: basis[:,j]*=-1
    scores=(samples-mean)@basis
    low,high=np.quantile(scores,[.02,.98],axis=0)
    frames=[]
    for index,(item,cube,valid,scl) in enumerate(zip(dates,cubes,masks,classes)):
        rgb=np.clip((cube[:,:,[2,1,0]]-.012)/.245,0,1)**(1/1.8)
        pc=(cube-mean)@basis
        pca=perceptual_pca((pc-low)/np.maximum(high-low,1e-8))
        # NDWI is a reflectance index, never relabeled as a speed or depth.
        ndwi=(cube[:,:,1]-cube[:,:,3])/np.maximum(cube[:,:,1]+cube[:,:,3],1e-7)
        stops=np.array([[.03,.08,.11],[.14,.22,.25],[.06,.47,.53],[.21,.82,.78],[.80,.99,.89]])
        t=np.clip((np.nan_to_num(ndwi)+1)/2,0,1)*4;lo=np.floor(t).astype('int32');lo=np.clip(lo,0,4)
        water=stops[lo]*(1-(t-lo))[...,None]+stops[np.minimum(lo+1,4)]*(t-lo)[...,None]
        for name,array in [('rgb',rgb),('pca',pca),('water',water)]:
            save_rgba(array,valid,folder/f'{index}-{name}.webp')
        # Compact exact-index inspection grid; nodata is -32768, not zero.
        grid=ndwi[::8,::8];mask=valid[::8,::8]
        q=np.where(mask,np.clip(np.nan_to_num(grid)*10000,-10000,10000),-32768).astype('<i2')
        q.tofile(folder/f'{index}-ndwi.bin')
        candidate=(valid & ((scl==6)|(ndwi>0)))[::8,::8].astype('uint8')
        candidate.tofile(folder/f'{index}-water-candidate.bin')
        frames.append({'id':item['id'],'date':item['properties']['datetime'],
            'validFraction':round(float(valid.mean()),5),'tileCloudPercent':item['properties'].get('eo:cloud_cover'),
            'rgb':f'{pid}/{index}-rgb.webp','pca':f'{pid}/{index}-pca.webp','water':f'{pid}/{index}-water.webp',
            'index':f'{pid}/{index}-ndwi.bin','indexShape':list(q.shape),
            'waterCandidate':f'{pid}/{index}-water-candidate.bin',
            'assets':{b:{'href':item['assets'][b]['href'],'rasterBands':item['assets'][b].get('raster:bands'),
                'effectiveOffset':0 if item['properties'].get('earthsearch:boa_offset_applied',False) else item['assets'][b].get('raster:bands',[{}])[0].get('offset',0)} for b in ['blue','green','red','nir','scl']},
            'boaOffsetAlreadyApplied':item['properties'].get('earthsearch:boa_offset_applied',False)})
    p={'id':pid,'title':title,'bounds':bbox,'group':group,'note':note,'frames':frames,
        'pca':{'bands':['B2','B3','B4','B8'],'mean':mean.tolist(),'eigenvectors':basis.tolist(),
            'varianceExplained':(ev/ev.sum()).tolist(),
            'colorMapping':'CIELAB D65: L*=28+54 PC1; a*=-23+46 PC2; b*=-30+60 PC3, with each component clipped after the shared 2–98% stretch; converted to sRGB.',
            'stretchLow':low.tolist(),'stretchHigh':high.tolist(),'method':'Centered surface-reflectance covariance, shared basis and 2–98% stretch across this place’s dates.'},
        'raster':{'crs':'EPSG:3857','width':SIZE,'height':SIZE,'bounds':bbox,'nativeBandResolutionMetres':10,
            'displayPixelMetres':(transform_bounds('EPSG:4326','EPSG:3857',*bbox)[2]-transform_bounds('EPSG:4326','EPSG:3857',*bbox)[0])/SIZE},
        'mask':'SCL removes nodata, saturation, cloud shadow, cloud, cirrus and snow; transparent pixels expose the undated basemap.'}
    if continent:
        p['rivers']=make_rivers(pid,bbox,continent)
    (folder/'provenance.json').write_text(json.dumps(p,indent=2)+'\n')
    return p

def make_rivers(pid,bbox,continent):
    path=f'zip:///tmp/hidden-rivers-{continent}.zip!HydroRIVERS_v10_{continent}_shp/HydroRIVERS_v10_{continent}.shp'
    with fiona.open(path) as src:
        features=list(src.filter(bbox=tuple(bbox)))
    lookup={int(f['properties']['HYRIV_ID']):f for f in features}
    result=[];aoi=box(*bbox);reversed_count=0;checked=0
    for f in features:
        pr=dict(f['properties']);coords=list(shape(f['geometry']).coords)
        nxt=lookup.get(int(pr['NEXT_DOWN']))
        if nxt:
            # Orient explicitly by the next reach. Do not assume shapefile order.
            ncoords=list(shape(nxt['geometry']).coords)
            d0=min(sum((coords[0][j]-n[j])**2 for j in [0,1]) for n in [ncoords[0],ncoords[-1]])
            d1=min(sum((coords[-1][j]-n[j])**2 for j in [0,1]) for n in [ncoords[0],ncoords[-1]])
            checked+=1
            if d0<d1: coords.reverse();reversed_count+=1
        # The final reach orientation follows the product's established order;
        # all linked reaches above are independently checked with NEXT_DOWN.
        geom=shape({'type':'LineString','coordinates':coords}).intersection(aoi)
        if geom.is_empty: continue
        lines=[geom] if geom.geom_type=='LineString' else list(geom.geoms)
        for line in lines:
            if line.geom_type!='LineString': continue
            result.append({'type':'Feature','properties':{'id':int(pr['HYRIV_ID']),
                'next':int(pr['NEXT_DOWN']),'discharge':float(pr['DIS_AV_CMS']),
                'order':int(pr['ORD_STRA']),'directed':nxt is not None},'geometry':mapping(line.simplify(.00015,preserve_topology=True))})
    data={'type':'FeatureCollection','features':result,'source':'HydroRIVERS v1.0 / HydroSHEDS',
        'sourceURL':'https://www.hydrosheds.org/products/hydrorivers',
        'resolutionArcSeconds':15,'dischargePeriod':'1971–2000 WaterGAP long-term mean estimate, m³/s',
        'motion':'Moving marks show network direction only; display rate is not measured river velocity.',
        'orientationChecks':checked,'reversedToNextDown':reversed_count}
    file=OUT/pid/'rivers.json';file.write_text(json.dumps(data,separators=(',',':'))+'\n')
    print(pid,'river reaches',len(result),'orientation',checked,reversed_count,flush=True)
    return f'{pid}/rivers.json'

def currents():
    query='U[(0):1:(11)][(-179.875):4:(179.875)][(-72.875):4:(84.875)],V[(0):1:(11)][(-179.875):4:(179.875)][(-72.875):4:(84.875)]'
    url='https://erddap.aoml.noaa.gov/gdp/erddap/griddap/drifter_monthlymeans.nc?'+urllib.parse.quote(query,safe='[]():.,-T Z')
    cache=CACHE/'drifter.nc'
    if not cache.exists():
        with urllib.request.urlopen(url,timeout=60) as r: cache.write_bytes(r.read())
    with Dataset(cache) as ds:
        lon=np.array(ds.variables['longitude'][:]);lat=np.array(ds.variables['latitude'][:])
        values=np.stack([np.ma.filled(ds.variables[v][:],np.nan).transpose(0,2,1) for v in ['U','V']])
        source_attrs={k:str(ds.getncattr(k)) for k in ds.ncattrs() if k in ['title','summary','time_coverage_end','citation','source']}
    packed=np.where(np.isfinite(values),np.rint(np.nan_to_num(values)*1000),-32768).astype('<i2')
    packed.tofile(OUT/'drifter.bin')
    meta={'shape':list(values.shape[1:]),'lon0':float(lon[0]),'lat0':float(lat[0]),
        'dlon':float(lon[1]-lon[0]),'dlat':float(lat[1]-lat[0]),'depth':15,
        'file':'drifter.bin','velocityScale':.001,'missing':-32768,'units':'m s-1',
        'nativeGridDegrees':.25,'displayGridDegrees':1,'months':list(range(1,13)),
        'source':'NOAA/AOML Global Drifter Program monthly climatology','sourceRequest':url,
        'recordThrough':'2023-02','sourceAttributes':source_attrs,'sha256':hashlib.sha256(packed.tobytes()).hexdigest()}
    (OUT/'drifter.json').write_text(json.dumps(meta,indent=2)+'\n')
    print('global current bytes',packed.nbytes,flush=True)

def salinity():
    bbox=[-62,-4,-37,14]
    query='sss[(2024-07-15T00:00:00Z)][(0.0)][(-4.0):(14.0)][(-62.0):(-37.0)]'
    url='https://coastwatch.noaa.gov/erddap/griddap/noaacwSMAPsssDaily.nc?'+urllib.parse.quote(query,safe='[]():.,-T Z')
    cache=CACHE/'salinity.nc'
    if not cache.exists():
        with urllib.request.urlopen(url,timeout=60) as r:cache.write_bytes(r.read())
    with Dataset(cache) as ds:
        values=np.ma.filled(ds.variables['sss'][0,0,:,:],np.nan).astype('float32')
        lon=np.array(ds.variables['longitude'][:]);lat=np.array(ds.variables['latitude'][:])
    if lat[0]<lat[-1]:values=values[::-1]
    src_bounds=(float(lon.min()-.125),float(lat.min()-.125),float(lon.max()+.125),float(lat.max()+.125))
    dst_bounds=transform_bounds('EPSG:4326','EPSG:3857',*bbox)
    dst=np.full((720,960),np.nan,dtype='float32')
    reproject(values,dst,src_transform=from_bounds(*src_bounds,values.shape[1],values.shape[0]),src_crs='EPSG:4326',src_nodata=np.nan,
        dst_transform=from_bounds(*dst_bounds,960,720),dst_crs='EPSG:3857',dst_nodata=np.nan,resampling=Resampling.nearest)
    stops=np.array([[.80,.99,.89],[.21,.82,.78],[.06,.47,.53],[.14,.22,.25],[.03,.08,.11]])
    t=np.clip((np.nan_to_num(dst,nan=20)-20)/18,0,1)*4;lo=np.floor(t).astype(int)
    rgb=stops[lo]*(1-(t-lo))[...,None]+stops[np.minimum(lo+1,4)]*(t-lo)[...,None]
    save_rgba(rgb,np.isfinite(dst),OUT/'amazon-salinity.webp')
    (OUT/'amazon-salinity.json').write_text(json.dumps({'date':'2024-07-15','bounds':bbox,'nativeGridDegrees':.25,
        'units':'psu','range':[20,38],'sourceRequest':url,'source':'NOAA CoastWatch SMAP daily surface salinity',
        'resampling':'Nearest-neighbor reprojection to EPSG:3857; missing pixels remain transparent.'},indent=2)+'\n')
    print('salinity valid pixels',int(np.isfinite(dst).sum()),flush=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--places',nargs='*');parser.add_argument('--currents',action='store_true');parser.add_argument('--salinity',action='store_true');args=parser.parse_args()
    if args.currents: currents()
    if args.salinity: salinity()
    if args.places is not None:
        for spec in PLACES:
            if not args.places or spec[0] in args.places:
                try: make_place(spec)
                except RuntimeError as error: print('MISSING:',error,flush=True)
                # Save the catalog after each successful place, including on a
                # later source failure. Never publish a pretend empty source.
                existing=[json.loads((OUT/p[0]/'provenance.json').read_text()) for p in PLACES if (OUT/p[0]/'provenance.json').exists()]
                (OUT/'manifest.json').write_text(json.dumps({'places':existing},indent=2)+'\n')
    places=[]
    for spec in PLACES:
        file=OUT/spec[0]/'provenance.json'
        if file.exists(): places.append(json.loads(file.read_text()))
    manifest={'source':'Copernicus Sentinel-2 L2A via Element 84 Earth Search; HydroRIVERS v1.0; NOAA GDP',
        'created':'2026-10-07','places':places,'ndwi':'(B3 − B8) / (B3 + B8); spectral water index, not confirmed inundation, turbidity, salinity, depth or velocity.',
        'imageryPlayback':'Discrete acquisitions, with gaps in time. No synthesized intermediate observations.'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

if __name__=='__main__': main()
