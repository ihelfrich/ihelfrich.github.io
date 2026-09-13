import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('infrastructure',Path(__file__).with_name('fetch_property_infrastructure.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class InfrastructureTests(unittest.TestCase):
 def test_html_link_only_accepts_official_https(self):
  good='https://www.stlouis-mo.gov/government/departments/public-service/projects/project.cfm?id=1'
  self.assertEqual(m.official_link('<a href="'+good+'">Project</a>','fallback'),good)
  for value in ['javascript:alert(1)','https://www.stlouis-mo.gov.evil.test/','https://user@www.stlouis-mo.gov/','https://www.stlouis-mo.gov:BAD/','<a href="https://evil.test/">evil</a>']:
   self.assertEqual(m.official_link(value,'fallback'),'fallback')
 def test_transform_preserves_source_geometry_and_omits_private_fields(self):
  raw={'attributes':{'OBJECTID':3,'LightID':'42','Responsible_Party':'must not survive','Conduit_No':'must not survive','Date_Installed':'unknown-format'},'geometry':{'x':-90.21,'y':38.6}}
  f=m.transform(raw,m.SOURCES[0],2)
  self.assertEqual(f['geometry'],{'type':'Point','coordinates':[-90.21,38.6]})
  self.assertNotIn('Responsible_Party',json.dumps(f));self.assertNotIn('Conduit_No',json.dumps(f))
  self.assertEqual(f['properties']['attributes']['Date_Installed'],'unknown-format')
 def test_capital_layer_schema_and_actual_status_stay_raw(self):
  raw={'attributes':{'OBJECTID':8,'Name':'Bridge project','Status':'SOURCE TEXT','Page':'javascript:bad','Location':'Fixture corridor'},'geometry':{'x':-90.21,'y':38.6}}
  f=m.transform(raw,m.SOURCES[1],0)
  self.assertEqual(f['properties']['title'],'Bridge project');self.assertEqual(f['properties']['attributes']['Status'],'SOURCE TEXT')
  self.assertEqual(f['properties']['sourceURL'],m.SOURCES[1]['url']+'/0')
 def test_exact_ids_count_and_duplicates_fail(self):
  for first,second in [({'objectIdFieldName':'OBJECTID','objectIds':[1,1]},None),({'objectIdFieldName':'OBJECTID','objectIds':[1]},{'count':2}),({'objectIdFieldName':'OTHER','objectIds':[1]},None)]:
   with patch.object(m,'request',side_effect=[first,second]):
    with self.assertRaises(ValueError):m.ids('https://source',10)
 def test_geometry_rejects_nonfinite_and_preserves_multiline(self):
  for raw in [{'x':float('nan'),'y':2},{'x':-200,'y':38},{'paths':[[[1,1]]]}]:
   with self.assertRaises(ValueError):m.geometry(raw)
  self.assertEqual(m.geometry({'paths':[[[1,1],[2,2]],[[3,3],[4,4]]]})['type'],'MultiLineString')
 def test_cached_identity_and_attributes_are_checked_before_rebuild(self):
  source=m.SOURCES[0];f=m.transform({'attributes':{'OBJECTID':1},'geometry':{'x':-90.21,'y':38.6}},source,2)
  for mutate in [lambda x:x['properties'].update(sourceObjectId=2),lambda x:x['properties'].update(sourceURL='javascript:bad'),lambda x:x['properties']['attributes'].update(Responsible_Party='private')]:
   bad=copy.deepcopy(f);mutate(bad)
   with self.assertRaises(ValueError):m.clean_cached_feature(bad,source,2)
 def test_failed_atomic_promotion_restores_last_good_data(self):
  with tempfile.TemporaryDirectory() as root:
   root=Path(root);output=root/'public';output.mkdir();(output/'manifest.json').write_text('last-good');stage=root/'stage';stage.mkdir();original=Path.rename
   def rename(path,target):
    if path==stage:raise OSError('fixture failed rename')
    return original(path,target)
   with patch.object(Path,'rename',rename):
    with self.assertRaises(OSError):m.publish(stage,output)
   self.assertEqual((output/'manifest.json').read_text(),'last-good')

if __name__=='__main__':unittest.main()
