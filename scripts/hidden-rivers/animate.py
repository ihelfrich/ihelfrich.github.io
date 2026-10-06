import os,json,datetime,math,numpy as np
from netCDF4 import Dataset,num2date
from scipy.ndimage import map_coordinates
from PIL import Image,ImageDraw,ImageFont,ImageChops
import imageio.v2 as imageio
from matplotlib.colors import LinearSegmentedColormap
P='ocean_atlas/';W,H=1920,1080;FPS=24;STEPS=480;DT=900
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def F(n,b=False):return ImageFont.truetype(bold if b else font,n)
configs=[dict(id='bahamas',title='THE FLORIDA CURRENT',sub='Bahamas & Florida Straits',depth=200,max=1.5,colors=['#123353','#23b5b4','#b2efb9','#ffb66f','#ff6595'],lines=['A fast boundary current threads','past banks and island shelves.','','The 200 m plane excludes the','shallow banks. Their turquoise','surface appearance does not','measure the flow at this depth.']),dict(id='agulhas',title='THE AGULHAS RETURN',sub='South of Africa',depth=200,max=1.5,colors=['#172355','#4179de','#6be8d4','#dc85e6','#ffe6b0'],lines=['A current bends back toward','the Indian Ocean, surrounded','by large rotating structures.','','The moving texture comes from','the model velocity, not from','satellite water-color contrast.']),dict(id='denmark',title='BELOW DENMARK STRAIT',sub='Greenland, Iceland & the Irminger Sea',depth=1000,max=.6,colors=['#142a4c','#365fa7','#739bea','#9ce9e4','#fff0c5'],lines=['The deep flow has its own','geography and its own pace.','','This 1,000 m horizontal slice','cannot show water descending','over the shallower sill. That','requires a vertical section.'])]
summary=[]
def load(c):
 with Dataset(P+c['id']+'_u.nc') as d:
  u=np.ma.filled(d['water_u'][:,0],np.nan);lat=np.array(d['lat'][:]);lon=np.array(d['lon'][:]);lon=np.where(lon>180,lon-360,lon);dates=[str(t) for t in num2date(d['time'][:],d['time'].units)];depth=float(d['depth'][0])
 with Dataset(P+c['id']+'_v.nc') as d:
  v=np.ma.filled(d['water_v'][:,0],np.nan);assert np.allclose(d['lat'][:],lat);assert v.shape==u.shape
 assert len(u)==6 and depth==c['depth'];assert np.all(np.diff(lat)>0) and np.all(np.diff(lon)>0)
 return u,v,lat,lon,dates
