"""Build a bounded, dated official planning registry and historical source-point index.
uv run --no-project python scripts/st-louis/fetch_property_planning.py --cache ../research/planning-2026/cache --output public/st-louis/planning
Requires pdftotext for the official three-page City agenda. --resume reuses hashed
responses; it does not claim the sources were checked again. The registry is a
curated set, not a complete permit/project feed. Hearing venues are never project
locations. County GIS points retain source petition/procedure strings and unknown
decision status; they are not matched to contemporary notices without exact evidence.
"""
import argparse, hashlib, json, math, re, subprocess, urllib.parse
from pathlib import Path
from datetime import datetime, timezone
from html.parser import HTMLParser

BASE='https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_ZoningPetitions/FeatureServer/0'
SOURCES={
 'county-july-2026':{'name':'County Planning Commission public-hearing agenda, July 13, 2026','url':'https://stlouisco.civicweb.net/document/452585/','kind':'official-hearing-agenda'},
 'county-september-2026':{'name':'County Planning Commission public-hearing agenda, September 21, 2026','url':'https://stlouisco.civicweb.net/document/462016/','kind':'official-hearing-agenda'},
 'city-ourplan-2026':{'name':'City announcement of OurPlan adoption, September 10, 2026','url':'https://www.stlouis-mo.gov/government/departments/mayor/news/city-adopts-ourplan.cfm','kind':'official-planning-announcement'},
 'city-zoup-2026':{'name':'City zoning-upgrade workshops announcement, September 10, 2026','url':'https://www.stlouis-mo.gov/government/departments/mayor/news/zoup-open-house-events.cfm','kind':'official-planning-announcement'},
 'city-bill49-2026':{'name':'City Board Bill 49, 2026–2027 legislative record','url':'https://www.stlouis-mo.gov/government/city-laws/board-bills/boardbill.cfm?BBId=16888&bbDetail=true','kind':'official-legislative-history'},
 'city-september-agenda-2026':{'name':'City Planning Commission agenda, September 9, 2026','url':'https://www.stlouis-mo.gov/government/departments/planning/planning/planning-commission/upload/September-PC-Agenda-docx.pdf','kind':'official-hearing-agenda','format':'pdf'}
}
class Text(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.parts=[]
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'):self.skip+=1
 def handle_endtag(self,tag):
  if tag in ('script','style'):self.skip=max(0,self.skip-1)
 def handle_data(self,data):
  if not self.skip:self.parts.append(data)
def normalize(t):return re.sub(r'\s+',' ',t).strip()
def encode(d):return json.dumps(d,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def digest(b):return hashlib.sha256(b).hexdigest()
def now():return datetime.now(timezone.utc).isoformat()
def acquire(cache,key,url,resume,extension='json'):
 parsed=urllib.parse.urlparse(url)
 if parsed.scheme!='https' or parsed.hostname not in ('stlouisco.civicweb.net','www.stlouis-mo.gov','maps.stlouisco.com'):raise ValueError('Source is outside official allowlist.')
 path=cache/(key+'.'+extension);receipt=cache/(key+'-receipt.json')
 if resume and path.exists() and receipt.exists():
  raw=path.read_bytes();r=json.loads(receipt.read_text())
  if r['url']!=url or r['sha256']!=digest(raw):raise ValueError('Cached source digest or URL differs.')
 else:
  result=subprocess.run(['curl','--max-time','30','--max-filesize','3000000','--compressed','-sS','--fail',url],capture_output=True,check=True,timeout=35)
  raw=result.stdout;r={'url':url,'retrievedAt':now(),'sha256':digest(raw),'bytes':len(raw)}
  path.write_bytes(raw);receipt.write_bytes(encode(r))
 return raw,r,path

def curated_records():
 records=[]
 def add(id,title,category,jurisdiction,status,status_label,status_date,source,summary,label,addresses=(),neighborhoods=(),case_ids=(),hearing=None,announced=None,evidence=(),events=()):
  records.append({'id':id,'jurisdiction':jurisdiction,'title':title,'category':category,'status':status,'statusLabel':status_label,'statusAsOfDate':status_date,'announcedDate':announced,'hearingDate':hearing,'caseIds':list(case_ids),'summary':summary,'geography':{'kind':'source-described-area','label':label,'addresses':list(addresses),'neighborhoods':list(neighborhoods),'geometry':None,'parcelIds':[]},'sources':[source],'officialUrl':SOURCES[source]['url'],'events':list(events),'evidence':{'sourceId':source,'requiredText':list(evidence)}})
 county='st-louis-county';city='st-louis-city'
 add('county-pc-16-26','Child-care proposal · 6190 Telegraph Road','zoning-petition',county,'hearing-listed','Hearing listed; decision not checked','2026-07-13','county-july-2026','Conditional-use request on a 1.70-acre tract. This agenda does not establish approval.','Telegraph Road north of Christopher Drive',['6190 Telegraph Road'],case_ids=['P.C. 16-26'],hearing='2026-07-13',evidence=['P.C. 16-26','6190 Telegraph Road','1.70 acres','Child care center'])
 add('county-pc-17-26','Vehicle-wash proposal · Page and Ashby','zoning-petition',county,'hearing-postponed','Hearing postponed; later outcome not checked','2026-07-13','county-july-2026','Conditional-use request for a vehicle wash and vacuum stalls on 1.61 acres. The July agenda rescheduled consideration to August 3.','Southwest of Page/Ashby and northwest of Liberty/Ashby',['10500 Page Avenue','1605 Ashby Road'],case_ids=['P.C. 17-26'],hearing='2026-08-03',evidence=['P.C. 17-26','POSTPONED TO AUGUST 3, 2026','10500 Page Avenue','1605 Ashby Road'])
 add('county-pc-19-26','Quarry-restoration proposal · Mount Olive and Paule','zoning-petition',county,'hearing-listed','Hearing listed; decision not checked','2026-07-13','county-july-2026','Conditional-use request for extraction, processing and quarry restoration on a 29.98-acre tract.','Area southwest of Paule Avenue, northeast of Mount Olive Road and southeast of Avenue H',['3991 Mount Olive Road','3900 Paule Avenue','3910 Paule Avenue'],case_ids=['P.C. 19-26'],hearing='2026-07-13',evidence=['P.C. 19-26','29.98 acres','3991 Mount Olive Road','quarry restoration'])
 add('county-pc-20-21-26','Residential proposal · 1175 Wiethaupt Road','zoning-petition',county,'hearing-listed','Hearing listed; decision not checked','2026-07-13','county-july-2026','Rezoning and planned-environment-unit requests for single-family residences, retaining two existing telecommunication towers, on 18.13 acres.','Northeast side of Wiethaupt Road northwest of Dividend Park Drive',['1175 Wiethaupt Road'],case_ids=['P.C. 20-26','P.C. 21-26'],hearing='2026-07-13',evidence=['P.C. 20 & 21-26','1175 Wiethaupt Road','18.13 acres'])
 add('county-pc-24-26','Filling-station proposal · St. Charles Rock and Hanley','zoning-petition',county,'hearing-scheduled','Public hearing scheduled','2026-09-12','county-september-2026','Commercial rezoning request for a filling station, convenience store and permitted shopping-district uses on 0.83 acre.','Northeast corner of St. Charles Rock Road and North Hanley Road',['7901 St. Charles Rock Road','7907 St. Charles Rock Road','2604 Cooke Place','2606 Cooke Place'],case_ids=['P.C. 24-26'],hearing='2026-09-21',evidence=['P.C. 24-26','September 21, 2026','7901 St. Charles Rock Road','0.83 acre'])
 add('county-pc-25-26','Commercial rezoning · Concord Village Avenue','zoning-petition',county,'hearing-scheduled','Public hearing scheduled','2026-09-12','county-september-2026','Request to change C-8 zoning to C-3 on 0.75 acre. No specific proposed use is supplied in this agenda entry.','North of Lindbergh Boulevard near Concord Village Avenue',['11445 Concord Village Avenue'],case_ids=['P.C. 25-26'],hearing='2026-09-21',evidence=['P.C. 25-26','C-8 to C-3','0.75 acre','11445 Concord Village Avenue'])
 add('county-pc-26-27-26','Multifamily proposal · Concord Village Avenue','zoning-petition',county,'hearing-scheduled','Public hearing scheduled','2026-09-12','county-september-2026','Residential rezoning and planned-environment-unit requests for multifamily dwellings on 4.71 acres.','North of Lindbergh Boulevard and Concord Village Avenue',['11445 Concord Village Avenue'],case_ids=['P.C. 26-26','P.C. 27-26'],hearing='2026-09-21',evidence=['P.C. 26 & 27-26','4.71 acres','Multiple family dwellings'])
 add('county-pc-28-26','Industrial rezoning request · Dammert Avenue','zoning-petition',county,'hearing-scheduled','Public hearing scheduled','2026-09-12','county-september-2026','Request to change C-2 and R-5 zoning to M-1 on 0.30 acre.','Northwest of Dammert Avenue northeast of Fannie Avenue',['227 Dammert Avenue','229 Dammert Avenue'],case_ids=['P.C. 28-26'],hearing='2026-09-21',evidence=['P.C. 28-26','C-2 and R-5 to M-1','227 and 229 Dammert Avenue'])
 add('city-ourplan-adoption-2026','OurPlan · six north-city neighborhoods','neighborhood-plan',city,'adoption-reported','Planning Commission adoption reported','2026-09-10','city-ourplan-2026','The City reports adoption of a neighborhood plan covering housing stability, economic development, mobility, public space and climate resilience. Adoption does not itself issue construction permits.','Six neighborhoods surrounding the NGA west site',neighborhoods=['St. Louis Place','Hyde Park','Old North St. Louis','Columbus Square','Carr Square','Jeff-Vander-Lou'],case_ids=['PDA-007-25-NBD'],announced='2026-09-10',evidence=['September 10, 2026','formally adopted by the Planning Commission','Jeff-Vander-Lou'])
 add('city-zoup-workshops-2026','ZOUP · proposed citywide zoning update','zoning-regulation',city,'consultation-announced','Public workshops announced','2026-09-10','city-zoup-2026','Residents can review draft zoning maps, proposed districts and administration standards at two September open houses. This is a proposal-engagement stage.','City of St. Louis — citywide zoning code and map',announced='2026-09-10',evidence=['September 10, 2026','September 29, 2026','September 30, 2026','draft zoning maps'],events=[{'type':'open-house','date':'2026-09-29'},{'type':'open-house','date':'2026-09-30'},{'type':'parking-survey-deadline','date':'2026-10-05'}])
 add('city-data-center-bb49-2026','Data-center zoning · Board Bill 49','zoning-regulation',city,'delivered-to-mayor','Passed by Board; delivered to Mayor','2026-09-11','city-bill49-2026','The legislative history records third-reading passage and delivery to the Mayor on September 11. This snapshot does not establish signature or an effective ordinance date.','City of St. Louis — citywide zoning legislation',case_ids=['BB 49 (2026–2027)','PDA-003-26-ZTX'],announced='2026-06-18',evidence=['Data Center Zoning Regulations','09/11/2026','Third Reading','Delivered to Mayor'])
 add('city-tamm-pud-2026','Planned-unit-development review · Tamm Avenue','zoning-petition',city,'hearing-listed','Sketch-plan hearing listed; decision not checked','2026-09-09','city-september-agenda-2026','The Planning Commission agenda lists a planned-unit-development sketch-plan review with a public hearing.','1320 and 1324 Tamm Avenue, City Block 4019',['1320 Tamm Avenue','1324 Tamm Avenue'],case_ids=['PDA-010-26-ZTX'],hearing='2026-09-09',announced='2026-09-08',evidence=['PDA-010-26-ZTX','1320 & 1324 Tamm Ave','CB 4019'])
 add('city-fairground-plan-2026','Fairground Park master-plan update','park-plan',city,'agenda-listed','Advertising-permission request listed','2026-09-09','city-september-agenda-2026','The agenda seeks permission to advertise a future adoption hearing for the 2026 master-plan update. It does not show adoption.','Fairground Park',case_ids=['PDA-015-26-CMP'],announced='2026-09-08',evidence=['PDA-015-26-CMP','Permission to Advertise','Fairground Park Master Plan 2026 Update'])
 add('city-aurora-bulwar-vacation-2026','Street-vacation proposal · Aurora and Bulwar','street-vacation',city,'agenda-listed','Delegated agenda item; decision not checked','2026-09-09','city-september-agenda-2026','Proposed vacation of street portions adjoining City Blocks 4203, 4204, 4218 and 4219. The source describes an area, not an approved boundary.','Portions of Aurora and Bulwar Avenue; City Block 4203 southwest and Blocks 4204, 4218 and 4219 north/east',neighborhoods=['North Riverfront'],case_ids=['PDA-015-26-VACA'],announced='2026-09-08',evidence=['PDA-015-26-VACA','Aurora and Bulwar Avenue','4203','4218'])
 return records

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cache',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--resume',action='store_true');args=p.parse_args()
 if args.output.exists():raise ValueError('Use a new output directory to preserve prior snapshots.')
 args.cache.mkdir(parents=True,exist_ok=True);sources={};texts={};receipts=[]
 for key,seed in SOURCES.items():
  raw,r,path=acquire(args.cache,key,seed['url'],args.resume,'pdf' if seed.get('format')=='pdf' else 'html');receipts.append(r)
  if seed.get('format')=='pdf':plain=subprocess.run(['pdftotext','-layout',str(path),'-'],capture_output=True,check=True,timeout=15).stdout.decode()
  else:
   parser=Text();parser.feed(raw.decode('utf-8-sig'));plain=' '.join(parser.parts)
  texts[key]=normalize(plain);(args.cache/(key+'.txt')).write_text(texts[key]);sources[key]={'id':key,**seed,**r}
 records=curated_records()
 for record in records:
  for snippet in record['evidence']['requiredText']:
   if normalize(snippet).lower() not in texts[record['evidence']['sourceId']].lower():raise ValueError(f"Source wording changed or evidence missing for {record['id']}: {snippet}")
  for key in ('statusAsOfDate','announcedDate','hearingDate'):
   if record[key]:datetime.strptime(record[key],'%Y-%m-%d')
 # Read-only ArcGIS queries only. No feature editing, even when advertised by the public service.
 def query(name,params):
  raw,r,_=acquire(args.cache,name,BASE+'/query?'+urllib.parse.urlencode({'f':'json',**params}),args.resume);receipts.append(r);data=json.loads(raw)
  if data.get('error'):raise ValueError(data['error'].get('message'))
  return data,r
 ids,_=query('petition-start-ids',{'where':'1=1','returnIdsOnly':'true'});expected=sorted(ids['objectIds'])
 if len(set(expected))!=len(expected) or len(expected)>10000:raise ValueError('Unexpected bounded petition count.')
 count,_=query('petition-start-count',{'where':'1=1','returnCountOnly':'true'});assert count['count']==len(expected)
 features=[];missing_geometry=0;invalid_geometry=0;bad_case_fields=0;missing_dates=0;dates=[]
 for i in range(0,len(expected),2000):
  batch=expected[i:i+2000]
  data,r=query(f'petition-page-{i//2000:03d}',{'where':f'OBJECTID>={batch[0]} AND OBJECTID<={batch[-1]}','outFields':'OBJECTID,PROCEDURE_,PETITION,last_edited_date','returnGeometry':'true','outSR':4326,'resultRecordCount':2000,'orderByFields':'OBJECTID'})
  if data.get('exceededTransferLimit') or sorted(f['attributes']['OBJECTID'] for f in data['features'])!=batch:raise ValueError('Incomplete petition source page.')
  if data.get('spatialReference',{}).get('wkid')!=4326:raise ValueError('Unexpected coordinate reference system.')
  for f in data['features']:
   a=f['attributes'];oid=a['OBJECTID'];geometry=f.get('geometry');point=None;geometry_status='source-point'
   if geometry is not None:
    x,y=geometry['x'],geometry['y']
    if not (isinstance(x,(int,float)) and isinstance(y,(int,float)) and math.isfinite(x) and math.isfinite(y) and -91<x<-89 and 38<y<40):
     invalid_geometry+=1;geometry_status='invalid-source-coordinate'
    else:point={'type':'Point','coordinates':[x,y]}
   else:missing_geometry+=1;geometry_status='missing-source-geometry'
   if a['PETITION'] is None:bad_case_fields+=1
   timestamp=a['last_edited_date'];edited=datetime.fromtimestamp(timestamp/1000,timezone.utc).isoformat() if timestamp is not None else None
   if edited:dates.append(edited)
   else:missing_dates+=1
   properties={'id':f'county-zoning-petition:{oid}','sourceId':'st-louis-county-zoning-petitions','sourceObjectId':oid,'jurisdiction':'st-louis-county','petitionRaw':a['PETITION'],'procedureRaw':a['PROCEDURE_'],'sourceEditedAt':edited,'officialUrl':BASE+'/query?'+urllib.parse.urlencode({'f':'html','where':f'OBJECTID={oid}','outFields':'OBJECTID,PROCEDURE_,PETITION,last_edited_date','returnGeometry':'true','outSR':4326}),'status':'decision-unknown','geometryStatus':geometry_status}
   features.append({'type':'Feature','id':properties['id'],'geometry':point,'properties':properties})
 end,end_receipt=query('petition-end-ids',{'where':'1=1','returnIdsOnly':'true'});assert sorted(end['objectIds'])==expected
 gis_source={'id':'st-louis-county-zoning-petitions','name':'St. Louis County historical zoning-petition point index','url':BASE,'retrievedAt':end_receipt['retrievedAt'],'queryFields':['OBJECTID','PROCEDURE_','PETITION','last_edited_date'],'sourceIdentitySha256':digest(encode(expected)),'dateMeaning':'Source edit time is not a filing, hearing, decision or permit date. Raw petition labels are not converted into dated events.','geometryMeaning':'Point coordinates supplied by the official GIS in EPSG:4326. These are index markers, not project or parcel boundaries.'}
 gis={'type':'FeatureCollection','source':gis_source,'coverage':{'recordCount':len(features),'mappedPointCount':len(features)-missing_geometry-invalid_geometry,'missingGeometryCount':missing_geometry,'invalidGeometryCount':invalid_geometry,'missingPetitionFieldCount':bad_case_fields,'missingEditDateCount':missing_dates,'latestSourceEditDate':max(dates) if dates else None},'limitations':['Historical index, not a complete current planning or building-permit feed.','A mapped petition does not establish approval, construction, ownership, or project activity.','Raw procedure and petition fields are preserved, including missing or misplaced values.','Contemporary notices have not been joined by approximate address, inferred case number or proximity.'],'features':features}
 args.output.mkdir(parents=True);raw=encode(gis);(args.output/'county-zoning-petitions.geojson').write_bytes(raw)
 result={'schema':'property-planning-v1','retrievedAt':max(s['retrievedAt'] for s in sources.values()),'sources':sources,'coverage':{'kind':'curated-official-records','recordCount':len(records),'jurisdictions':{'st-louis-county':sum(r['jurisdiction']=='st-louis-county' for r in records),'st-louis-city':sum(r['jurisdiction']=='st-louis-city' for r in records)},'unmappedRecordCount':len(records),'completeProjectInventory':False,'completePermitInventory':False},'records':records,'mapIndex':{'url':'/st-louis/planning/county-zoning-petitions.geojson','sourceId':gis_source['id'],'recordCount':len(features),'bytes':len(raw),'sha256':digest(raw)},'limitations':['A bounded reviewed collection of official notices; omitted projects or permits must not be interpreted as absent.','Statuses describe only the cited evidence date. An agenda listing does not establish a meeting outcome, project approval or construction.','Named areas and addresses are source descriptions. No point coordinates, parcel joins or project boundaries were invented.','Public meeting venues and staff contact details are excluded from project geography.','Historical petition-map records are a separate source and are not presumed to match these notices.']}
 (args.output/'index.json').write_bytes(encode(result));(args.cache/'acquisition-receipts.json').write_bytes(encode({'retrievedAt':now(),'receipts':receipts}))
 print(json.dumps({'registryRecords':len(records),'historicalPoints':len(features)-missing_geometry-invalid_geometry,'missingEditDates':missing_dates,'output':str(args.output),'gisBytes':len(raw)}))
if __name__=='__main__':main()
