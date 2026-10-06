import urllib.request,urllib.parse,concurrent.futures,json
jobs=[]
for depth in [0,1000]:
 for v in ['u','v']:
  p={'var':'water_'+v,'north':-30,'south':-43,'west':10,'east':35,'horizStride':2,'time_start':'2026-09-29T00:00:00Z','time_end':'2026-10-04T00:00:00Z','timeStride':8,'vertCoord':depth,'accept':'netcdf4'}
  jobs.append({'file':f'agulhas_{depth}_{v}.nc','url':'https://ncss.hycom.org/thredds/ncss/grid/ESPC-D-V02/'+v+'3z/2026?'+urllib.parse.urlencode(p)})
def dl(j):
 try:
  b=urllib.request.urlopen(j['url'],timeout=110).read();open('ocean_atlas/'+j['file'],'wb').write(b);print(j['file'],len(b),flush=True)
 except Exception as e:print(j['file'],e,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:list(ex.map(dl,jobs))
json.dump(jobs,open('ocean_atlas/depth_requests.json','w'),indent=2)
