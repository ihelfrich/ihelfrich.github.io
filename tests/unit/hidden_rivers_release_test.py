"""Release-contract checks against deliberately malformed scientific bundles."""
from array import array
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('hidden_rivers_release', ROOT/'scripts/hidden-rivers/validate-release.py')
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


def write_array(path, kind, values):
    packed = array(kind, values)
    if sys.byteorder != 'little':
        packed.byteswap()
    path.write_bytes(packed.tobytes())


class ReleaseContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.data = Path(self.temporary.name)
        self.grid = dict(lon0=0, lat0=0, dlon=1, dlat=1)
        self.dates = ['2026-09-29T00:00:00Z', '2026-09-30T00:00:00Z', '2026-10-01T00:00:00Z']
        write_array(self.data/'velocity.bin', 'h', [1000]*27+[0]*27)
        write_array(self.data/'terrain.bin', 'h', [-1000]*9)
        layer = dict(file='velocity.bin', shape=[3,3,3], depth=0, dates=self.dates, speedMax=1, **self.grid)
        self.manifest = dict(velocityScale=.001, missing=-32768, regions=[dict(id='test', bounds=[0,0,2,2],
            layers=[layer], terrain=dict(file='terrain.bin', shape=[3,3], **self.grid))])
        fields = {}
        for name, units in release.UNITS.items():
            count = 1 if name == 'ftle' else 3
            filename = name+'.bin'
            write_array(self.data/filename, 'f', [.1]*(count*9))
            fields[name] = dict(file=filename, shape=[count,3,3], dates=self.dates[:count], units=units,
                displayDomain=[0,1], stats=dict(valid=count*9,total=count*9),
                frames=[dict(valid=9,total=9)]*count)
        self.diagnostics = dict(method=dict(ftleHorizonHours=48), regions=[dict(id='test', layers=[dict(
            depth=0, grid=dict(shape=[3,3], **self.grid), fields=fields,
            sourceFile='velocity.bin', sourceSha256=hashlib.sha256((self.data/'velocity.bin').read_bytes()).hexdigest())])])
        self.save()

    def save(self):
        (self.data/'manifest.json').write_text(json.dumps(self.manifest))
        (self.data/'diagnostics.json').write_text(json.dumps(self.diagnostics))

    def test_valid_bundle_has_hashes_and_cadence(self):
        report = release.validate(self.data)
        self.assertEqual(report['regions'][0]['layers'][0]['timeStepSeconds'], 86400)
        self.assertEqual(report['files']['velocity.bin']['bytes'], 108)
        self.assertEqual(len(report['files']['ftle.bin']['sha256']), 64)

    def test_partial_download_is_rejected(self):
        (self.data/'velocity.bin').write_bytes(b'partial')
        with self.assertRaisesRegex(ValueError, 'expected 108 bytes'):
            release.validate(self.data)

    def test_irregular_input_times_are_rejected(self):
        self.manifest['regions'][0]['layers'][0]['dates'][1] = '2026-09-30T03:00:00Z'
        self.save()
        with self.assertRaisesRegex(ValueError, 'cadence is irregular'):
            release.validate(self.data)

    def test_stale_diagnostics_are_rejected(self):
        self.diagnostics['regions'][0]['layers'][0]['sourceSha256'] = '0'*64
        self.save()
        with self.assertRaisesRegex(ValueError, 'different velocity file'):
            release.validate(self.data)

    def test_infinite_diagnostics_are_rejected(self):
        write_array(self.data/'ftle.bin', 'f', [float('inf')]+[.1]*8)
        with self.assertRaisesRegex(ValueError, 'infinity is not a valid mask'):
            release.validate(self.data)

    def test_shortened_ftle_horizon_is_rejected(self):
        self.diagnostics['regions'][0]['layers'][0]['fields']['ftle']['dates'] = [self.dates[1]]
        self.save()
        with self.assertRaisesRegex(ValueError, 'incomplete or extrapolated FTLE horizon'):
            release.validate(self.data)

    def test_mask_coverage_is_verified(self):
        write_array(self.data/'ftle.bin', 'f', [float('nan')]+[.1]*8)
        with self.assertRaisesRegex(ValueError, 'coverage summary disagrees'):
            release.validate(self.data)

    def test_component_provenance_dates_are_verified(self):
        self.manifest['provenance'] = 'requests.json'
        requests = [dict(region='test', depth=0, component=component, dates=self.dates[:],
                         shape=[3,3,3], units='m/s', sha256='1'*64) for component in ['u','v']]
        requests[1]['dates'][1] = '2026-09-30T03:00:00Z'
        (self.data/'requests.json').write_text(json.dumps(dict(requests=requests)))
        self.save()
        with self.assertRaisesRegex(ValueError, 'source component times or dimensions disagree'):
            release.validate(self.data)

    def test_manifest_velocity_hash_is_verified(self):
        self.manifest['regions'][0]['layers'][0]['sha256'] = '0'*64
        self.save()
        with self.assertRaisesRegex(ValueError, 'manifest hash disagrees'):
            release.validate(self.data)

    def test_coastal_embedding_coordinates_must_match_footprint(self):
        coast = self.data/'coastal'; coast.mkdir()
        write_array(coast/'vectors.i8', 'b', [1]+[0]*127)
        write_array(coast/'valid.u8', 'B', [1])
        write_array(coast/'coordinates.f32', 'f', [0.5,50])
        files = {name: dict(bytes=(coast/name).stat().st_size,
                 sha256=hashlib.sha256((coast/name).read_bytes()).hexdigest())
                 for name in ['vectors.i8','valid.u8','coordinates.f32']}
        (coast/'manifest.json').write_text(json.dumps(dict(width=1, height=1, dimensions=128,
            validCount=1, totalCount=1, bounds=[0,0,1,1], files=files)))
        with self.assertRaisesRegex(ValueError, 'inside the recorded footprint'):
            release.validate_coastal(coast, dict(files={}))


if __name__ == '__main__':
    unittest.main()
