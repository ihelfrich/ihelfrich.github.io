# St. Louis data pipeline

The shipped `public/st-louis/city.json` is the frozen processed 2026-09-08 OSM snapshot. Its companion `data-manifest.json` records acquisition, object counts, geometry exclusions, assumptions and ODbL attribution. Source polygons are data; facade, tree and traffic details are authored presentation. See `docs/st-louis-model-register.md` for the calculation contract.

Rebuild from a directory containing `source.osm` and `source-manifest.json`:

    uv run --no-project --with shapely python scripts/st-louis/build_city.py --data-dir /path/to/snapshot
    uv run --no-project --with shapely python scripts/st-louis/validate_data.py --data-dir /path/to/snapshot

The command writes city.json and build records into that same directory; review validation before copying a new version to public/st-louis. The retained Overpass query in this folder is the acquisition recipe. Re-running a present-day query creates a new snapshot; it does not recreate the historical snapshot. The original raw file was retained in the task's work/stl-data-build directory, outside the Git checkout.

Run fixture checks:

    uv run --no-project --with shapely python -m unittest discover -s scripts/st-louis -p 'test_build.py'
    node --test tests/unit/city-analysis.test.mjs

The viewer is loaded only from `/st-louis`. `src/pages/lab.astro` links to it. The homepage does not import the city engine. The JSON snapshot is about 5.6 MB uncompressed, so a future broader geography should use tiled/versioned assets instead of expanding a monolithic download.
