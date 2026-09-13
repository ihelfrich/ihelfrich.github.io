import copy
import importlib.util
import json
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('utilities',Path(__file__).with_name('fetch_property_utilities.py'))
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
meta=json.loads((u.ROOT/'tests/fixtures/utilities/city-water-metadata.json').read_text())
def feature(**patch):
    return {'attributes':{'OBJECTID':27,'GlobalID':'{11111111-2222-3333-4444-555555555555}','address':'100 FIXTURE ST','utilmaterial':84,'utilsource':1,'utilstatus':2,'custmaterial':84,'custsource':3,'custstatus':2,**patch},'geometry':{'x':-90.2,'y':38.6}}
class InventoryTests(unittest.TestCase):
    def test_unknown_is_not_nonlead_and_private_fields_never_escape(self):
        f=feature(custstatus=0,custmaterial=None,accountid='private',owner='private')
        r=u.normalize(f,u.domains(meta))
        self.assertEqual(r['status'],'unknown');self.assertEqual(r['customerStatus']['label'],'Unknown')
        self.assertEqual(r['customerMaterial']['code'],None);self.assertEqual(r['customerMaterial']['label'],'Not supplied')
        self.assertNotIn('accountid',r);self.assertNotIn('owner',r);self.assertIsNone(r['recordKey']);self.assertIsNone(r['parcelKey'])
    def test_material_and_status_evidence_remain_separate(self):
        d=u.domains(meta)
        self.assertEqual(u.normalize(feature(),d)['status'],'non-lead')
        self.assertEqual(u.normalize(feature(custmaterial=109,custstatus=2),d)['status'],'lead')
        self.assertEqual(u.normalize(feature(custstatus=3),d)['status'],'galvanized-replacement')
        r=u.normalize(feature(custmaterial=89,custstatus=0),d)
        self.assertEqual(r['status'],'unknown');self.assertEqual(r['customerMaterial']['label'],'Galvanized Pipe - GP')
    def test_unrecognized_code_is_preserved_and_malformed_identity_rejected(self):
        d=u.domains(meta);r=u.normalize(feature(custsource=999),d)
        self.assertEqual(r['customerEvidence'],{'code':999,'label':'Unrecognized source code (999)','recognized':False})
        for patch in [{'OBJECTID':True},{'OBJECTID':0},{'GlobalID':'bad'},{'custsource':True},{'custstatus':2.2}]:
            with self.assertRaises(ValueError):u.normalize(feature(**patch),d)
    def test_invalid_coordinates_remain_unlocated(self):
        f=feature();f['geometry']={'x':None,'y':38.6};r=u.normalize(f,u.domains(meta))
        self.assertEqual(r['geometryStatus'],'unlocated');self.assertIsNone(r['longitude']);self.assertIsNone(r['latitude'])
    def test_changed_status_domain_fails_instead_of_reusing_old_category_rules(self):
        m=copy.deepcopy(meta)
        next(f for f in m['fields']if f['name']=='utilstatus')['domain']['codedValues'][1]['name']='Different meaning'
        with self.assertRaises(ValueError):u.domains(m)
    def test_semantic_checksum_detects_offsetting_record_changes_but_ignores_collection_time(self):
        d=u.domains(meta);a=u.normalize(feature(OBJECTID=1,custstatus=1),d);b=u.normalize(feature(OBJECTID=2,custstatus=0),d)
        before=u.semantic_records_hash([a,b])
        self.assertEqual(before,u.semantic_records_hash([dict(b,retrievedAt='2026-09-13'),dict(a,sourceRetrievedAt='2026-09-12')]))
        changed=[u.normalize(feature(OBJECTID=1,custstatus=0),d),u.normalize(feature(OBJECTID=2,custstatus=1),d)]
        self.assertEqual(sorted(r['status'] for r in [a,b]),sorted(r['status'] for r in changed))
        self.assertNotEqual(before,u.semantic_records_hash(changed))
if __name__=='__main__':unittest.main()
