"""Water-specific, shared-date PCA and perceptual palettes from calibrated crops.

uv run --no-project --with numpy --with pillow python scripts/hidden-rivers/build_spectral_stories.py
Run build_water_atlas.py first. No network requests or synthetic observations.
"""
import hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]/'public/hidden-rivers/water-atlas'
CACHE=Path('/tmp/hidden-rivers-water-cache')
# Each row is a low-to-high PC1 ramp. The second row represents higher PC2.
PALETTES={
 'gold':[['#101d46','#254886','#168f9e','#69d7bc','#f2d28b','#fff1c9'],
         ['#251f4b','#554c92','#8877b9','#d59aaa','#f4bd99','#ffebce']],
 'coral':[['#072c3e','#075a74','#0f91a1','#54c7bc','#b5e7cd','#f0f4d6'],
          ['#34243f','#69466e','#a46289','#dd8e99','#f8bda8','#ffebd1']],
 'ice':[['#201542','#443383','#5c66b4','#73b7cf','#b7e8ed','#f1f5e8'],
        ['#281b39','#74415e','#ad6c70','#de9e88','#efd1ac','#fbf2d9']],
}

def rgb_to_lab(rgb):
    linear=np.where(rgb>.04045,((rgb+.055)/1.055)**2.4,rgb/12.92)
    xyz=linear@np.array([[.4124564,.2126729,.0193339],[.3575761,.7151522,.1191920],[.1804375,.0721750,.9503041]])
    xyz/=np.array([.95047,1,1.08883]);f=np.where(xyz>(6/29)**3,np.cbrt(xyz),xyz/(3*(6/29)**2)+4/29)
    return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)

def lab_to_rgb(lab):
    fy=(lab[...,0]+16)/116;f=np.stack([fy+lab[...,1]/500,fy,fy-lab[...,2]/200],-1)
    xyz=np.where(f>6/29,f**3,3*(6/29)**2*(f-4/29))*np.array([.95047,1,1.08883])
    linear=xyz@np.array([[3.2404542,-.9692660,.0556434],[-1.5371385,1.8760108,-.2040259],[-.4985314,.0415560,1.0572252]])
    return np.clip(np.where(linear>.0031308,1.055*np.maximum(linear,0)**(1/2.4)-.055,12.92*linear),0,1)

def ramp(t,stops):
    rgb=np.array([[int(h[i:i+2],16)/255 for i in [1,3,5]] for h in stops]);lab=rgb_to_lab(rgb)
    u=np.clip(np.nan_to_num(t),0,1)*(len(stops)-1);i=np.floor(u).astype(int);f=(u-i)[...,None]
    return lab[i]*(1-f)+lab[np.minimum(i+1,len(stops)-1)]*f

def paint(pc,rows,blend):
    first=ramp(pc[...,0],rows[0])
    if blend=='contrast':
        second=ramp(pc[...,0],rows[1]);weight=np.clip(np.nan_to_num(pc[...,1]),0,1)[...,None]
        first=first*(1-weight)+second*weight
    return lab_to_rgb(first)

