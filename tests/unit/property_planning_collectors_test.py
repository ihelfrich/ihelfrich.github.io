import copy,hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
def module(name):
 spec=importlib.util.spec_from_file_location(name,ROOT/'scripts/st-louis'/f'{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
docs=module('fetch_property_planning_documents');incentives=module('fetch_property_incentives')
class PlanningCollectors(unittest.TestCase):
 def test_visible_title_dates_require_real_days_and_corroborate_two_digit_years(self):
  self.assertEqual(docs.date_title('Hearing September 21, 2026'),'2026-09-21')
  self.assertIsNone(docs.date_title('Materials 5-19-25'))
  self.assertEqual(docs.date_title('Materials 5-19-25',2025),'2025-05-19')
  self.assertIsNone(docs.date_title('Materials 5-19-25',2024))
  self.assertEqual(docs.date_title('Draft 2.2.26',2026),'2026-02-02')
  self.assertIsNone(docs.date_title('Hearing February 30, 2026'))
 def test_status_keeps_agenda_preliminary_draft_and_adopted_distinct(self):
  self.assertEqual(docs.status_for('Preliminary agenda'),'preliminary-agenda')
  self.assertEqual(docs.status_for('Capital Needs Inventory Draft 2.2.26'),'draft-document')
  self.assertEqual(docs.status_for('Agenda: adoption of plan'),'agenda')
  self.assertEqual(docs.status_for('Capital Plan','The capital plan as adopted'),'adopted-plan-document')
  self.assertEqual(docs.status_for('Meeting minutes'),'meeting-minutes')
 def test_publication_is_not_taken_from_url_or_javascript(self):
  page=docs.page(b'<script>Publication Date: 09/12/2026</script><h1>Materials 5-19-25</h1><div>Publication Date: 05/16/2025</div><a href="old-copy-2024.cfm">Agenda</a>')
  self.assertEqual(docs.publication(page.text),'2025-05-16');self.assertEqual(docs.date_title(page.h1,2025),'2025-05-19')
 def test_failed_refresh_preserves_successful_index_and_history(self):
  for collector,fetch in [(docs,'acquire'),(incentives,'fetch_source')]:
   with tempfile.TemporaryDirectory()as t:
    out=Path(t)/'public';out.mkdir();old={'retrievedAt':'2026-09-01T00:00:00+00:00'}
    (out/'manifest.json').write_text(json.dumps(old));(out/'history-input.json').write_text('keep-existing-history');(out/'index.json').write_text('keep-existing-index')
    with patch.object(collector,'OUT',out),patch.object(collector,fetch,side_effect=RuntimeError('source unavailable')),patch('sys.argv',['collector']):
     with self.assertRaisesRegex(RuntimeError,'source unavailable'):collector.main()
    self.assertEqual((out/'history-input.json').read_text(),'keep-existing-history');self.assertEqual((out/'index.json').read_text(),'keep-existing-index');self.assertEqual(json.loads((out/'manifest.json').read_text()),old)
    status=json.loads((out/'status.json').read_text());self.assertEqual(status['state'],'failed');self.assertTrue(status['retainedPreviousData'])
 def test_abated_identity_requires_unique_two_identifier_match(self):
  snapshot=json.loads((ROOT.parent/'research/incentives-2026/abatements-verified-source.json').read_text());f=snapshot['features'][0];a=f['properties'];pair=(str(a['ParcelId']),str(a['HANDLE']));match={'recordKey':'exact','parcelKey':'handle','parcelId':str(a['ParcelId'])}
  r=incentives.normalize('tax-abatements',f,snapshot,{pair:[match]});self.assertEqual(r['recordKey'],'exact');self.assertEqual(r['datePrecision'],'year');self.assertIsNone(r['documentDate'])
  self.assertIsNone(incentives.normalize('tax-abatements',f,snapshot,{pair:[match,match]})['recordKey'])
  self.assertIsNone(incentives.normalize('tax-abatements',f,snapshot,{('other',pair[1]):[match]})['recordKey'])
  changed=copy.deepcopy(f);changed['properties']['AbatementStartYear']=2050;changed['properties']['AbatementEndYear']=2000
  self.assertIsNone(incentives.normalize('tax-abatements',changed,snapshot,{})['abatementStartYear'])
 def test_every_published_value_and_geometry_match_allowlisted_source(self):
  for layer,spec in incentives.SPECS.items():
   snapshot=json.loads((ROOT.parent/'research/incentives-2026'/(spec['cache']+'-verified-source.json')).read_text());source={f['properties']['OBJECTID']:f for f in snapshot['features']};d=json.loads((ROOT/'public/st-louis/incentives'/(layer+'.json')).read_text())
   self.assertEqual(len(source),len(d['records']))
   for row in d['records']:
    raw=source[row['sourceObjectId']];self.assertEqual(row['geometry'],raw['geometry']);self.assertEqual(row['sourceObservedAt'],snapshot['retrievedAt'])
    if layer=='tif-districts':
     self.assertEqual(row['rawDates'],{k:raw['properties'][k]for k in ['Date_Approved','Date_Completed','Payoff_Date']});self.assertEqual(row['sourceStatusCode'],raw['properties']['Incentive_Status']);self.assertEqual(row['amountUSD'],raw['properties']['Project_Amount'])
    else:self.assertEqual(row['rawYears'],{k:raw['properties'][k]for k in ['AbatementStartYear','AbatementEndYear']});self.assertEqual(row['sourceAbatementFlag'],raw['properties']['IsAbatedProperty'])
 def test_document_publication_receipts_links_and_manifest_match(self):
  path=ROOT/'public/st-louis/planning-documents';raw=(path/'index.json').read_bytes();data=json.loads(raw);manifest=json.loads((path/'manifest.json').read_text());self.assertEqual(hashlib.sha256(raw).hexdigest(),manifest['sha256']);self.assertEqual(len(raw),manifest['bytes']);self.assertEqual(len(data['records']),manifest['recordCount']);self.assertEqual(len(data['sources']),5)
  self.assertGreater(data['coverage']['linkedDocumentCount'],100);self.assertEqual(data['coverage']['georeferencedRecordCount'],0)
  for r in data['records']:
   self.assertTrue(docs.safe_url(r['sourceURL']));self.assertIsNone(r['longitude']);self.assertIsNone(r['latitude']);self.assertIsNone(r['recordKey']);self.assertEqual(r['geometryRole'],'unmapped-document');self.assertIsNone(r['amountUSD']);self.assertEqual(len(r['metadataSha256']),64)
   archived=docs.CACHE/'versions'/r['sourcePageSha256'];self.assertTrue(archived.exists());page=docs.page(archived.read_bytes())
   if r['sourceURL']!=r['landingPageURL']:
    urls={docs.urllib.parse.urljoin(r['landingPageURL'],a['url'])for a in page.links};self.assertIn(r['sourceURL'],urls)
   if r.get('contentSha256'):
    body=(docs.CACHE/'versions'/r['contentSha256']).read_bytes();self.assertEqual(hashlib.sha256(body).hexdigest(),r['contentSha256']);self.assertEqual(len(body),r['contentBytes'])
  self.assertTrue(any(r['status']=='draft-document'for r in data['records']));self.assertTrue(any(r['status']=='adopted-plan-document'for r in data['records']))
if __name__=='__main__':unittest.main()
