"""Validate the exact scientific binaries distributed with Hidden Rivers.

Uses only Python's standard library. This verifies release consistency; it
cannot establish observational accuracy or recover coordinates/timestamps lost
when source NetCDF variables were packed into component arrays.
"""
from array import array
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/hidden-rivers/data'
UNITS = dict(vorticity='s^-1', strain='s^-1', divergence='s^-1',
             okuboWeiss='s^-2', ftle='day^-1')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    return json.loads(path.read_text(), parse_constant=lambda value:
                      (_ for _ in ()).throw(ValueError(f'{path.name}: invalid JSON {value}')))


def dates(values, count, label):
    require(isinstance(values, list) and len(values) == count,
            f'{label}: timestamp count does not match time dimension')
    result = []
    for value in values:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        require(stamp.tzinfo is not None and stamp.utcoffset().total_seconds() == 0,
                f'{label}: timestamps must explicitly use UTC')
        result.append(stamp.timestamp())
    require(all(b > a for a, b in zip(result, result[1:])),
            f'{label}: timestamps must increase strictly')
    return result


def shape(value, dimensions, label):
    require(isinstance(value, list) and len(value) == dimensions and
            all(isinstance(x, int) and not isinstance(x, bool) and x > 0 for x in value),
            f'{label}: invalid {dimensions}-dimensional shape')
    return value


def grid(metadata, label):
    for key in ['lon0', 'lat0', 'dlon', 'dlat']:
        require(isinstance(metadata.get(key), (int, float)) and math.isfinite(metadata[key]),
                f'{label}: {key} must be finite')
    require(metadata['dlon'] > 0 and metadata['dlat'] > 0,
            f'{label}: longitude and latitude must increase')


def binary(data, filename, typecode, count, report):
    require(isinstance(filename, str) and Path(filename).name == filename,
            'Binary filenames must be local basenames')
    path = data / filename
    raw = path.read_bytes()
    values = array(typecode)
    require(len(raw) == count * values.itemsize,
            f'{filename}: expected {count * values.itemsize} bytes, got {len(raw)}')
    values.frombytes(raw)
    if sys.byteorder != 'little':
        values.byteswap()
    report['files'][filename] = dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    return values


def validate_coastal(directory, report):
    """Check published 128-D vectors, their mask, coordinates and source hashes."""
    metadata = read_json(directory/'manifest.json')
    width, height, dimensions = metadata['width'], metadata['height'], metadata['dimensions']
    require(all(isinstance(x, int) and x > 0 for x in (width, height, dimensions)),
            'Coastal embedding dimensions must be positive integers')
    require(dimensions == 128, 'This Tessera release must retain all 128 dimensions')
    local = dict(files={}); count = width*height
    vectors = binary(directory, 'vectors.i8', 'b', count*dimensions, local)
    valid = binary(directory, 'valid.u8', 'B', count, local)
    coords = binary(directory, 'coordinates.f32', 'f', count*2, local)
    require(all(value in (0,1) for value in valid), 'Coastal mask must be binary')
    require(sum(valid) == metadata['validCount'] and count == metadata['totalCount'],
            'Coastal valid coverage disagrees with manifest')
    for name, properties in local['files'].items():
        require(properties == metadata['files'][name], f'Coastal {name}: source hash or byte count mismatch')
        report['files']['coastal/'+name] = properties
    for index, is_valid in enumerate(valid):
        nonzero = any(vectors[index*dimensions:(index+1)*dimensions])
        require(nonzero == bool(is_valid), 'Coastal nonzero-vector mask disagrees with published validity')
    west, south, east, north = metadata['bounds']
    for index in range(count):
        lon, lat = coords[index*2:index*2+2]
        require(math.isfinite(lon+lat) and west-1e-4 <= lon <= east+1e-4 and south-1e-4 <= lat <= north+1e-4,
                'Coastal pixel coordinates must be finite and inside the recorded footprint')
    raw = (directory/'manifest.json').read_bytes()
    report['files']['coastal/manifest.json'] = dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    report['coastal'] = dict(dimensions=dimensions, shape=[height,width], valid=sum(valid), total=count,
        note='Checks vector/mask/coordinate integrity. Does not infer semantic labels or independently revalidate the source model.')


