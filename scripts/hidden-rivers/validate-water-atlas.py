"""Verify the published raster alignment, PCA basis, masks and binary fields.

uv run --no-project --with numpy --with pillow python scripts/hidden-rivers/validate-water-atlas.py
"""
import hashlib,json,importlib.util
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]/'public/hidden-rivers/water-atlas'
catalog=json.loads((ROOT/'manifest.json').read_text())
spec=importlib.util.spec_from_file_location('spectral_stories',Path(__file__).with_name('build_spectral_stories.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
for rows in module.PALETTES.values():
    for secondary in [0,.5,1]:
        inputs=np.zeros((101,1,4));inputs[:,0,0]=np.linspace(0,1,101);inputs[:,0,1]=secondary
        light=module.rgb_to_lab(module.paint(inputs,rows,'contrast'))[:,0,0]
        assert np.all(np.diff(light)>0),'Brightness palette reverses perceived lightness'
expected={'manaus','santarem','xingu','guiana','outer-banks','wilmington','fayetteville','blue-hole','reef'}
assert {p['id'] for p in catalog['places']}==expected,'Missing satellite place'
frames=0;reaches=0;residual=0
for p in catalog['places']:
    basis=np.array(p['pca']['eigenvectors']);error=float(np.max(np.abs(basis.T@basis-np.eye(4))))
    assert error<1e-10;residual=max(residual,error)
    variance=p['pca']['varianceExplained'];assert abs(sum(variance)-1)<1e-10 and all(v>=0 for v in variance)
    assert all(variance[i]>=variance[i+1] for i in range(3))
    assert p['raster']['crs']=='EPSG:3857' and p['bounds'][0]<p['bounds'][2] and p['bounds'][1]<p['bounds'][3]
    pc=p.get('waterPca')
    if pc:
        b=np.array(pc['eigenvectors']);assert np.max(np.abs(b.T@b-np.eye(4)))<1e-10
        assert pc['sampleCount']>=1000 and abs(sum(pc['varianceExplained'])-1)<1e-10
        assert pc['correlations'][0][0]>.95 and b[:3,0].sum()>0 and b[3,1]>0
        assert np.all(np.array(pc['stretchHigh'])>np.array(pc['stretchLow']))
    else:assert p['id']=='guiana','Unexpected absence of a water fit'
    dates=[f['date'] for f in p['frames']];assert dates==sorted(dates) and len(dates)==len(set(dates))
    for f in p['frames']:
        frames+=1;images=[Image.open(ROOT/f[k]).convert('RGBA') for k in ['rgb','pca','water']]
        alpha=[np.array(i)[:,:,3] for i in images]
        assert images[0].size==(960,960) and all(np.array_equal(a,alpha[0]) for a in alpha)
        assert abs(np.mean(alpha[0]>0)-f['validFraction'])<1e-5
        spectra=np.fromfile(ROOT/f['spectra'],dtype='<f4').reshape(f['spectraShape'])
        assert np.array_equal(np.isnan(spectra).any(-1),alpha[0][::8,::8]==0),'Spectral sampling mask mismatch'
        if pc:
            for palette in catalog['spectralPalettes']:
                for blend in ['brightness','contrast']:
                    image=np.array(Image.open(ROOT/f['lenses'][palette][blend]).convert('RGBA'))
                    assert np.array_equal(image[:,:,3],alpha[0]),'Palette altered the observation mask'
        if f.get('highResolution'):
            h=f['highResolution'];assert h['nativeBandResolutionMetres']==10 and 9<h['displayPixelMetres']<11
            clear=None
            for file in [h['rgb'],*(h['lenses'][k][b] for k in catalog['spectralPalettes'] for b in ['brightness','contrast'])]:
                im=np.array(Image.open(ROOT/file).convert('RGBA'));assert im.shape[:2]==(h['height'],h['width'])
                if clear is None:clear=im[:,:,3]
                else:assert np.array_equal(clear,im[:,:,3]),'Close-up blend changed source coverage'
            assert abs(np.mean(clear>0)-h['validFraction'])<1e-6
        q=np.fromfile(ROOT/f['index'],dtype='<i2').reshape(f['indexShape'])
        assert np.array_equal(q==-32768,alpha[0][::8,::8]==0),'Inspection nodata disagrees with the actual imagery'
        assert np.all((q==-32768)|((q>=-10000)&(q<=10000)))
        candidates=np.fromfile(ROOT/f['waterCandidate'],dtype='uint8').reshape(f['indexShape'])
        assert np.all((candidates==0)|(candidates==1)) and np.all(candidates[q==-32768]==0),'Animation leaks into masked observations'
        assert set(f['assets'])=={'blue','green','red','nir','scl'}
        if f['boaOffsetAlreadyApplied']:assert all(f['assets'][b]['effectiveOffset']==0 for b in ['blue','green','red','nir'])
    if p.get('rivers'):
        rivers=json.loads((ROOT/p['rivers']).read_text());reaches+=len(rivers['features'])
        # One verified reach can produce several pieces when clipped at the AOI.
        assert rivers['orientationChecks']>=len({f['properties']['id'] for f in rivers['features'] if f['properties']['directed']})
        for f in rivers['features']:
            assert len(f['geometry']['coordinates'])>=2 and f['properties']['discharge']>=0
            for lon,lat in f['geometry']['coordinates']:assert p['bounds'][0]-.00001<=lon<=p['bounds'][2]+.00001 and p['bounds'][1]-.00001<=lat<=p['bounds'][3]+.00001
meta=json.loads((ROOT/'drifter.json').read_text());binary=(ROOT/meta['file']).read_bytes()
assert len(binary)==4*np.prod(meta['shape']) and hashlib.sha256(binary).hexdigest()==meta['sha256']
assert meta['depth']==15 and meta['units']=='m s-1' and meta['velocityScale']==.001
calibration=json.loads((ROOT/'calibration-validation.json').read_text());assert calibration['maxAbsoluteReflectanceDifference']<1e-12 and calibration['verifiedPixelCount']==10000
print(json.dumps({'places':len(expected),'datedScenes':frames,'riverReaches':reaches,'pcaOrthogonalityMaxResidual':residual,'reflectanceCalibrationMaxResidual':calibration['maxAbsoluteReflectanceDifference'],'maskAndBinaryChecks':'passed'}))
