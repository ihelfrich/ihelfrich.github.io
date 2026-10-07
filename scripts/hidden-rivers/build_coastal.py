"""Build the browser's 128-D Tessera cosine-search data, without PCA compression.

Reproduce with Python 3.12+, geotessera==0.11.0, numpy, pyproj, requests, Pillow.
The exact native-grid window and sampling stride are recorded in manifest.json.
The browser reads the public store's signed bytes. The positive per-pixel scales
cancel algebraically in cosine similarity; scales are used only to mask nodata.
"""
import argparse, gzip, hashlib, io, json, os, sys
from pathlib import Path
import numpy as np
from pyproj import Transformer
from geotessera import GeoTesseraZarr
import requests
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('--output', default='public/hidden-rivers/coastal')
p.add_argument('--cache', default='/tmp/hidden-rivers-tessera-cache')
a = p.parse_args()
out = Path(a.output); out.mkdir(parents=True, exist_ok=True)
cache = Path(a.cache); cache.mkdir(parents=True, exist_ok=True)
gt = GeoTesseraZarr(cache_dir=str(cache / 'store'))
# Exactly the same 5.12 km Cape Peninsula footprint as the previous PCA figure.
bbox = (257860.0, -3789940.0, 262980.0, -3784820.0)
rawcache = cache / 'cape-2024-original-quantized.npz'
if rawcache.exists():
    x = np.load(rawcache)
    q, scales, transform = x['q'], x['scales'], x['transform'].tolist()
else:
    ds = gt.open_zone(lon=18.4)
    q, scales, tr = ds.tessera.read_region_quantized(bbox, year=2024)
    transform = list(tr)
    np.savez_compressed(rawcache, q=q, scales=scales, transform=np.array(transform))
print('raw', q.shape, scales.shape, transform, flush=True)
# The API returns (height, width, dimensions). Never interpolate feature vectors.
assert q.shape == (512, 512, 128), q.shape
assert q.dtype == np.int8, q.dtype
q = q[::2, ::2].copy()
scales = scales[::2, ::2].copy()
valid = np.isfinite(scales) & (scales > 0) & np.any(q != 0, axis=2)
q[~valid] = 0
h, w, d = q.shape
# Keep the actual retained native-pixel centres: offsets 0.5, 2.5, 4.5, ... .
cols, rows = np.meshgrid(np.arange(w) * 2 + .5, np.arange(h) * 2 + .5)
e = transform[2] + transform[0] * cols + transform[1] * rows
n = transform[5] + transform[3] * cols + transform[4] * rows
project = Transformer.from_crs('EPSG:32634', 'EPSG:4326', always_xy=True)
lon, lat = project.transform(e, n)
coords = np.stack([lon, lat], axis=-1).astype('<f4')

# Independent float32-dequantized comparison on 10,000 deterministic pairs.
rng = np.random.default_rng(20261007)
indices = np.flatnonzero(valid)
pairs = rng.choice(indices, (10000, 2), replace=True)
z = q.reshape(-1, d)
s = scales.reshape(-1)
aq, bq = z[pairs[:,0]].astype(np.float64), z[pairs[:,1]].astype(np.float64)
cos_int = np.einsum('ij,ij->i',aq,bq) / np.linalg.norm(aq,axis=1) / np.linalg.norm(bq,axis=1)
af = (z[pairs[:,0]].astype(np.float32) * s[pairs[:,0],None]).astype(np.float64)
bf = (z[pairs[:,1]].astype(np.float32) * s[pairs[:,1],None]).astype(np.float64)
cos_float = np.einsum('ij,ij->i',af,bf) / np.linalg.norm(af,axis=1) / np.linalg.norm(bf,axis=1)
err = np.abs(cos_int - cos_float)
assert np.max(err) < 1e-6
files = {}
for name, array in [('vectors.i8',q), ('valid.u8',valid.astype('uint8')), ('coordinates.f32',coords)]:
    data = array.tobytes()
    (out/name).write_bytes(data)
    files[name] = {'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()}

# Context image requested in equivalent southern UTM CRS. Pixel corners align
# with the native window; the image itself may combine acquisition dates.
imageurl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'
params={'bbox':','.join(map(str,[bbox[0],bbox[1]+10000000,bbox[2],bbox[3]+10000000])), 'bboxSR':32734,'imageSR':32734,'size':'1024,1024','format':'jpg','f':'image'}
response=requests.get(imageurl,params=params,timeout=90); response.raise_for_status()
im=Image.open(io.BytesIO(response.content)).convert('RGB')
assert im.size==(1024,1024)
im.save(out/'cape-imagery.jpg',quality=90)

bounds_corners = [project.transform(bbox[0],bbox[1]),project.transform(bbox[0],bbox[3]),project.transform(bbox[2],bbox[1]),project.transform(bbox[2],bbox[3])]
metadata={
 'schema':1, 'name':'Cape Peninsula, South Africa', 'year':2024,
 'model':'Tessera v1.1', 'variant':'dClimate complete global run', 'dimensions':d,
 'embeddingLicense':'CC0-1.0', 'licenseSource':'https://github.com/ucam-eo/tessera',
 'width':w,'height':h,'nativeResolutionMetres':10,'sampleSpacingMetres':20,'stride':2,
 'nativeWindow':[512,512],'nativeCRS':'EPSG:32634','nativeTransform':transform,
 'sampling':'Every second native 10 m pixel retained without resampling; 20 m centre spacing. Native pixel centres at row/column offsets 0.5 + 2k.',
 'validCount':int(valid.sum()),'totalCount':int(valid.size),
 'mask':'Only finite positive store scales and nonzero vectors retained. Invalid store pixels are excluded; the viewer does not infer their reason.',
 'encoding':'Signed int8 [row,column,component], 128 original published components. Positive per-pixel scale cancels in cosine. No dimensionality reduction or additional quantization.',
 'coordinates':'Little-endian float32 [row,column,(longitude,latitude)] in WGS84.',
 'bounds':[min(x[0] for x in bounds_corners),min(x[1] for x in bounds_corners),max(x[0] for x in bounds_corners),max(x[1] for x in bounds_corners)],
 'validation':{'pairs':10000,'seed':20261007,'maxAbsoluteCosineErrorVsFloat32Dequantized':float(err.max()),'meanAbsoluteCosineError':float(err.mean()),'note':'Numerical agreement with published dequantized vectors, not validation of ecological or oceanographic meaning.'},
 'files':files,
 'sources':[
  {'title':'GeoTessera package and dataset documentation','url':'https://geotessera.readthedocs.io/en/latest/'},
  {'title':'Tessera v1.1 dClimate Icechunk store','url':'https://data.source.coop/tessera/tessera/zarr/v1.1-dclimate'},
  {'title':'TESSERA model paper','url':'https://arxiv.org/abs/2506.20380'},
  {'title':'Esri World Imagery','url':response.url,'attribution':'Esri, Maxar, Earthstar Geographics, and the GIS User Community. Context imagery may combine acquisition dates.'}
 ],
 'use':'Compare annual optical/radar representations within one model version and year. Similarity is a retrieval score, not a class probability, habitat label, or current measurement.',
 'crossModelWarning':'Do not compare cosine scores across different embedding model versions.',
 'initialPixel':[122,142]
}
(out/'manifest.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({'valid':int(valid.sum()),'files':files,'validation':metadata['validation']},indent=2),flush=True)
