import urllib.request,urllib.parse,concurrent.futures,json
r=json.load(open('ocean_atlas/requests.json'))['regions']
def f(r):
 w,s,e,n=r['bbox'];q=f'altitude[({s}):12:({n})][({w}):12:({e})]';u='https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.nc?'+urllib.parse.quote(q,safe='')
 try:
  b=urllib.request.urlopen(u,timeout=60).read();open('ocean_atlas/'+r['id']+'_bathy.nc','wb').write(b);print(r['id'],len(b),flush=True)
 except Exception as e:print(r['id'],e,flush=True)
with concurrent.futures.ThreadPoolExecutor() as ex:list(ex.map(f,r))
