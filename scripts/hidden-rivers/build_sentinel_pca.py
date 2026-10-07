"""Build a true multispectral PCA plate from a public Sentinel-2 L2A scene.

uv run --no-project --with rasterio --with matplotlib --with numpy --with pillow \
  python scripts/hidden-rivers/build_sentinel_pca.py
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path
from datetime import datetime

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/hidden-rivers/remote-atlas"
OUT.mkdir(parents=True, exist_ok=True)
BBOX = (-87.65, 17.25, -87.42, 17.42)
SEARCH = "https://earth-search.aws.element84.com/v1/search"


def scene():
    query = {"collections":["sentinel-2-l2a"],"bbox":list(BBOX),
             "datetime":"2024-01-01T00:00:00Z/2024-12-31T23:59:59Z",
             "query":{"eo:cloud_cover":{"lt":10}},"limit":20}
    request = urllib.request.Request(SEARCH, data=json.dumps(query).encode(),
                                     headers={"Content-Type":"application/json", "User-Agent":"HiddenRiversAtlas/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        items = json.load(response)["features"]
    # Select a scene that genuinely contains the Great Blue Hole coordinate.
    for item in sorted(items, key=lambda x: x["properties"].get("eo:cloud_cover",100)):
        with rasterio.open(item["assets"]["blue"]["href"]) as ds:
            x, y = rasterio.warp.transform("EPSG:4326", ds.crs, [-87.5344], [17.3153])
            if ds.bounds.left <= x[0] <= ds.bounds.right and ds.bounds.bottom <= y[0] <= ds.bounds.top:
                return item
    raise RuntimeError("No cloud-screened Sentinel-2 tile covers the Great Blue Hole.")


def main():
    item = scene()
    bands = ["blue", "green", "red", "nir"]
    arrays = []
    ref = None
    for band in bands:
        with rasterio.open(item["assets"][band]["href"]) as ds:
            if ref is None:
                ref = ds
                bounds = transform_bounds("EPSG:4326", ds.crs, *BBOX)
                window = from_bounds(*bounds, transform=ds.transform).round_offsets().round_lengths()
            arrays.append(ds.read(1, window=window, out_shape=(700,700), resampling=Resampling.bilinear).astype("float32"))
    cube = np.stack(arrays, axis=-1)
    with rasterio.open(item["assets"]["scl"]["href"]) as ds:
        scl = ds.read(1, window=from_bounds(*bounds, transform=ds.transform).round_offsets().round_lengths(),
                      out_shape=(700,700), resampling=Resampling.nearest)
    # Sentinel-2 SCL: remove saturated, cloud shadow, cloud, cirrus and snow classes.
    valid = np.isfinite(cube).all(axis=-1) & ~np.isin(scl, [0,1,3,8,9,10,11])
    samples = cube[valid]
    mean = samples.mean(axis=0)
    centered = samples - mean
    covariance = centered.T @ centered / max(len(samples)-1,1)
    eigenvalues, vectors = np.linalg.eigh(covariance)
    order = np.argsort(eigenvalues)[::-1]
    eigenvalues, vectors = eigenvalues[order], vectors[:,order]
    pcs = (cube - mean) @ vectors
    variance = eigenvalues / eigenvalues.sum()
    # Robust symmetric stretch; no terrain relief, labels, or fabricated colors.
    rgb = np.zeros((*valid.shape,3), dtype=np.float32)
    for channel, component in enumerate([2,1,0]):
        values = pcs[:,:,component][valid]
        lo, hi = np.quantile(values, [0.02,0.98])
        rgb[:,:,channel] = np.clip((pcs[:,:,component]-lo)/(hi-lo),0,1)
    rgb[~valid] = np.array([0.035,0.11,0.16])

    Image.fromarray(np.uint8(np.clip(rgb,0,1)*255)).save(OUT/"blue-hole-sentinel-pca-visual.webp",format="WEBP",quality=95,method=6)
    fig = plt.figure(figsize=(16,10), facecolor="#071c2a")
    ax = fig.add_axes([.04,.16,.92,.68]); ax.imshow(rgb, interpolation="lanczos"); ax.axis("off")
    fig.text(.035,.965,"LIGHTHOUSE REEF · BELIZE · SENTINEL-2 L2A",color="#59d9cf",fontsize=10,weight="bold",va="top")
    fig.text(.035,.918,"Four spectral bands, reduced to three",color="#edf6f2",fontsize=24,weight="normal",va="top")
    fig.text(.035,.085,"PC3  ·  PC2  ·  PC1     |     B2 / B3 / B4 / B8 surface reflectance",color="#edf6f2",fontsize=10)
    acquired = datetime.fromisoformat(item["properties"]["datetime"].replace("Z", "+00:00")).strftime("%-d %B %Y")
    fig.text(.035,.048,f"{acquired} · tile cloud cover {item['properties'].get('eo:cloud_cover',0):.1f}% · variance: {variance[0]:.1%}, {variance[1]:.1%}, {variance[2]:.1%}",color="#9db7b9",fontsize=8.5)
    fig.savefig(OUT/"blue-hole-sentinel-pca.webp",dpi=150,facecolor=fig.get_facecolor(),pil_kwargs={"quality":93,"method":6})
    plt.close(fig)
    manifest={"id":item["id"],"date":item["properties"]["datetime"],"cloudCoverPercent":item["properties"].get("eo:cloud_cover"),
              "bands":bands,"components":"PC3 / PC2 / PC1 displayed as RGB","varianceExplained":variance[:3].tolist(),
              "standardization":"centered reflectance covariance; no per-band scaling","mask":"Sentinel-2 Scene Classification Layer removes cloud/shadow/snow classes",
              "image":"/hidden-rivers/remote-atlas/blue-hole-sentinel-pca.webp","source":"Copernicus Sentinel-2 Level-2A COG via Element 84 Earth Search STAC"}
    (OUT/"sentinel-pca.json").write_text(json.dumps(manifest,indent=2)+"\n")
    atlas_manifest=OUT/"manifest.json"
    if atlas_manifest.exists():
        atlas=json.loads(atlas_manifest.read_text())
        atlas["maps"]=[m for m in atlas.get("maps",[]) if m.get("id")!="blue-hole-sentinel-pca"]
        atlas["maps"].insert(1,{"id":"blue-hole-sentinel-pca","title":"Light through four bands","image":manifest["image"],"presentationImage":"/hidden-rivers/remote-atlas/blue-hole-sentinel-pca-visual.webp","displayDate":acquired,"source":manifest["source"],"sourceUrl":"https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a","caption":"Cloud-masked centered-covariance PCA of Sentinel-2 B2/B3/B4/B8 surface reflectance, displayed as PC3/PC2/PC1 RGB."})
        atlas_manifest.write_text(json.dumps(atlas,indent=2)+"\n")


if __name__ == "__main__": main()
