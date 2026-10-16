"""Fetch the two pinned public NMTC inputs recorded in the released manifest.

Existing cache files are verified, never silently replaced. A changed upstream
release must be reviewed as a new vintage before updating expected hashes.
"""
from pathlib import Path
import hashlib
import json
import urllib.request

root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'public/spatial-economics/national/sources.json').read_text())
cache=root/'.geospatial-cache';cache.mkdir(exist_ok=True)
for source in manifest['sources']:
    target=cache/source['file']
    if target.exists():data=target.read_bytes()
    else:
        request=urllib.request.Request(source['url'],headers={'User-Agent':'HelfrichNationalInvestmentAtlas/1.0'})
        with urllib.request.urlopen(request,timeout=60) as response:data=response.read(20_000_001)
        if len(data)>20_000_000:raise ValueError('Unexpected source size')
    if hashlib.sha256(data).hexdigest()!=source['sha256']:
        raise ValueError(f"Source changed: {source['file']}. Review before updating the atlas.")
    if not target.exists():target.write_bytes(data)
    print(f"Verified {source['file']}: {len(data)} bytes")
