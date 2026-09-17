import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/st-louis'))
import property_history as history
import refresh_property_observations as collector
from fetch_property_ownership import publish_snapshot

T1 = '2026-09-12T18:00:00+00:00'
T2 = '2026-09-13T18:00:00+00:00'
T3 = '2026-09-14T18:00:00+00:00'


def record(oid=1, parcel='09D510625', name='EXAMPLE LLC'):
    return {'id': f'county-business-name:{oid}', 'recordKey': f'st-louis-county-current:{parcel}:{oid}',
            'parcelKey': f'st-louis-county:{parcel}', 'parcelId': parcel, 'sourceObjectId': oid,
            'jurisdiction': 'st-louis-county', 'ownerName': name, 'longitude': -90.25, 'latitude': 38.75}


def payload(rows=None, observed=T1):
    rows = rows if rows is not None else [record()]
    return {'schema': 'property-observation-input-v1', 'complete': True,
            'source': {**collector.COUNTY, 'retrievedAt': observed}, 'recordCount': len(rows), 'records': rows}


def tree(path):
    return {str(p.relative_to(path)): p.read_bytes() for p in path.rglob('*') if p.is_file()}


def ownership_fixture(path):
    path.mkdir(parents=True)
    r = {**record(), 'indicator': 'name_contains_legal_designator', 'matchedDesignator': 'LLC', 'ruleVersion': history.RULE}
    publish_snapshot({'schema': 'ownership-signals-v1', 'source': {**collector.COUNTY, 'retrievedAt': T1},
                      'ruleVersion': history.RULE, 'coverage': {'candidateFeatureCount': 1, 'publishedIndicatorCount': 1,
                      'rejectedTokenCandidates': 0, 'unmatchedExactRegionIdentityCount': 0,
                      'unmatchedSourceObjectIds': [], 'mappedIndicatorCount': 1}, 'records': [r]}, path)


