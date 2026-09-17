#!/usr/bin/env python3
"""Bounded official planning-document collector; no parcel or location inference.
Run: uv run --no-project python scripts/st-louis/fetch_property_planning_documents.py
--cached rebuilds the last successful acquisition without changing its observation date.
Refresh failures retain the published index/history and produce a failed status receipt.
"""
import argparse,concurrent.futures,datetime,hashlib,json,os,re,urllib.parse,urllib.request
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/st-louis/planning-documents';CACHE=ROOT.parent/'research/planning-documents-2026/collector'
SOURCES={
 'city-planning-commission':{'label':'City Planning Commission','url':'https://www.stlouis-mo.gov/government/departments/planning/planning/planning-commission/Planning-Commission-Agendas.cfm','prefix':'/government/departments/planning/planning/planning-commission/','jurisdiction':'st-louis-city'},
 'city-preservation-board':{'label':'City Preservation Board','url':'https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/preservation-board/Documents/index.cfm','prefix':'/government/departments/planning/cultural-resources/preservation-board/documents/','jurisdiction':'st-louis-city'},
 'city-tif-commission':{'label':'City TIF Commission','url':'https://www.stlouis-mo.gov/government/departments/sldc/boards/documents/tax-increment-financing-commission-documents.cfm','prefix':'/government/departments/sldc/boards/documents/','jurisdiction':'st-louis-city'},
 'city-capital-budget':{'label':'City capital improvements and budget','url':'https://www.stlouis-mo.gov/government/departments/budget/transparency/Capital-Improvement-Plan.cfm','prefix':'/government/departments/budget/','jurisdiction':'st-louis-city'},
 'county-planning-commission':{'label':'County Planning Commission published meetings','url':'https://stlouisco.civicweb.net/portal/','jurisdiction':'st-louis-county'}}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def encode(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
def clean(s):return re.sub(r'\s+',' ',s or '').strip()
def write(p,v):
 p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.tmp');tmp.write_bytes(encode(v));os.replace(tmp,p)
def safe_url(url):
 u=urllib.parse.urlsplit(url)
 return u.scheme=='https' and u.hostname in {'www.stlouis-mo.gov','static.stlouis-mo.gov','stlouisco.civicweb.net'} and not u.username and not u.password
class Page(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.parts=[];self.a=None;self.skip=0;self.heading=False;self.h1=''
 def handle_starttag(self,t,attrs):
  if t in ('script','style'):self.skip+=1
  if t=='h1':self.heading=True
  if t=='a':self.a={'url':dict(attrs).get('href',''),'title':''}
 def handle_endtag(self,t):
  if t in ('script','style'):self.skip=max(0,self.skip-1)
  if t=='h1':self.heading=False
  if t=='a'and self.a:self.links.append(self.a);self.a=None
 def handle_data(self,s):
  if self.skip:return
  self.parts.append(s)
  if self.a:self.a['title']+=s
  if self.heading:self.h1+=s
 @property
 def text(self):return clean(' '.join(self.parts))
def page(raw):p=Page();p.feed(raw.decode('utf-8',errors='replace'));return p
def date_title(title,reference_year=None):
 """Visible titles only. Two-digit years require the landing-page publication year."""
 for pattern,fmt in [(r'\b([A-Za-z]+ \d{1,2},? \d{4})\b','month'),(r'\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b','numeric')]:
  m=re.search(pattern,title)
  if m:
   for f in (['%B %d %Y','%b %d %Y'] if fmt=='month'else['%m-%d-%Y','%m/%d/%Y','%m.%d.%Y']):
    try:return datetime.datetime.strptime(m[1].replace(',',''),f).date().isoformat()
    except ValueError:pass
 m=re.search(r'\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})\b',title)
 if m and reference_year and int(m[3])==reference_year%100:
  try:return datetime.date(reference_year,int(m[1]),int(m[2])).isoformat()
  except ValueError:pass
 return None
def publication(text):
 m=re.search(r'Publication Date:\s*(\d{1,2}/\d{1,2}/\d{4})',text)
 if not m:return None
 try:return datetime.datetime.strptime(m[1],'%m/%d/%Y').date().isoformat()
 except ValueError:return None
def status_for(title,context=''):
 s=title.lower()
 if 'preliminary' in s and 'agenda' in s:return 'preliminary-agenda'
 if 'draft' in s:return 'draft-document'
 if 'minutes'in s:return 'meeting-minutes'
 if 'agenda'in s:return 'agenda'
 if re.search(r'\bas adopted\b',context,re.I) or re.search(r'\badopted\b',s):return 'adopted-plan-document'
 if 'meeting'in s or 'hearing'in s:return 'meeting-materials'
 return 'published-document'
def get(url,max_bytes=3000000):
 if not safe_url(url):raise ValueError('Non-official or unsafe source URL')
 with urllib.request.urlopen(url,timeout=25)as r:
  if not safe_url(r.url):raise ValueError('Source redirected outside official hosts')
  if int(r.headers.get('Content-Length','0'))>max_bytes:raise ValueError('Document exceeds acquisition byte bound')
  raw=r.read(max_bytes+1);headers={'lastModified':r.headers.get('Last-Modified'),'etag':r.headers.get('ETag'),'contentType':r.headers.get('Content-Type')}
 if len(raw)>max_bytes:raise ValueError('Document exceeds acquisition byte bound')
 return raw,headers
def archive(url,raw,headers,kind):
 digest=sha(raw);path=CACHE/'versions'/digest
 path.parent.mkdir(parents=True,exist_ok=True)
 if not path.exists():path.write_bytes(raw)
 receipt={'url':url,'retrievedAt':now(),'sha256':digest,'bytes':len(raw),'kind':kind,'headers':headers}
 write(CACHE/'receipts'/(sha(url.encode())+'.json'),receipt);return receipt
def city_candidates(source,p):
 candidates={}
 for a in p.links:
  url=urllib.parse.urljoin(source['url'],a['url']);title=clean(a['title']);path=urllib.parse.urlsplit(url).path.lower()
  if url==source['url']or not safe_url(url)or not path.startswith(source['prefix'])or not path.endswith('.cfm')or not title:continue
  # Bound recurring discovery to visible 2025+ titles, plus explicit recent two-digit titles.
  if not(re.search(r'\b202[5-9]\b|FY\s*202[5-9]',title,re.I)or re.search(r'\b\d{1,2}[-/.]\d{1,2}[-/.]2[5-9]\b',title)):continue
  short=re.search(r'[-/.](2[5-9])\b',title);sort_date=date_title(title)or(date_title(title,2000+int(short[1]))if short else None)
  candidates[url]={'url':url,'title':title,'sort':sort_date or title}
 return sorted(candidates.values(),key=lambda x:x['sort'],reverse=True)[:12]
def record(source_id,url,title,landing,observed,published=None,meeting=None,hearing=None,status='published-document',source_receipt=None):
 return {'id':source_id+':'+sha(url.encode())[:24],'sourceId':source_id,'layerId':'planning-documents','jurisdiction':SOURCES[source_id]['jurisdiction'],'title':clean(title),'sourceURL':url,'sourceUrl':url,'landingPageURL':landing,'sourceObservedAt':observed,'publishedDate':published,'meetingDate':meeting,'hearingDate':hearing,'documentDate':hearing or meeting or published,'datePrecision':'day'if(hearing or meeting or published)else'unknown','status':status,'statusBasis':'Document kind or literal adopted-plan description; an agenda is not approval and a budget plan is not an expenditure.','recordKey':None,'parcelKey':None,'parcelId':None,'longitude':None,'latitude':None,'geometry':None,'geometryRole':'unmapped-document','address':None,'geographicScope':SOURCES[source_id]['jurisdiction'],'geographyBasis':'Publishing jurisdiction only; project boundaries and parcel associations not established.','sourcePageSha256':source_receipt['sha256']if source_receipt else None,'amountUSD':None}
def acquire_city_detail(task):
 sid,a=task;raw,headers=get(a['url']);receipt=archive(a['url'],raw,headers,'official-document-landing-page');p=page(raw);title=clean(p.h1)or a['title'];published=publication(p.text)
 meeting=date_title(title,int(published[:4])if published else None)if re.search(r'meeting|agenda|minutes|hearing',title,re.I)else None
 hearing=meeting if 'public hearing'in title.lower()else None
 context=p.text[p.text.find(title):p.text.find('Publication Date:')]if title in p.text else''
 records=[record(sid,a['url'],title,a['url'],receipt['retrievedAt'],published,meeting,hearing,status_for(title,context),receipt)]
 for link in p.links:
  url=urllib.parse.urljoin(a['url'],link['url']);label=clean(link['title'])
  if not safe_url(url)or not re.search(r'\.(pdf|docx?|xlsx?)(?:\?|$)',url,re.I)or not label:continue
  child_meeting=date_title(label,int(published[:4])if published else None)if re.search(r'meeting|agenda|minutes|hearing',label,re.I)else None
  child=record(sid,url,label,a['url'],receipt['retrievedAt'],None,child_meeting or meeting,hearing,status_for(label,context),receipt)
  child['landingPagePublishedDate']=published;child['publicationDateBasis']='Landing-page publication date; attachment publication time is not supplied.'
  records.append(child)
 return records
def acquire():
 sources={};tasks=[];records=[];receipts=[]
 for sid,s in SOURCES.items():
  if sid=='county-planning-commission':continue
  raw,headers=get(s['url']);receipt=archive(s['url'],raw,headers,'official-directory');receipts.append(receipt);candidates=city_candidates(s,page(raw))
  if not candidates:raise ValueError(sid+': no verified recent document links; retain prior index')
  sources[sid]={'id':sid,'label':s['label'],'url':s['url'],'retrievedAt':receipt['retrievedAt'],'sha256':receipt['sha256'],'selectedLandingPages':len(candidates),'selection':'Up to12 latest visible titles dated2025 onward; bounded directory coverage.'};tasks.extend((sid,a)for a in candidates)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:
  for result in pool.map(acquire_city_detail,tasks):records.extend(result)
 sid='county-planning-commission';s=SOURCES[sid];year=datetime.date.today().year;url=f'https://stlouisco.civicweb.net/Services/MeetingsService.svc/meetings?from={year}-01-01&to={year}-12-31'
 raw,headers=get(url);receipt=archive(url,raw,headers,'public-published-meeting-calendar');receipts.append(receipt);meetings=json.loads(raw)
 selected=sorted([m for m in meetings if m.get('Published')is True and m.get('TypeId')==29 and str(m.get('Name','')).startswith('Planning Commission')],key=lambda m:m['MeetingDate'],reverse=True)[:12]
 if not selected:raise ValueError('No verified published County planning meetings; retain prior index')
 sources[sid]={'id':sid,'label':s['label'],'url':s['url'],'calendarURL':url,'retrievedAt':receipt['retrievedAt'],'sha256':receipt['sha256'],'selectedLandingPages':len(selected),'selection':f'Latest12 published Planning Commission calendar records, sourceTypeId29, calendar year{year}.','endpointBasis':'Public portal calendar JavaScript uses MeetingsService.svc/meetings and MeetingInformation.aspx?Org=Cal&Id.'}
 for m in selected:
  landing=f"https://stlouisco.civicweb.net/Portal/MeetingInformation.aspx?Org=Cal&Id={m['Id']}";raw,headers=get(landing);r=archive(landing,raw,headers,'public-meeting-page');p=page(raw);day=datetime.date.fromisoformat(m['MeetingDate']).isoformat();hearing=day if'Public Hearing'in m['Name']else None
  records.append(record(sid,landing,m['Name'],landing,r['retrievedAt'],meeting=day,hearing=hearing,status='published-meeting',source_receipt=r))
  for a in p.links:
   link=urllib.parse.urljoin(landing,a['url'])
   if not safe_url(link)or not re.search(r'/document/\d+/.+\.pdf',link,re.I):continue
   # This public print link may have no anchor text. Its parent meeting identifies it,
   # without guessing that the packet proves any proposal was approved.
   records.append(record(sid,link,clean(a['title'])or m['Name']+' · published meeting packet',landing,r['retrievedAt'],meeting=day,hearing=hearing,status='meeting-packet',source_receipt=r))
 unique={r['id']:r for r in records};records=list(unique.values());previous={}
 prior=CACHE/'acquisition.json'
 if prior.exists():previous={r['id']:r for r in json.loads(prior.read_text())['records']}
 for r in records:r['inLatestBoundedWindow']=True;r['lastSeenInDirectoryAt']=r['sourceObservedAt']
 # Sliding discovery windows must not imply official withdrawal of older documents.
 for key,old in previous.items():
  if key not in unique:records.append(old|{'inLatestBoundedWindow':False})
 captures=0;captured_bytes=0
 # Rotate bounded body checks across records; link metadata is versioned every run.
 ordered=sorted(records,key=lambda r:previous.get(r['id'],{}).get('contentCheckedAt',''))
 for r in ordered:
  old=previous.get(r['id'],{});r['firstObservedAt']=old.get('firstObservedAt',r['sourceObservedAt']);r['contentCaptureStatus']='landing-page-archived'if r['sourceURL']==r['landingPageURL']else'linked-not-captured'
  for k in ('contentSha256','contentBytes','contentCheckedAt','contentCaptureStatus'):
   if k in old:r[k]=old[k]
  r['metadataSha256']=sha(encode({k:r[k]for k in ['sourceURL','title','publishedDate','meetingDate','hearingDate','status']}));r['versionHashBasis']='indexed-link-metadata';r['versionHash']=r['metadataSha256']
  if r['sourceURL']==r['landingPageURL']:continue
  if captures>=8 or captured_bytes>=32000000:continue
  captures+=1;r['contentCheckedAt']=now()
  try:
   raw,headers=get(r['sourceURL'],min(8000000,32000000-captured_bytes));receipt=archive(r['sourceURL'],raw,headers,'official-linked-document');r.update(contentSha256=receipt['sha256'],contentBytes=receipt['bytes'],contentCaptureStatus='body-archived');captured_bytes+=len(raw)
  except Exception as e:r['contentCaptureStatus']='body-not-refreshed';r['contentCaptureError']=str(e)[:180]
 return {'schema':'property-planning-documents-v1','retrievedAt':now(),'complete':True,'partial':False,'sources':sources,'records':sorted(records,key=lambda r:(r['documentDate']or'',r['id']),reverse=True),'coverage':{'recordCount':len(records),'landingPageCount':sum(r['sourceURL']==r['landingPageURL']for r in records),'linkedDocumentCount':sum(r['sourceURL']!=r['landingPageURL']for r in records),'sourceCount':len(sources),'georeferencedRecordCount':0,'completeForBoundedAcquisition':True,'comprehensivePlanningCoverage':False,'bodyChecksThisRun':captures,'bodyBytesThisRun':captured_bytes},'limitations':['Bounded recent official directories and published County Planning Commission meetings, not comprehensive project or municipal coverage.','Publication, meeting and explicit hearing dates remain distinct; no hearing venue becomes project geography.','Document title dates come from visible source text. Two-digit years require corroborating publication-year context.','Linked-document metadata is versioned on every refresh. Document bodies are checked on a rotating budget of8 bodies and32MB per run; a link hash is not a document-body hash.','A published agenda, proposal, capital plan or meeting packet does not establish project approval, implementation or public expenditure.','No person names, owner/contact fields, parcel joins or coordinates are extracted from document bodies.']}
def publish(data):
 if data.get('schema')!='property-planning-documents-v1'or data.get('complete')is not True or not data.get('records'):raise ValueError('Invalid cached complete planning acquisition')
 raw=encode(data)
 if len(raw)>16000000:raise ValueError('Planning index exceeds16MB client bound')
 version=CACHE/'index-versions'/(sha(raw)+'.json')
 if not version.exists():write(version,data)
 history={'schema':'property-observation-input-v1','complete':True,'source':{'id':'official-planning-document-observations','label':'Official City and County planning document links','url':'https://www.stlouis-mo.gov/government/departments/planning/','retrievedAt':data['retrievedAt']},'recordCount':len(data['records']),'records':[{k:r.get(k)for k in ['id','title','sourceURL','jurisdiction','recordKey','parcelKey','parcelId','longitude','latitude','address','status','documentDate','amountUSD']}|{'sourceObjectId':None,'sourceUpdatedAt':None}for r in data['records']]}
 write(OUT/'index.json',data);write(OUT/'history-input.json',history);write(OUT/'manifest.json',{'schema':'property-planning-documents-manifest-v1','retrievedAt':data['retrievedAt'],'complete':True,'recordCount':len(data['records']),'url':'/st-louis/planning-documents/index.json','sha256':sha(raw),'bytes':len(raw),'sources':list(data['sources'].values()),'coverage':data['coverage']});write(OUT/'status.json',{'schema':'property-source-status-v1','state':'ready','attemptedAt':now(),'lastSuccessfulRetrievalAt':data['retrievedAt'],'retainedPreviousData':False,'recordCount':len(data['records'])});print(json.dumps(data['coverage']))
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cached',action='store_true');args=p.parse_args()
 try:
  data=json.loads((CACHE/'acquisition.json').read_text())if args.cached else acquire()
  publish(data)
  if not args.cached:write(CACHE/'acquisition.json',data)
 except Exception as e:
  old=json.loads((OUT/'manifest.json').read_text())if(OUT/'manifest.json').exists()else{}
  write(OUT/'status.json',{'schema':'property-source-status-v1','state':'failed','attemptedAt':now(),'lastSuccessfulRetrievalAt':old.get('retrievedAt'),'retainedPreviousData':bool(old),'error':str(e)[:400]});raise
if __name__=='__main__':main()