def validate(data=DATA, require_diagnostics=True):
    data = Path(data)
    manifest = read_json(data / 'manifest.json')
    report = dict(schemaVersion=1, validatedAt=datetime.now(timezone.utc).isoformat(),
                  files={}, regions=[], checks=[
                      'Binary lengths, little-endian dtypes, shape and date agreement',
                      'Velocity component packing, masks and regular input cadence',
                      'Diagnostic source SHA-256, units, coverage and full FTLE horizon',
                      'Finite values, valid display domains and diagnostic coverage counts'])
    scale, missing = manifest.get('velocityScale'), manifest.get('missing')
    require(isinstance(scale, (int, float)) and math.isfinite(scale) and scale > 0,
            'velocityScale must be positive and finite')
    require(missing == -32768, 'Expected int16 missing sentinel -32768')
    require(isinstance(manifest.get('regions'), list) and manifest['regions'], 'No regions')
    layers = {}
    for region in manifest['regions']:
        require(region['id'] not in [r['id'] for r in report['regions']], 'Duplicate region id')
        bounds = region['bounds']
        require(len(bounds) == 4 and all(math.isfinite(x) for x in bounds) and
                -180 <= bounds[0] < bounds[2] <= 180 and -90 <= bounds[1] < bounds[3] <= 90,
                f"{region['id']}: invalid geographic bounds")
        region_report = dict(id=region['id'], layers=[])
        report['regions'].append(region_report)
        for layer in region['layers']:
            filename = layer['file']; label = f"{region['id']} / {layer['depth']} m"
            key = (region['id'], layer['depth'])
            require(key not in layers, f'{label}: duplicate depth')
            nt, ny, nx = shape(layer['shape'], 3, label)
            require(min(nt, ny, nx) >= 2, f'{label}: interpolation needs at least two points on every axis')
            grid(layer, label)
            stamps = dates(layer['dates'], nt, label)
            intervals = [b-a for a,b in zip(stamps, stamps[1:])]
            require(max(intervals)-min(intervals) < 1e-6, f'{label}: input cadence is irregular')
            if 'timeStepSeconds' in layer:
                require(abs(layer['timeStepSeconds']-intervals[0]) < 1e-6,
                        f'{label}: declared time step disagrees with timestamps')
            require(-90 <= layer['lat0'] <= layer['lat0']+(ny-1)*layer['dlat'] <= 90,
                    f'{label}: latitude grid leaves the globe')
            values = binary(data, filename, 'h', 2*nt*ny*nx, report)
            if 'sha256' in layer:
                require(layer['sha256'] == report['files'][filename]['sha256'],
                        f'{label}: manifest hash disagrees with packed velocity')
            if 'units' in layer:
                require(layer['units'] in ('m/s', 'm s-1', 'm s^-1'), f'{label}: velocity units must be m/s')
            plane = nt*ny*nx; valid = 0; mismatch = 0; maximum = 0
            for index in range(plane):
                u, v = values[index], values[plane+index]
                mismatch += (u == missing) != (v == missing)
                if u != missing and v != missing:
                    valid += 1
                    maximum = max(maximum, math.hypot(u, v)*scale)
            require(valid > 0, f'{label}: no jointly valid velocity samples')
            if 'speedMax' in layer:
                # Each packed component has at most half a scale unit of rounding error.
                require(abs(maximum-layer['speedMax']) <= math.sqrt(2)*scale/2+1e-5,
                        f'{label}: speedMax disagrees with packed components')
            region_report['layers'].append(dict(depth=layer['depth'], shape=layer['shape'],
                timeStepSeconds=intervals[0], start=layer['dates'][0], end=layer['dates'][-1],
                jointValid=valid, total=plane, componentMaskDisagreements=mismatch,
                speedMaximumMetresPerSecond=maximum))
            layers[key] = (layer, stamps)
        terrain = region['terrain']; grid(terrain, region['id']+' terrain')
        terrain_shape = shape(terrain['shape'], 2, 'terrain')
        elevations = binary(data, terrain['file'], 'h', math.prod(terrain_shape), report)
        require(all(-12000 <= x <= 10000 for x in elevations),
                f"{terrain['file']}: implausible elevation or unhandled missing sentinel")

    if 'provenance' in manifest:
        report['provenanceChecks'] = []
        for key, (layer, _) in layers.items():
            provenance = layer.get('provenance', manifest['provenance'])
            require(Path(provenance).name == provenance, 'Provenance must be a local basename')
            document = read_json(data/provenance)
            if 'ocean' in document:
                # The archival manifest records requests, not decoded NetCDF
                # component metadata. Verify only what is actually recorded.
                requests = document['ocean']['requests'] + document.get('additional_depths', [])
                region = next(r for r in manifest['regions'] if r['id'] == key[0])
                west, south, east, north = region['bounds']
                pair = []
                for item in requests:
                    q = parse_qs(urlparse(item['url']).query)
                    number = lambda name: float(q[name][0])
                    if (number('vertCoord') == key[1] and number('south') == south and
                        number('north') == north and number('west') % 360 == west % 360 and
                        number('east') % 360 == east % 360):
                        require(q['time_start'][0] == layer['dates'][0] and
                                q['time_end'][0] == layer['dates'][-1],
                                f'{key}: archival request interval disagrees with release')
                        pair.append(q['var'][0])
                require(sorted(pair) == ['water_u','water_v'], f'{key}: missing archival request pair')
                report['provenanceChecks'].append(dict(region=key[0], depth=key[1], file=provenance,
                    checked='Request variables, geographic extent, depth, and interval. Original decoded component metadata unavailable.'))
                continue
            requests = document['requests']
            pair = [item for item in requests if (item['region'], item['depth']) == key]
            require(len(pair) == 2 and {item['component'] for item in pair} == {'u','v'},
                    f'{key}: provenance must identify exactly one u/v pair')
            for item in pair:
                require(item['dates'] == layer['dates'] and item['shape'] == layer['shape'],
                        f'{key}: source component times or dimensions disagree with release')
                require(item['units'] in ('m/s', 'm s-1', 'm s^-1'), f'{key}: wrong source units')
                require(len(item['sha256']) == 64 and all(x in '0123456789abcdef' for x in item['sha256']),
                        f'{key}: invalid source checksum')
            report['provenanceChecks'].append(dict(region=key[0], depth=key[1], file=provenance,
                checked='Paired component metadata, dimensions, UTC dates, units, and recorded checksum syntax.'))

    diagnostic_path = data / 'diagnostics.json'
    if require_diagnostics or diagnostic_path.exists():
        diagnostic = read_json(diagnostic_path)
        seen = set()
        for region in diagnostic['regions']:
            for item in region['layers']:
                key = (region['id'], item['depth'])
                require(key in layers and key not in seen, f'{key}: unexpected or duplicate diagnostic layer')
                seen.add(key); layer, source_dates = layers[key]
                source = item['sourceFile']
                require(source == layer['file'], f'{key}: wrong diagnostic source file')
                require(item['sourceSha256'] == report['files'][source]['sha256'],
                        f'{key}: diagnostics were computed from a different velocity file')
                ny, nx = shape(item['grid']['shape'], 2, str(key)); grid(item['grid'], str(key))
                require(set(item['fields']) == set(UNITS), f'{key}: missing or unknown diagnostic fields')
                for name, field in item['fields'].items():
                    label = field['file']; nt, fy, fx = shape(field['shape'], 3, label)
                    require((fy, fx) == (ny, nx), f'{label}: diagnostic grid shape mismatch')
                    require(field['units'] == UNITS[name], f'{label}: incorrect physical units')
                    stamps = dates(field['dates'], nt, label)
                    require(all(stamp in source_dates for stamp in stamps),
                            f'{label}: diagnostic times must be source sample times')
                    if name == 'ftle':
                        horizon = field.get('horizonHours', diagnostic['method'].get('ftleHorizonHours'))
                        require(isinstance(horizon, (int, float)) and horizon > 0 and
                                all(stamp+horizon*3600 <= source_dates[-1] for stamp in stamps),
                                f'{label}: incomplete or extrapolated FTLE horizon')
                    domain = field['displayDomain']
                    require(len(domain) == 2 and all(math.isfinite(x) for x in domain) and domain[0] < domain[1],
                            f'{label}: invalid color domain')
                    values = binary(data, label, 'f', nt*ny*nx, report)
                    if 'sha256' in field:
                        require(field['sha256'] == report['files'][label]['sha256'],
                                f'{label}: diagnostic checksum disagrees with metadata')
                    require(not any(math.isinf(x) for x in values), f'{label}: infinity is not a valid mask')
                    finite = [x for x in values if math.isfinite(x)]
                    require(finite, f'{label}: no finite diagnostic values')
                    if name == 'strain':
                        require(min(finite) >= 0, f'{label}: strain magnitude cannot be negative')
                    require(field['stats']['valid'] == len(finite) and field['stats']['total'] == len(values),
                            f'{label}: coverage summary disagrees with binary')
                    if 'frames' in field:
                        require(len(field['frames']) == nt, f'{label}: frame summary count mismatch')
                        for index, frame in enumerate(field['frames']):
                            count = sum(math.isfinite(x) for x in values[index*ny*nx:(index+1)*ny*nx])
                            require(frame['valid'] == count and frame['total'] == ny*nx,
                                    f'{label}: frame {index} coverage mismatch')
                    report['files'][label].update(valid=len(finite), total=len(values),
                                                  minimum=min(finite), maximum=max(finite))
        require(seen == set(layers), 'Not every velocity layer has diagnostics')
    for filename in {'manifest.json', 'source-requests.json', 'diagnostics.json', 'tessera_metadata.json',
                     'tessera_pca.npz', manifest.get('provenance', 'source-requests.json')}:
        path = data / filename
        if path.exists():
            raw = path.read_bytes()
            report['files'][filename] = dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    coastal = data.parent/'coastal'
    if (coastal/'manifest.json').exists():
        validate_coastal(coastal, report)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=DATA)
    parser.add_argument('--report', type=Path, help='Optional JSON audit report with hashes')
    parser.add_argument('--allow-no-diagnostics', action='store_true', help='Validate a legacy velocity-only release')
    args = parser.parse_args()
    try:
        result = validate(args.data, not args.allow_no_diagnostics)
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n')
        print(f"Validated {len(result['regions'])} regions and {len(result['files'])} files.")
        for item in result['regions']:
            print(item['id']+': '+', '.join(f"{x['depth']} m / {x['shape'][0]} frames / {x['timeStepSeconds']/3600:g} h cadence" for x in item['layers']))
    except (ValueError, KeyError, OSError, TypeError) as error:
        print(f'Release validation failed: {error}', file=sys.stderr)
        sys.exit(1)
