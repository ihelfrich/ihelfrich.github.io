import importlib.util
import json
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('hpi',Path(__file__).with_name('fetch_property_hpi.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
HEADER='cbsa\tmetro_name\tyr\tqtr\tindex_nsa\tindex_sa\n'
def source():
 rows=[]
 for i in range(25):
  year=1991+i//4;quarter=i%4+1;index=100*1.01**i
  rows.append(f'41180\t"St. Louis, MO-IL"\t{year}\t{quarter}\t{index}\t99999')
 return (HEADER+'\n'.join(rows)).encode()
class HpiTests(unittest.TestCase):
 def test_true_compounding_and_nsa_not_sa(self):
  result=m.build(source(),'2026-09-13T00:00:00Z');self.assertEqual(len(result['observations']),25);self.assertEqual(result['observations'][0]['index'],100)
  for key in result['changes']:self.assertAlmostEqual(result['changes'][key],(1.01**4-1)*100,places=10)
  self.assertFalse(result['source']['forecast']);self.assertEqual(result['latest']['period'],'1997Q1')
 def test_missing_duplicate_foreign_identity_invalid_index_fail(self):
  rows=source().decode().splitlines()
  variants=['\n'.join(rows[:5]+rows[6:]),'\n'.join(rows+[rows[-1]]),source().decode().replace('St. Louis, MO-IL','Other Metro'),source().decode().replace('100.0\t99999','NaN\t99999')]
  for raw in variants:
   with self.assertRaises(ValueError):m.parse(raw.encode())
 def test_future_source_quarter_and_naive_retrieval_timestamp_fail(self):
  for date in ['1991-01-01T00:00:00Z','2026-09-13T00:00:00']:
   with self.assertRaises(ValueError):m.build(source(),date)
 def test_missing_trailing_period_is_unknown_not_zero(self):
  result=m.build(('\n'.join(source().decode().splitlines()[:4])).encode(),'2026-09-13T00:00:00Z');self.assertEqual(set(result['changes'].values()),{None})
 def test_failed_file_promotion_retains_last_good_publication(self):
  with tempfile.TemporaryDirectory() as root:
   path=Path(root)/'market-context.json';path.write_text('last-good')
   with patch.object(m.os,'replace',side_effect=OSError('fixture failure')):
    with self.assertRaises(OSError):m.atomic_write(path,b'new')
   self.assertEqual(path.read_text(),'last-good');self.assertEqual(list(Path(root).glob('*.tmp')),[])
 @unittest.skipUnless((m.RESEARCH/'hpi_po_metro.txt').exists(),'Local source acquisition audit requires the downloaded public FHFA file')
 def test_actual_saved_public_source_matches_compact_json(self):
  raw=(m.RESEARCH/'hpi_po_metro.txt').read_bytes();published=json.loads(m.OUTPUT.read_text());self.assertEqual(m.parse(raw),published['observations']);self.assertEqual(m.changes(published['observations']),published['changes'])
if __name__=='__main__':unittest.main()
