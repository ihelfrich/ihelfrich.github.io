import sys, unittest, json, tempfile, hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts/st-louis'))
from fetch_property_ownership import PATTERN, add_name_index
class LegalDesignatorTokens(unittest.TestCase):
 def test_designations(self):
  for name in ['EXAMPLE LLC','EXAMPLE L.L.C.','EXAMPLE L L C','EXAMPLE INC.','EXAMPLE INCORPORATED','EXAMPLE CORP','EXAMPLE CORPORATION','EXAMPLE LP','EXAMPLE L.P.','EXAMPLE LLP','EXAMPLE LTD','EXAMPLE LIMITED']:
   with self.subTest(name=name):self.assertIsNotNone(PATTERN.search(name))
 def test_substrings_are_not_entity_designations(self):
  for name in ['EXAMPLE INCOME FUND','EXAMPLE INCREDIBLE','EXAMPLE CORPSMAN','EXAMPLE LPGA','EXAMPLE LLCX','LINCOLN','EXAMPLE INCUMBENT','PERSON EXAMPLE']:
   with self.subTest(name=name):self.assertIsNone(PATTERN.search(name))
 def test_company_style_personal_name_is_only_name_evidence(self):
  self.assertIsNotNone(PATTERN.search('A SAMPLE CONSULTING LLC'))
 def test_normalized_search_does_not_merge_literal_name_variants(self):
  with tempfile.TemporaryDirectory() as temporary:
   base=Path(temporary);(base/'tiles').mkdir()
   rows=[{'sourceObjectId':1,'ownerName':'EXAMPLE LLC','ruleVersion':'test-v1'},{'sourceObjectId':2,'ownerName':'Example LLC','ruleVersion':'test-v1'},{'sourceObjectId':3,'ownerName':'EXAMPLE LLC','ruleVersion':'test-v1'}]
   data={'id':'cell','sourceId':'test-source','records':rows};raw=json.dumps(data).encode();(base/'tiles/cell.json').write_bytes(raw)
   manifest={'source':{'id':'test-source','retrievedAt':'2026-09-12T18:00:00Z'},'ruleVersion':'test-v1','recordCount':3,'unlocatedCount':0,'coverage':{'mappedIndicatorCount':3},'tiles':[{'id':'cell','count':3,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}]}
   (base/'index.json').write_text(json.dumps(manifest));add_name_index(base)
   index=json.loads((base/'names-index.json').read_text());self.assertEqual(len(index['records']),2)
   self.assertEqual({r['normalizedOwnerName'] for r in index['records']},{'example llc'})
   self.assertEqual({r['name']:r['count'] for r in index['records']},{'EXAMPLE LLC':2,'Example LLC':1})
if __name__=='__main__':unittest.main()