class PropertyHistory(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'history'

    def source(self):
        return history.read(self.root / 'manifest.json')['sources'][0]

    def test_baseline_has_no_invented_events_and_exact_retry_is_byte_identical(self):
        result = history.apply_observation(self.root, payload(), T1)
        self.assertEqual(result, {'status': 'baseline', 'changes': 0, 'recordCount': 1})
        self.assertEqual(self.source()['events'], [])
        before = tree(self.root)
        self.assertEqual(history.apply_observation(self.root, payload(), T2)['status'], 'duplicate')
        self.assertEqual(tree(self.root), before)

    def test_unchanged_retrieval_adds_only_receipt_not_another_full_state(self):
        history.apply_observation(self.root, payload(), T1)
        old = self.source()
        result = history.apply_observation(self.root, payload(observed=T2), T2)
        new = self.source()
        self.assertEqual(result['status'], 'unchanged')
        self.assertEqual(old['baseline'], new['baseline'])
        self.assertEqual(old['latestState']['sha256'], new['latestState']['sha256'])
        self.assertEqual(old['semanticSha256'], new['semanticSha256'])
        self.assertEqual(len(new['observations']), 2)
        self.assertEqual(new['events'], [])
        self.assertEqual(len(list((self.root / 'state').glob('*.json'))), 1)
        self.assertEqual(len(list((self.root / 'baseline').glob('*.json'))), 1)

    def test_raw_name_changes_additions_and_removals_reconstruct_the_state(self):
        history.apply_observation(self.root, payload([record(), record(2, '09D510626')]), T1)
        next_rows = [record(name='Example LLC'), record(3, '09D510627', 'NEW LLC')]
        history.apply_observation(self.root, payload(next_rows, T2), T2)
        source = self.source()
        self.assertEqual(source['events'][0]['eventCount'], 3)
        partition = history.read(history.local_url(self.root, source['events'][0]['url']))
        self.assertEqual({r['kind'] for r in partition['events']}, {'owner-observation-changed', 'owner-observation-added', 'owner-observation-removed'})
        old_state = history.decode_state(history.read(history.local_url(self.root, source['baseline']['url'])), {'id': history.SOURCE_ID})
        for event in partition['events']:
            before, after = event['before'], event['after']
            self.assertIn('not an acquisition', event['meaning'])
            self.assertIsNone(event['address'])
            self.assertEqual(event['longitude'], -90.25)
            if before:
                self.assertEqual(old_state.pop(before['recordKey']), before)
            if after:
                old_state[after['recordKey']] = after
        latest = history.decode_state(history.read(history.local_url(self.root, source['latestState']['url'])), {'id': history.SOURCE_ID})
        self.assertEqual(old_state, latest)
        history.apply_observation(self.root, payload([record(name='THIRD LLC')], T3), T3)
        refs = self.source()['events']
        tail = history.read(history.local_url(self.root, refs[-1]['url']))
        self.assertEqual(tail['previousPartitionSha256'], refs[0]['sha256'])

    def test_failure_is_not_empty_data_and_recovery_with_same_rows_is_unchanged(self):
        history.apply_observation(self.root, payload(), T1)
        state = self.source()['latestState']
        history.record_failure(self.root, collector.COUNTY, 'source-unavailable', T2)
        failed = self.source()
        self.assertEqual(failed['status'], 'unavailable')
        self.assertEqual(failed['latestState'], state)
        self.assertEqual(failed['events'], [])
        self.assertEqual(failed['lastSuccessAt'], T1)
        self.assertEqual(history.apply_observation(self.root, payload(observed=T3), T3)['status'], 'unchanged')
        self.assertEqual(self.source()['status'], 'healthy')
        self.assertEqual(len(self.source()['observations']), 3)

    def test_malicious_identity_partial_snapshot_and_same_timestamp_conflict_fail_closed(self):
        history.apply_observation(self.root, payload(), T1)
        before = tree(self.root)
        invalid = []
        for key, value in [('recordKey', 'st-louis-city:09D510625:1'), ('parcelKey', 'st-louis-county:09D510626'),
                           ('sourceObjectId', True), ('parcelId', '../secret'), ('longitude', float('nan')),
                           ('mailingAddress', 'unrequested personal metadata')]:
            item = payload(observed=T2)
            item['records'][0][key] = value
            invalid.append(item)
        item = payload(observed=T2);item['source']['id'] = '../../outside';invalid.append(item)
        item = payload(observed=T2);item['source']['url'] = 'javascript:alert(1)';invalid.append(item)
        item = payload(observed=T2);item['complete'] = False;invalid.append(item)
        invalid += [payload([record(), record()], T2), payload([record(name='CHANGED LLC')], T1)]
        for item in invalid:
            with self.subTest(item=item):
                with self.assertRaises((ValueError, TypeError)):
                    history.apply_observation(self.root, item, T2)
                self.assertEqual(tree(self.root), before)

    def test_older_source_cannot_replace_newer_evidence(self):
        history.apply_observation(self.root, payload(observed=T2), T2)
        before = tree(self.root)
        with self.assertRaises(ValueError):
            history.apply_observation(self.root, payload(), T3)
        self.assertEqual(tree(self.root), before)

    def test_interrupted_write_keeps_entire_published_tree_unchanged(self):
        history.apply_observation(self.root, payload(), T1)
        before = tree(self.root)
        original = history.object_file
        def fail_late(root, relative, value, immutable=True):
            if relative.startswith('runs/'):
                raise OSError('fixture interrupted after state and event staging')
            return original(root, relative, value, immutable)
        with patch.object(history, 'object_file', side_effect=fail_late):
            with self.assertRaises(OSError):
                history.apply_observation(self.root, payload([record(name='NEW LLC')], T2), T2)
        self.assertEqual(tree(self.root), before)

    def test_current_snapshot_hash_path_and_unmatched_identity_are_verified(self):
        current = Path(self.temp.name) / 'ownership'
        ownership_fixture(current)
        self.assertEqual(history.ownership_input(current)['recordCount'], 1)
        original = history.read(current / 'index.json')
        for mode in ['path', 'hash', 'unmatched']:
            value = copy.deepcopy(original)
            if mode == 'path':
                value['tiles'][0]['id'] = '../../outside'
            elif mode == 'hash':
                value['tiles'][0]['sha256'] = '0' * 64
            else:
                value['coverage']['unmatchedExactRegionIdentityCount'] = 1
            (current / 'index.json').write_bytes(history.encode(value))
            with self.assertRaises(ValueError):
                history.ownership_input(current)

    def test_real_collector_403_and_timeout_keep_snapshot_and_prior_state(self):
        repo = Path(self.temp.name) / 'repo'
        current = repo / 'public/st-louis/ownership-signals'
        ownership_fixture(current)
        ledger = repo / 'public/st-louis/history'
        history.apply_observation(ledger, history.ownership_input(current), T1)
        before = tree(current)
        for failure in [subprocess.CalledProcessError(22, ['curl']), subprocess.TimeoutExpired(['collector'], 1)]:
            with patch.object(collector.subprocess, 'run', side_effect=failure):
                result = collector.refresh_county(repo, 1)
            self.assertEqual(result['status'], 'unavailable')
            self.assertEqual(tree(current), before)
            state = history.read(ledger / 'manifest.json')['sources'][0]
            self.assertEqual(state['lastSuccessAt'], T1)
            self.assertEqual(state['events'], [])

    def test_generic_document_observations_never_assert_foreign_parcel_ids(self):
        item = {'schema': 'property-observation-input-v1', 'complete': True,
                'source': {'id': 'county-planning-documents', 'label': 'County planning documents', 'url': 'https://stlouiscountymo.gov/', 'retrievedAt': T1},
                'recordCount': 1, 'records': [{'id': 'case:2026-1', 'title': 'Public hearing', 'sourceURL': 'https://stlouiscountymo.gov/document', 'status': 'hearing-listed'}]}
        self.assertEqual(history.apply_observation(self.root, item, T1)['status'], 'baseline')
        item['source']['retrievedAt'] = T2
        item['records'][0]['recordKey'] = 'st-louis-county-current:09D510625:1'
        with self.assertRaises(ValueError):
            history.apply_observation(self.root, item, T2)

    def test_literal_source_linebreaks_are_preserved_without_name_consolidation(self):
        item = payload([record(name='EXAMPLE\nLLC')])
        history.apply_observation(self.root, item, T1)
        state = history.read(history.local_url(self.root, self.source()['baseline']['url']))
        self.assertEqual(state['rows'][0][2], 'EXAMPLE\nLLC')

    def test_reused_arcgis_object_id_does_not_join_different_parcel_owners(self):
        history.apply_observation(self.root, payload(), T1)
        history.apply_observation(self.root, payload([record(parcel='09D510626', name='NEW LLC')], T2), T2)
        refs = self.source()['events']
        events = history.read(history.local_url(self.root, refs[0]['url']))['events']
        self.assertEqual({e['kind'] for e in events}, {'owner-observation-added', 'owner-observation-removed'})
        self.assertEqual({e['parcelId'] for e in events}, {'09D510625', '09D510626'})

    def test_utility_summary_tracks_four_categories_without_household_rows(self):
        manifest = {'schema': 'property-utilities-manifest-v1', 'source': {'id': 'st-louis-city-water-materials', 'name': 'City water materials', 'url': 'https://stlouis-mo.gov/water', 'retrievedAt': T1},
                    'recordCount': 10, 'statusCounts': {'lead': 1, 'non-lead': 3, 'unknown': 5, 'galvanized-replacement': 1}}
        summary = collector.utility_summary_input(manifest)
        self.assertEqual(summary['recordCount'], 4)
        self.assertTrue(all('address' not in row and 'parcelId' not in row for row in summary['records']))
        history.apply_observation(self.root, summary, T1)
        manifest['recordCount'] = 9
        with self.assertRaises(ValueError):
            collector.utility_summary_input(manifest)

    def test_dataset_digest_detects_compensating_material_changes_without_copying_households(self):
        item = {'schema': 'property-observation-input-v1', 'complete': True,
                'source': {'id': 'city-water-summary', 'label': 'City water category counts', 'url': 'https://stlouis-mo.gov/water',
                           'retrievedAt': T1, 'semanticRecordsSha256': 'a' * 64, 'semanticRecordsHashBasis': 'Complete normalized record contents; no retrieval metadata.'},
                'recordCount': 1, 'records': [{'id': 'lead-count', 'title': 'Lead material category', 'status': '10 source records'}]}
        history.apply_observation(self.root, item, T1)
        item['source'].update(retrievedAt=T2, semanticRecordsSha256='b' * 64)
        result = history.apply_observation(self.root, item, T2)
        self.assertEqual(result['status'], 'dataset-changed')
        self.assertEqual(result['changes'], 0)
        entry = self.source()
        self.assertEqual(entry['lastDatasetChangeObservedAt'], T2)
        self.assertEqual(entry['events'], [])
        self.assertEqual(entry['baseline']['sha256'], entry['latestState']['sha256'])
        receipt = history.read(history.local_url(self.root, entry['observations'][-1]['url']))
        self.assertTrue(receipt['datasetChanged'])
        self.assertEqual(receipt['previousDatasetSha256'], 'a' * 64)


if __name__ == '__main__':
    unittest.main()
