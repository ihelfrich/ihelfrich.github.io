"""Verify the published raster alignment, PCA basis, masks and binary fields.

uv run --no-project --with numpy --with pillow python scripts/hidden-rivers/validate-water-atlas.py
"""
import hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]/'public/hidden-rivers/water-atlas'
catalog=json.loads((ROOT/'manifest.json').read_text())
expected={'manaus','santarem','xingu','guiana','outer-banks','wilmington','fayetteville','blue-hole','reef'}
assert {p['id'] for p in catalog['places']}==expected,'Missing satellite place'
frames=0;reaches=0;residual=0
for p in catalog['places']:
    basis=np.array(p['pca']['eigenvectors']);error=float(np.max(np.abs(basis.T@basis-np.eye(4))))
    assert error<1e-10;residual=max(residual,error)
    variance=p['pca']['varianceExplained'];assert abs(sum(variance)-1)<1e-10 and all(v>=0 for v in variance)
    assert all(variance[i]>=variance[i+1] for i in range(3))
    assert p['raster']['crs']=='EPSG:3857' and p['bounds'][0]<p['bounds'][2] and p['bounds'][1]<p['bounds'][3]
    dates=[f['date'] for f in p['frames']];assert dates==sorted(dates) and len(dates)==len(set(dates))
    for f in p['frames']:
        frames+=1;images=[Image.open(ROOT/f[k]).convert('RGBA') for k in ['rgb','pca','water']]
        alpha=[np.array(i)[:,:,3] for i in images]
        assert images[0].size==(960,960) and all(np.array_equal(a,alpha[0]) for a in alpha)
        assert abs(np.mean(alpha[0]>0)-f['validFraction'])<1e-5
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
