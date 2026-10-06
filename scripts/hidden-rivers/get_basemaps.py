import urllib.request,urllib.parse,concurrent.futures,json
regions=[('agulhas',[10,-43,35,-30]),('bahamas',[-82,22,-72,31]),('denmark',[-44,59,-18,69])]
def f(r):
 k,b=r;p={'bbox':','.join(map(str,b)),'bboxSR':4326,'imageSR':4326,'size':'1400,'+str(round(1400*(b[3]-b[1])/(b[2]-b[0]))),'format':'jpg','f':'image'}
 u='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?'+urllib.parse.urlencode(p)
 try:
  d=urllib.request.urlopen(u,timeout=50).read();open('ocean_atlas/'+k+'_basemap.jpg','wb').write(d);print(k,len(d),flush=True)
 except Exception as e:print(e,flush=True)
with concurrent.futures.ThreadPoolExecutor() as ex:list(ex.map(f,regions))
