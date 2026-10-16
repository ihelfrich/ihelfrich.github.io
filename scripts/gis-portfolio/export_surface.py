# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy", "pyproj"]
# ///
"""Extract public terrain geometry from archived Haiti GLBs; discard all textures.

Usage: uv run scripts/gis-portfolio/export_surface.py /path/to/outputs/cesium
Only POSITION and triangle-index buffers are read. No route/scene files are read.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys
import numpy as np
from pyproj import Transformer

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[2] / "public/gis-portfolio/surface"
out.mkdir(parents=True, exist_ok=True)
anchors = {c["file"]: c["anchor"] for c in json.loads((source / "chunks.json").read_text())}
to_geo = Transformer.from_crs(4978, 4979, always_xy=True)
to_ecef = Transformer.from_crs(4979, 4978, always_xy=True)
lon, lat = -74.0875, 18.66
origin = np.array(to_ecef.transform(lon, lat, 0))
l, p = np.radians([lon, lat])
east = [-np.sin(l), np.cos(l), 0]
up = [np.cos(p)*np.cos(l), np.cos(p)*np.sin(l), np.sin(p)]
south = [np.sin(p)*np.cos(l), np.sin(p)*np.sin(l), -np.cos(p)]
rotation = np.array([east, up, south])
chunks = []
for name in ("b2_10.glb", "b2_11.glb"):
    raw = (source / name).read_bytes()
    assert raw[:4] == b"glTF"
    size = struct.unpack_from("<I", raw, 12)[0]
    gltf = json.loads(raw[20:20+size])
    blob = raw[28+size:]
    primitive = gltf["meshes"][0]["primitives"][0]
    def accessor(i, dtype, width):
        a = gltf["accessors"][i]
        v = gltf["bufferViews"][a["bufferView"]]
        assert "byteStride" not in v
        return np.frombuffer(blob, dtype, count=a["count"]*width,
                             offset=v.get("byteOffset", 0)+a.get("byteOffset", 0)).reshape(-1, width)
    pos = accessor(primitive["attributes"]["POSITION"], "<f4", 3).astype("f8")
    indices = accessor(primitive["indices"], "<u4", 1)
    ecef = pos + np.array(anchors[name])
    _, _, heights = to_geo.transform(*ecef.T)
    elevations = np.where(heights < 0, heights / 6, heights / 1.2).astype("<f4")
    local = ((ecef-origin) @ rotation.T / 1000).astype("<f4")
    assert np.isfinite(local).all() and np.isfinite(elevations).all()
    assert indices.max() < len(pos) and indices.size % 3 == 0
    payload = local.tobytes() + elevations.tobytes() + indices.tobytes()
    filename = name.replace(".glb", ".bin")
    (out / filename).write_bytes(payload)
    chunks.append(dict(file=filename, vertices=len(pos), triangles=indices.size//3,
                       bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest(),
                       source_sha256=hashlib.sha256(raw).hexdigest(),
                       bounds_km=[local.min(0).tolist(), local.max(0).tolist()],
                       elevation_range_m=[float(elevations.min()), float(elevations.max())]))
metadata = dict(title="Southern Haiti coastal terrain", origin_lon_lat=[lon, lat],
    axes="east, up, south; kilometres; WGS84 local tangent frame",
    format="Little endian: float32 XYZ[n,3], float32 elevation[n], uint32 triangle indices[m,3]",
    grid_spacing_m=100, vertical_exaggeration=dict(land=1.2, seabed=6),
    transformations="Original mesh topology retained; ECEF translated and rotated to local frame. Source textures and UVs excluded. Elevations recovered from ECEF and original exaggeration for display coloring.",
    sources=[dict(name="Global Multi-Resolution Topography Synthesis (GMRT)", url="https://gmrt.org/about/terms_of_use.php", license="CC BY 4.0", citation="Ryan et al. (2009), doi:10.1029/2008GC002332; data doi:10.1594/IEDA.100001"),
             dict(name="Mapzen Terrain Tiles / AWS; SRTM and GMTED2010 courtesy of USGS; ETOPO1 courtesy of NOAA", url="https://github.com/tilezen/joerd/blob/master/docs/attribution.md", license="Public-domain USGS/NOAA sources; attribution retained")],
    limits=["100 m is mesh sampling, not measurement accuracy.", "Gridded elevation reconstruction, not photogrammetry or measured LiDAR returns.", "Not for navigation; no routes or operational survey data included."], chunks=chunks)
(out / "metadata.json").write_text(json.dumps(metadata, indent=2)+"\n")
print(json.dumps(dict(chunks=len(chunks), vertices=sum(c["vertices"] for c in chunks), triangles=sum(c["triangles"] for c in chunks), bytes=sum(c["bytes"] for c in chunks))))