writer=imageio.get_writer(P+'Hidden_Rivers_Atlas.mp4',fps=FPS,codec='libx264',quality=8,macro_block_size=1,ffmpeg_params=['-pix_fmt','yuv420p','-movflags','+faststart'])
for chapter,c in enumerate(configs):
 u,v,lat,lon,dates=load(c);ny,nx=u.shape[1:];xmin,xmax,ymin,ymax=lon[0],lon[-1],lat[0],lat[-1]
 aspect=(xmax-xmin)*math.cos(math.radians((ymin+ymax)/2))/(ymax-ymin)
 mw=min(1390,int(740*aspect));mh=int(mw/aspect);mx=60+(1390-mw)//2;my=205+(740-mh)//2
 cmap=LinearSegmentedColormap.from_list(c['id'],c['colors']);lut=np.uint8(cmap(np.linspace(0,1,256))[:,:3]*255)
 base=Image.new('RGB',(W,H),'#060f1b');d=ImageDraw.Draw(base)
 d.text((60,35),'HIDDEN RIVERS  /  A DATA ATLAS',font=F(17,True),fill='#77cfc7');d.text((60,75),c['title'],font=F(48,True),fill='#edf2ef');d.text((63,142),c['sub'],font=F(24),fill='#a8bdcb')
 d.text((1500,75),f'{chapter+1:02d} / 03',font=F(30),fill='#6fcfc6');d.text((1500,218),f'{c["depth"]:,} m',font=F(50,True),fill='#edf2ef');d.text((1502,280),'BELOW THE SURFACE',font=F(15,True),fill='#72d5cb')
 yy=325
 for line in c['lines']:d.text((1500,yy),line,font=F(17),fill='#bacad3');yy+=27
 d.text((1500,560),'HORIZONTAL SPEED',font=F(15,True),fill='#71d5cd')
 bar=np.tile(lut[None,:,:],(18,1,1));base.paste(Image.fromarray(bar).resize((330,18)),(1500,594));d=ImageDraw.Draw(base)
 for val,x in [(0,1500),(c['max']/2,1640),(c['max'],1785)]:d.text((x,620),f'{val:g}',font=F(16),fill='#bfd0db')
 d.text((1780,651),'m/s',font=F(16),fill='#bfd0db')
 if c['id']=='agulhas':
  thumb=Image.open(P+'Tessera_Cape_Peninsula.png').resize((195,195));base.paste(thumb,(1500,703));d=ImageDraw.Draw(base);d.text((1710,710),'TESSERA',font=F(17,True),fill='#b5e2d3');d.text((1710,742),'2024',font=F(17),fill='#c5cfdb');d.text((1710,773),'10 m pixels',font=F(15),fill='#aabccb');d.text((1710,805),'Coastal',font=F(15),fill='#aabccb');d.text((1710,827),'context',font=F(15),fill='#aabccb');d.text((1500,913),'Cape Peninsula · 5.12 km patch',font=F(15),fill='#aabccb')
 else:
  for yy,line in enumerate(['DAILY MODEL SNAPSHOTS','5 ocean days in 20 seconds','Depth-constrained tracers','No measured vertical motion']):d.text((1500,738+yy*33),line,font=F(15,yy==0),fill='#8aaaba')
 # Matching basemap export bounds differ slightly from model edge coordinates; correct by resampling.
 rb={'bahamas':[-82,22,-72,31],'agulhas':[10,-43,35,-30],'denmark':[-44,59,-18,69]}[c['id']]
 im=Image.open(P+c['id']+'_basemap.jpg');iw,ih=im.size
 im=im.crop(((xmin-rb[0])/(rb[2]-rb[0])*iw,(rb[3]-ymax)/(rb[3]-rb[1])*ih,(xmax-rb[0])/(rb[2]-rb[0])*iw,(rb[3]-ymin)/(rb[3]-rb[1])*ih)).resize((mw,mh))
 bg=np.asarray(im).astype(float)*.38
 d.rectangle((mx-1,my-1,mx+mw,my+mh),outline='#365164',width=1)
 for a in np.linspace(xmin,xmax,5):d.text((mx+(a-xmin)/(xmax-xmin)*mw-22,my+mh+10),f'{abs(a):.0f}°'+('W' if a<0 else 'E'),font=F(15),fill='#99afbd')
 for a in np.linspace(ymin,ymax,4):d.text((max(5,mx-58),my+mh-(a-ymin)/(ymax-ymin)*mh-8),f'{abs(a):.0f}°'+('S' if a<0 else 'N'),font=F(14),fill='#99afbd')
 d.text((60,1000),'HYCOM / ESPC analysis · Daily samples · Spatial and temporal interpolation · Particle color = modeled speed',font=F(17),fill='#a7c1ce')
 d.text((60,1032),'Synthetic tracers constrained to a depth plane; reseeded on exit. Esri / Maxar / Earthstar basemap, mixed dates. Not a measured 3D water-parcel trajectory.',font=F(14),fill='#6f91a5')
 rng=np.random.default_rng(82);N=4200;valid=np.argwhere(np.isfinite(u).all(0)&np.isfinite(v).all(0));pick=rng.integers(len(valid),size=N)
 pos=np.c_[valid[pick,1],valid[pick,0]].astype(float)+rng.uniform(-.35,.35,(N,2));age=rng.integers(0,STEPS,N)
 trail=Image.new('RGB',(mw,mh));fade=np.uint8(np.arange(256)*.991).tolist()*3
 def flow(p,t):
  k=min(int(t),4);alpha=min(t-k,1);coords=[p[:,1],p[:,0]]
  uu=(1-alpha)*map_coordinates(u[k],coords,order=1,mode='constant',cval=np.nan)+alpha*map_coordinates(u[k+1],coords,order=1,mode='constant',cval=np.nan)
  vv=(1-alpha)*map_coordinates(v[k],coords,order=1,mode='constant',cval=np.nan)+alpha*map_coordinates(v[k+1],coords,order=1,mode='constant',cval=np.nan)
  la=ymin+p[:,1]*(lat[1]-lat[0]);dx=uu/(111195*np.cos(np.deg2rad(la)))/(lon[1]-lon[0]);dy=vv/111195/(lat[1]-lat[0]);return np.c_[dx,dy],np.hypot(uu,vv)
 for frame in range(STEPS):
  t=frame*DT/86400;vel,sp=flow(pos,t);mid=pos+.5*DT*vel;vel2,sp=flow(mid,t+.5*DT/86400);new=pos+DT*vel2
  good=np.isfinite(new).all(1)&(new[:,0]>0)&(new[:,0]<nx-1)&(new[:,1]>0)&(new[:,1]<ny-1)&(age<720)
  # Require a valid endpoint too; do not bridge masked shelf or coastal cells.
  check,_=flow(new,t+DT/86400);good &=np.isfinite(check).all(1)
  trail=trail.point(fade);td=ImageDraw.Draw(trail)
  oldpx=np.c_[pos[:,0]/(nx-1)*mw,(1-pos[:,1]/(ny-1))*mh];newpx=np.c_[new[:,0]/(nx-1)*mw,(1-new[:,1]/(ny-1))*mh]
  cols=lut[np.uint8(np.clip(np.nan_to_num(sp)/c['max'],0,1)*255)]
  for j in np.flatnonzero(good):td.line((*oldpx[j],*newpx[j]),fill=tuple(cols[j]),width=1)
  pos=new;age+=1
  bad=~good;pick=rng.integers(len(valid),size=bad.sum());pos[bad]=np.c_[valid[pick,1],valid[pick,0]]+rng.uniform(-.3,.3,(bad.sum(),2));age[bad]=0
  if frame%8==0:
   k=min(int(t),4);alpha=t-k;speed=np.hypot((1-alpha)*u[k]+alpha*u[k+1],(1-alpha)*v[k]+alpha*v[k+1]);rgba=cmap(np.clip(np.nan_to_num(speed)/c['max'],0,1));rgba[...,3]=np.isfinite(speed)*.32
   layer=Image.fromarray(np.uint8(rgba[::-1]*255),'RGBA').resize((mw,mh),Image.Resampling.BILINEAR);mapbg=Image.fromarray(np.uint8(bg)).convert('RGBA');mapbg.alpha_composite(layer);mapbg=mapbg.convert('RGB')
  out=base.copy();out.paste(ImageChops.screen(mapbg,trail),(mx,my));dd=ImageDraw.Draw(out)
  stamp=datetime.datetime(2026,9,29)+datetime.timedelta(seconds=frame*DT);dd.text((60,181),stamp.strftime('%d %b %Y · %H:%M UTC'),font=F(17),fill='#78ddc7')
  dd.line((60,975,1450,975),fill='#243e50',width=3);dd.line((60,975,60+1390*frame/(STEPS-1),975),fill='#71d5c9',width=3)
  if frame==320:out.save(P+c['id']+'_poster.png')
  writer.append_data(np.asarray(out))
  if frame%120==0:print(c['id'],frame,flush=True)
 summary.append({'region':c['id'],'depth_m':c['depth'],'dates':dates,'grid_shape':list(u.shape),'lon_spacing_deg':float(lon[1]-lon[0]),'lat_spacing_deg':float(lat[1]-lat[0]),'speed_max_ms':float(np.nanmax(np.hypot(u,v))),'speed_display_max_ms':c['max'],'valid_fraction':float(np.isfinite(u).mean())})
writer.close();json.dump(summary,open(P+'analysis_summary.json','w'),indent=2);print('COMPLETE',flush=True)
