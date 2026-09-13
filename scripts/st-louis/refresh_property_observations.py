"""Bounded public-source collection with fail-retain-last-good publication.

Run with uv run --no-project python scripts/st-louis/refresh_property_observations.py.
--bootstrap-only records the existing complete snapshot without inventing changes.
--all-sources also executes the installed planning/incentive/utility collectors.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from property_history import (SOURCE_ID, SOURCE_URL, _apply_observation, apply_observation,
                              exchange_directory, now, ownership_input, read, record_failure)

COUNTY = {'id': SOURCE_ID, 'label': 'County public organization-name observations', 'url': SOURCE_URL}


def refresh_county(repo, timeout_seconds=300):
    public = repo / 'public/st-louis'
    history, current = public / 'history', public / 'ownership-signals'
    attempted = now()
    if not (history / 'manifest.json').exists():
        apply_observation(history, ownership_input(current), attempted)
    with tempfile.TemporaryDirectory(prefix='.county-observation-', dir=public) as temporary:
        stage = Path(temporary)
        fresh, staged_history = stage / 'ownership-signals', stage / 'history'
        try:
            subprocess.run([sys.executable, str(repo / 'scripts/st-louis/fetch_property_ownership.py'),
                            '--cache', str(stage / 'cache'), '--output', str(fresh),
                            '--region', str(public / 'regions/st-louis-county')],
                           cwd=repo, timeout=timeout_seconds, check=True, capture_output=True)
            payload = ownership_input(fresh)
            if read(current / 'index.json').get('recordCount', 0) > 0 and payload['recordCount'] == 0:
                raise ValueError('An empty County indicator source requires review; do not mass-remove the retained observations.')
            shutil.copytree(history, staged_history, copy_function=os.link)
            result = _apply_observation(staged_history, payload, attempted)
            # Each published tree is complete. If the second exchange fails,
            # restore the first before reporting failure. Pages publishes the
            # committed repository's combined artifact, never the staging tree.
            exchange_directory(fresh, current)
            try:
                exchange_directory(staged_history, history)
            except Exception:
                exchange_directory(fresh, current)
                raise
            return {'sourceId': SOURCE_ID, **result}
        except subprocess.TimeoutExpired:
            reason = 'source-timeout'
        except subprocess.CalledProcessError:
            reason = 'source-unavailable'
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            reason = 'snapshot-invalid'
        except (OSError, RuntimeError):
            reason = 'collector-failed'
    result = record_failure(history, COUNTY, reason, attempted)
    return {'sourceId': SOURCE_ID, **result, 'error': reason}


def utility_summary_input(manifest):
    counts = manifest.get('statusCounts')
    if (manifest.get('schema') != 'property-utilities-manifest-v1' or manifest.get('source', {}).get('id') != 'st-louis-city-water-materials'
            or not isinstance(counts, dict) or not counts or not all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in counts.values())
            or sum(counts.values()) != manifest.get('recordCount')):
        raise ValueError('Utility category counts do not reconcile the complete source snapshot.')
    source = {**manifest['source'], 'recordDateMeaning': 'Aggregate material-category counts in the complete City source snapshot; no individual household history is inferred.'}
    return {'schema': 'property-observation-input-v1', 'complete': True, 'source': source,
            'recordCount': len(counts), 'records': [
                {'id': f'material-category:{key}', 'title': f'City water inventory — {key}', 'sourceURL': source['url'], 'status': f'{count} source records'}
                for key, count in sorted(counts.items())]}


def refresh_optional(repo, ingest_local=False):
    """Discover explicitly approved collector files; never execute manifest commands."""
    public = repo / 'public/st-louis'
    jobs = [
        ('planning-documents', 'fetch_property_planning_documents.py', 300, False),
        ('incentives', 'fetch_property_incentives.py', 600, True),
        ('utilities', 'fetch_property_utilities.py', 600, False),
    ]
    results = []
    for directory, script, bound, shapely in jobs:
        path = repo / 'scripts/st-louis' / script
        if not path.exists():
            results.append({'sourceId': directory, 'status': 'not-configured'})
            continue
        attempted = now()
        command = ['uv', 'run', '--no-project', '--with', 'shapely', 'python', str(path)] if shapely else [sys.executable, str(path)]
        error = None
        if not ingest_local:
            try:
                subprocess.run(command, cwd=repo, timeout=bound, check=True, capture_output=True)
            except subprocess.TimeoutExpired:
                error = 'source-timeout'
            except subprocess.CalledProcessError:
                error = 'source-unavailable'
            except OSError:
                error = 'collector-failed'
        manifest_path = public / directory / 'manifest.json'
        source = None
        if manifest_path.exists():
            manifest = read(manifest_path)
            source = manifest.get('source')
        input_path = public / directory / 'history-input.json'
        if input_path.exists():
            payload = read(input_path)
            source = payload.get('source') or source
        else:
            payload = None
        if not source:
            # The sibling builder's own status.json remains the failure receipt
            # until an authoritative source identity has been established.
            results.append({'sourceId': directory, 'status': 'unavailable' if error else 'health-only', 'error': error})
            continue
        if error:
            results.append({'sourceId': source['id'], **record_failure(public / 'history', source, error, attempted)})
        elif payload:
            try:
                result = apply_observation(public / 'history', payload, attempted)
            except (ValueError, KeyError, TypeError):
                result = record_failure(public / 'history', source, 'snapshot-invalid', attempted)
            results.append({'sourceId': source['id'], **result})
        else:
            # Utility household points are not duplicated into history. Retain
            # source-level material-count observations, not household histories.
            try:
                payload = utility_summary_input(manifest)
                results.append({'sourceId': source['id'], **apply_observation(public / 'history', payload, attempted)})
            except (ValueError, KeyError, TypeError):
                results.append({'sourceId': source['id'], **record_failure(public / 'history', source, 'snapshot-invalid', attempted)})
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--bootstrap-only', action='store_true')
    parser.add_argument('--all-sources', action='store_true')
    parser.add_argument('--ingest-local', action='store_true', help='Record existing verified sibling inputs without fetching their sources again.')
    parser.add_argument('--county-timeout', type=int, default=300)
    args = parser.parse_args()
    if not 1 <= args.county_timeout <= 600:
        parser.error('County timeout must be between 1 and 600 seconds.')
    if args.bootstrap_only:
        result = apply_observation(args.repo / 'public/st-louis/history', ownership_input(args.repo / 'public/st-louis/ownership-signals'))
        print(json.dumps(result))
        return
    if args.ingest_local:
        results = refresh_optional(args.repo, True)
        print(json.dumps({'sources': results, 'mode': 'existing-source-receipts'}))
        if any(r['status'] == 'unavailable' for r in results):
            raise SystemExit(1)
        return
    results = [refresh_county(args.repo, args.county_timeout)]
    if args.all_sources:
        results.extend(refresh_optional(args.repo))
    print(json.dumps({'sources': results, 'meaning': 'Source observations; no inferred acquisitions.'}))
    if any(r['status'] == 'unavailable' for r in results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
