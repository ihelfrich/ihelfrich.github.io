import os,json,numpy as np
from geotessera import GeoTesseraZarr
# A coastal land patch near Cape Town. Tessera remains a coastal context layer.
gt=GeoTesseraZarr(cache_dir='ocean_atlas/tessera_cache')
a,tr,crs=gt.read_patch(18.40,-34.20,year=2024,size_px=512,progress=True)
np.savez_compressed('ocean_atlas/tessera_cape.npz',embedding=a)
json.dump({'year':2024,'lon':18.40,'lat':-34.20,'transform':list(tr),'crs':str(crs),'shape':list(a.shape),'dataset':str(gt.dataset)},open('ocean_atlas/tessera_metadata.json','w'),indent=2)
print(a.shape,np.nanmin(a),np.nanmax(a),flush=True)
