"""Near-native-resolution featured scenes; use existing shared-date PCA fits.

uv run --no-project --with rasterio --with numpy --with pillow python scripts/hidden-rivers/build_spectral_closeups.py
"""
import argparse,importlib.util,json
from pathlib import Path
import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject,transform_bounds
from rasterio.windows import from_bounds as window_from_bounds
from rasterio.transform import from_bounds

ROOT=Path(__file__).resolve().parents[2]/'public/hidden-rivers/water-atlas'
CACHE=Path('/tmp/hidden-rivers-closeups');CACHE.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('spectral_stories',Path(__file__).with_name('build_spectral_stories.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
SIZES={'manaus':3840,'blue-hole':2560,'reef':3840,'santarem':None,'xingu':None,'outer-banks':None,'wilmington':None,'fayetteville':None}

def crop(frame,name,bbox,size):
    width,height=size
    file=CACHE/f"{frame['id']}-{name}-{width}x{height}.npy"
    if file.exists():return np.load(file)
    asset=frame['assets'][name];dst_bounds=transform_bounds('EPSG:4326','EPSG:3857',*bbox)
    dst=np.full((height,width),np.nan,dtype='float32')
    with rasterio.Env(GDAL_HTTP_TIMEOUT='35',GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
        with rasterio.open(asset['href']) as ds:
            win=window_from_bounds(*transform_bounds('EPSG:4326',ds.crs,*bbox),transform=ds.transform).round_offsets().round_lengths()
            raw=ds.read(1,window=win,boundless=True,fill_value=0)
            reproject(raw,dst,src_transform=ds.window_transform(win),src_crs=ds.crs,dst_transform=from_bounds(*dst_bounds,width,height),dst_crs='EPSG:3857',src_nodata=0,dst_nodata=np.nan,resampling=Resampling.nearest if name=='scl' else Resampling.bilinear)
    if name!='scl':dst=dst*asset['rasterBands'][0].get('scale',.0001)+asset['effectiveOffset']
    np.save(file,dst);return dst

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--places',nargs='+');args=parser.parse_args()
    catalog=json.loads((ROOT/'manifest.json').read_text())
    for p in catalog['places']:
        if p['id'] not in SIZES or (args.places and p['id'] not in args.places):continue
        frame=p['frames'][0];pc=p['waterPca'];folder=ROOT/p['id'];bbox=p['bounds']
        projected=transform_bounds('EPSG:4326','EPSG:3857',*bbox);factor=float(np.cos(np.deg2rad((bbox[1]+bbox[3])/2)))
        size=SIZES[p['id']]
        width,height=(size,size) if size else tuple(int(np.ceil(length*factor/10/8))*8 for length in [projected[2]-projected[0],projected[3]-projected[1]])
        size=(width,height)
        print(p['id'],'reading original COG windows',size,flush=True)
        cube=np.stack([crop(frame,b,bbox,size) for b in ['blue','green','red','nir']],-1);scl=crop(frame,'scl',bbox,size)
        valid=np.isfinite(cube).all(-1)&np.isfinite(scl)&~np.isin(scl,[0,1,3,8,9,10,11])
        ndwi=(cube[...,1]-cube[...,3])/np.maximum(cube[...,1]+cube[...,3],1e-7);water=valid&((scl==6)|(ndwi>0))&(cube[...,3]<.12)
        natural=np.clip((cube[:,:,[2,1,0]]-.012)/.245,0,1)**(1/1.8)
        def save(rgb,name):
            path=f"{p['id']}/closeup-{name}.webp";rgba=np.dstack([np.uint8(np.clip(np.nan_to_num(rgb),0,1)*255),valid.astype('uint8')*255]);Image.fromarray(rgba).save(ROOT/path,quality=94 if SIZES[p['id']] else 86,method=4);return path
        h={'rgb':save(natural,'rgb'),'lenses':{},'width':width,'height':height,'nativeBandResolutionMetres':10,'crs':'EPSG:3857','displayPixelMetres':(transform_bounds('EPSG:4326','EPSG:3857',*bbox)[2]-transform_bounds('EPSG:4326','EPSG:3857',*bbox)[0])/width,'validFraction':float(valid.mean()),'method':'Original georeferenced 10 m COG windows, bilinear reprojection; no enlargement of the low-resolution atlas. Existing shared-date water PCA basis and stretch unchanged.'}
        h['displayPixelWebMercatorMetres']=h['displayPixelMetres'];h['displayPixelGroundMetresAtCentre']=h['displayPixelMetres']*float(np.cos(np.deg2rad((bbox[1]+bbox[3])/2)));h['displayPixelMetresInterpretation']='Legacy field: projected EPSG:3857 pixel width, not ground metres. Ground width reported at AOI centre.'
        h['displayPixelGroundMetresYAtCentre']=(projected[3]-projected[1])/height*factor
        # Row chunks bound temporary color-conversion memory for 3840-pixel crops.
        for key,rows in module.PALETTES.items():
            h['lenses'][key]={}
            for blend in ['brightness','contrast']:
                out=np.empty((height,width,3),dtype='float32')
                for start in range(0,height,128):
                    c=cube[start:start+128];n=natural[start:start+128];gray=np.nan_to_num(n).mean(-1)[...,None];context=np.array([.028,.067,.083])+gray*np.array([.17,.22,.23]);scores=(c-np.array(pc['mean']))@np.array(pc['eigenvectors']);norm=(scores-np.array(pc['stretchLow']))/(np.array(pc['stretchHigh'])-np.array(pc['stretchLow']));out[start:start+128]=np.where(water[start:start+128,...,None],module.paint(norm,rows,blend),context)
                h['lenses'][key][blend]=save(out,f'{key}-{blend}')
        frame['highResolution']=h;(folder/'provenance.json').write_text(json.dumps(p,indent=2)+'\n')
        # Preserve independently completed places when a long COG read finishes.
        latest=json.loads((ROOT/'manifest.json').read_text())
        latest['places']=[p if item['id']==p['id'] else item for item in latest['places']]
        (ROOT/'manifest.json').write_text(json.dumps(latest,indent=2)+'\n')
        print(json.dumps({'place':p['id'],'pixels':size,'displayGroundMetresXY':[round(h['displayPixelGroundMetresAtCentre'],2),round(h['displayPixelGroundMetresYAtCentre'],2)],'sourceMetres':10}),flush=True)

if __name__=='__main__':main()
