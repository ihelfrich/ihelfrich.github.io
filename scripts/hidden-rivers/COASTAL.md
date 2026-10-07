# Cape Peninsula representation retrieval

`build_coastal.py` reads the original Tessera v1.1 dClimate signed-byte vectors
for the same 5.12 km Cape Peninsula window as the earlier PCA illustration.
The native UTM grid is `EPSG:32634` with negative southern northings, as returned
by GeoTessera 0.11.0. Conversion to WGS84 uses that exact CRS and pixel centres.

```sh
python -m venv /tmp/tessera-build
/tmp/tessera-build/bin/pip install geotessera==0.11.0 pillow requests
/tmp/tessera-build/bin/python scripts/hidden-rivers/build_coastal.py \
  --output public/hidden-rivers/coastal --cache /tmp/tessera-coastal-cache
node --test tests/unit/hidden-rivers-coastal.test.mjs
```

Every second pixel is retained without resampling: 256 × 256 samples with 20 m
centre spacing, each representing one original 10 m pixel. All 128 components
are retained. The browser download is approximately 9 MB plus imagery.

The published store represents pixel `i` as `s_i q_i`, where `s_i > 0` is a
scalar and `q_i` is a signed-byte vector. Therefore

`cos(s_i q_i, s_j q_j) = cos(q_i, q_j)`.

This removes the need to ship per-pixel scales for the cosine calculation.
Scales are used during export to identify valid vectors. There is no extra
quantization, learned proxy, PCA truncation, or resampling of embeddings.
The source store is itself quantized; no claim is made about agreement with
unreleased pre-quantization neural network outputs.

The build checks 10,000 seeded pixel pairs against the float32-dequantized
vectors. Maximum absolute cosine error was 9.521314625615673e-9 in this release.
This verifies numerical encoding, not ecological or oceanographic validity.
The browser uses float64 norms and dot products, and stores output scores as
float32 for rendering. Numerical tests also check nodata propagation, cosine
scale invariance, self-similarity, difference symmetry, and distance exclusion.

The interface offers two calculations:

- Similarity to a selected reference A: `cos(x,A)`. Cividis uses a fixed displayed
  range 0.50–1.00, with lower values clipped to the darkest color. The displayed
  fraction counts valid sampled vectors at or above the adjustable threshold;
  it is not a class probability or an area estimate.
- Contrast of references A and B: `cos(x,A) - cos(x,B)`. The fixed diverging range
  is -0.25–0.25. Blue favors B, orange favors A, and neutral means equal scores.
  Values beyond that range are color-clipped, but exported CSV scores are not.

The five similarity matches exclude points within 400 m of A, then greedily
retain candidates at least 300 m apart. This avoids a list of adjacent pixels;
it does not constitute a spatial holdout validation or remove spatial bias.

The Esri context image is requested on the equivalent southern UTM grid
`EPSG:32734` by adding 10,000,000 m to the native northings. It is a mixed-date
image mosaic and is not a 2024 paired observation. Geographic selection can
move the linked Cesium viewer, but no statistical relationship to HYCOM is
estimated by this interface.

Provenance, exact transforms, checksums, sources, dimensions and validation
results are in `public/hidden-rivers/coastal/manifest.json`. The frontend is
`coastal.js`; `coastal.worker.js` computes fields away from the UI thread;
`coastal-math.mjs` contains the shared numerical functions.
