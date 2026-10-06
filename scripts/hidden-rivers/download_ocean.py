import urllib.request,urllib.parse,concurrent.futures,json,os
regions=[{'id':'agulhas','name':'Agulhas retroflection','bbox':[10,-43,35,-30],'depth':200},{'id':'bahamas','name':'Florida Current & Bahamas','bbox':[-82,22,-72,31],'depth':200},{'id':'denmark','name':'Denmark Strait','bbox':[-44,59,-18,69],'depth':1000}]
requests=[]
for r in regions:
 for v in ['u','v']:
  b=r['bbox'];p={'var':'water_'+v,'north':b[3],'south':b[1],'west':b[0]%360,'east':b[2]%360,'horizStride':2,'time_start':'2026-09-29T00:00:00Z','time_end':'2026-10-04T00:00:00Z','timeStride':8,'vertCoord':r['depth'],'accept':'netcdf4','addLatLon':'true'}
  url='https://ncss.hycom.org/thredds/ncss/grid/ESPC-D-V02/'+v+'3z/2026?'+urllib.parse.urlencode(p)
  requests.append({'file':r['id']+'_'+v+'.nc','url':url})
def dl(s):
 try:
  with urllib.request.urlopen(s['url'],timeout=100) as a:body=a.read()
  open('ocean_atlas/'+s['file'],'wb').write(body);print(s['file'],len(body),body[:6],flush=True)
 except Exception as e:print(s['file'],repr(e),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as e:list(e.map(dl,requests))
json.dump({'regions':regions,'requests':requests},open('ocean_atlas/requests.json','w'),indent=2)
