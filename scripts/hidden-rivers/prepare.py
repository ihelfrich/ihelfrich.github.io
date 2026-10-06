import numpy as np,json
from PIL import Image
x=np.load('ocean_atlas/tessera_cape.npz')['embedding'].astype(np.float32);ok=np.isfinite(x).all(-1);a=x[ok];rng=np.random.default_rng(42);fit=a[rng.choice(len(a),min(25000,len(a)),replace=False)];mu=fit.mean(0);e,v=np.linalg.eigh(np.cov((fit-mu),rowvar=False));order=np.argsort(e)[::-1];e,v=e[order],v[:,order]
for k in range(3):
 if v[np.argmax(abs(v[:,k])),k]<0:v[:,k]*=-1
s=(a-mu)@v[:,:3];q=np.percentile(s,[2,98],axis=0);rgb=np.zeros(x.shape[:2]+(3,));rgb[ok]=np.clip((s-q[0])/(q[1]-q[0]),0,1)
Image.fromarray(np.uint8(rgb*255)).save('ocean_atlas/Tessera_Cape_Peninsula.png')
np.savez_compressed('ocean_atlas/tessera_pca.npz',mean=mu,loadings=v[:,:3],percentiles=q,explained_variance=e[:3]/e.sum())
print('Tessera PCA variance',e[:3]/e.sum())