def main():
    catalog=json.loads((ROOT/'manifest.json').read_text())
    for p in catalog['places']:
        cubes=[];valids=[];wet=[];suffix=hashlib.sha256(str(p['bounds']).encode()).hexdigest()[:8]
        for frame in p['frames']:
            cube=np.stack([np.load(CACHE/f"{frame['id']}-{b}-{suffix}-calibrated.npy") for b in ['blue','green','red','nir']],-1)
            valid=np.array(Image.open(ROOT/frame['rgb']))[:,:,3]>0
            scl=np.load(CACHE/f"{frame['id']}-scl-{suffix}-calibrated.npy")
            ndwi=(cube[...,1]-cube[...,3])/np.maximum(cube[...,1]+cube[...,3],1e-7)
            water=valid&((scl==6)|(ndwi>0))&(cube[...,3]<.12)
            cubes.append(cube);valids.append(valid);wet.append(water)
        x=np.concatenate([c[m][::3] for c,m in zip(cubes,wet)])
        enough=len(x)>=1000
        if enough:
            mean=x.mean(0);ev,basis=np.linalg.eigh(np.cov(x,rowvar=False));ev=ev[::-1];basis=basis[:,::-1]
            # Give PC1 a stable physical direction: positive visible brightness.
            if basis[:3,0].sum()<0:basis[:,0]*=-1
            # PC2 is oriented toward its near-infrared loading; it remains scene-dependent.
            for k in range(1,4):
                target=3 if k==1 else np.argmax(np.abs(basis[:,k]))
                if basis[target,k]<0:basis[:,k]*=-1
            scores=(x-mean)@basis;low,high=np.quantile(scores,[.02,.98],axis=0)
            targets=np.stack([x[:,:3].mean(1),(x[:,1]-x[:,0])/np.maximum(x[:,1]+x[:,0],1e-7),(x[:,3]-x[:,1])/np.maximum(x[:,3]+x[:,1],1e-7)],1)
            corr=np.corrcoef(scores.T,targets.T)[:4,4:]
            p['waterPca']={'bands':['B2','B3','B4','B8'],'mean':mean.tolist(),'eigenvectors':basis.tolist(),
                'varianceExplained':(ev/ev.sum()).tolist(),'stretchLow':low.tolist(),'stretchHigh':high.tolist(),
                'sampleCount':len(x),'sampleDomain':'SCL water-class pixels after scene exclusions, or positive NDWI candidates, with B8 reflectance < 0.12; every third candidate pixel across all dates.',
                'correlationTargets':['Mean B2/B3/B4 reflectance','(B3-B2)/(B3+B2)','(B8-B3)/(B8+B3)'],
                'correlations':corr.tolist(),'signRule':'PC1 positive visible-band sum; PC2 positive B8 loading; remaining PCs largest absolute loading positive.',
                'method':'Centered covariance over water candidates only; one basis and shared 2–98% stretches across all dates. Land does not enter the fit.',
                'display':'CIELAB-interpolated sequential PC1 palette; contrast blend interpolates between two PC1 ramps by PC2. Muted natural-color land context. Spectral contrast is not a constituent concentration, water depth or health class.'}
        else:p['waterPca']=None
        r=p['raster'];r['displayPixelWebMercatorMetres']=r['displayPixelMetres'];r['displayPixelGroundMetresAtCentre']=r['displayPixelMetres']*float(np.cos(np.deg2rad((p['bounds'][1]+p['bounds'][3])/2)));r['displayPixelMetresInterpretation']='Legacy field: projected EPSG:3857 pixel width, not ground metres. Ground width reported at AOI centre.'
        for frame,cube,valid,water in zip(p['frames'],cubes,valids,wet):
            frame['spectra']=f"{p['id']}/{p['frames'].index(frame)}-spectra.bin"
            sample=cube[::8,::8].copy();sample[~valid[::8,::8]]=np.nan;sample.astype('<f4').tofile(ROOT/frame['spectra'])
            frame['spectraShape']=[*sample.shape];frame['spectraUnits']='Surface reflectance; little-endian float32, pixel-interleaved B2/B3/B4/B8; NaN masked.'
            frame['landscape']=frame.get('landscape',frame['pca'])
            frame['lenses']={};frame['waterPcaFraction']=float(water.mean())
            if not enough:continue
            pc=(cube-mean)@basis;norm=(pc-low)/np.maximum(high-low,1e-9)
            natural=np.clip((cube[:,:,[2,1,0]]-.012)/.245,0,1)**(1/1.8)
            gray=np.nan_to_num(natural).mean(-1)[...,None]
            # Real land texture, subdued so the water carries the color narrative.
            context=np.array([.028,.067,.083])+gray*np.array([.17,.22,.23])
            for key,rows in PALETTES.items():
                frame['lenses'][key]={}
                for blend in ['brightness','contrast']:
                    rgb=np.where(water[...,None],paint(norm,rows,blend),context)
                    name=f"{p['frames'].index(frame)}-pca-{key}-{blend}.webp";path=ROOT/p['id']/name
                    rgba=np.dstack([np.uint8(np.clip(np.nan_to_num(rgb),0,1)*255),valid.astype('uint8')*255])
                    Image.fromarray(rgba).save(path,quality=93,method=6)
                    frame['lenses'][key][blend]=f"{p['id']}/{name}"
            frame['pca']=frame['lenses']['gold']['brightness']
        (ROOT/p['id']/'provenance.json').write_text(json.dumps(p,indent=2)+'\n')
        print(json.dumps({'place':p['id'],'waterSamples':len(x),'waterPca':enough,'pc1VisibleCorrelation':round(float(corr[0,0]),4) if enough else None}),flush=True)
    catalog['spectralPalettes']={k:{'rows':v,'space':'CIELAB D65'} for k,v in PALETTES.items()}
    (ROOT/'manifest.json').write_text(json.dumps(catalog,indent=2)+'\n')

if __name__=='__main__':main()
