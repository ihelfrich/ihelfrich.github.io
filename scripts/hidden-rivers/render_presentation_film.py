"""Render a caption-free 24 s particle film from the released HYCOM surface field.

uv run --no-project --with numpy --with scipy --with matplotlib --with cartopy --with cmocean --with pillow python scripts/hidden-rivers/render_presentation_film.py
"""
from pathlib import Path
import json, subprocess, tempfile
import numpy as np
from scipy.ndimage import map_coordinates
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.colors as colors
from PIL import Image, ImageDraw
import cartopy.crs as ccrs
import cartopy.feature as cf
import cmocean

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'public/hidden-rivers/data'
OUT=ROOT/'public/hidden-rivers/film-presentation.mp4'
m=json.loads((DATA/'manifest.json').read_text())
r=next(x for x in m['regions'] if x['id']=='agulhas')
l=next(x for x in r['layers'] if x['depth']==0)
u,v=np.fromfile(DATA/l['file'],dtype='<i2').reshape(2,*l['shape']).astype(np.float32)
u[u==m['missing']]=np.nan;v[v==m['missing']]=np.nan
u*=m['velocityScale'];v*=m['velocityScale']
ny,nx=u.shape[1:];lon=l['lon0']+np.arange(nx)*l['dlon'];lat=l['lat0']+np.arange(ny)*l['dlat']
xx,yy=np.meshgrid(lon,lat)
# Seed the same fixed wet grid on every render; this is a qualitative path view.
rng=np.random.default_rng(20261002)
wet=np.flatnonzero(np.isfinite(u[0]) & (np.hypot(u[0],v[0])>.08))
chosen=rng.choice(wet,min(420,len(wet)),replace=False)
py,px=np.unravel_index(chosen,(ny,nx));plon=lon[px].astype(np.float64);plat=lat[py].astype(np.float64)
dt=300.;total=86400;frames=int(total/dt);fps=12
domain=ccrs.PlateCarree();projection=ccrs.Mercator(central_longitude=22)
BG='#061322';LAND='#183139';
plt.rcParams['figure.facecolor']=BG
fig=plt.figure(figsize=(16,9),dpi=80,facecolor=BG)
ax=fig.add_axes([0,0,1,1],projection=projection)
ax.set_extent([r['bounds'][0],r['bounds'][2],r['bounds'][1],r['bounds'][3]],crs=domain);ax.set_facecolor(BG);ax.set_axis_off()
ax.add_feature(cf.LAND.with_scale('50m'),facecolor=LAND,edgecolor='none',zorder=2)
ax.add_feature(cf.COASTLINE.with_scale('50m'),edgecolor='#82a8a6',linewidth=.7,alpha=.55,zorder=3)
# A quiet speed field remains fixed while particles follow one day of
# time-interpolated source velocity.
initial=np.hypot(u[0],v[0]);initial[~np.isfinite(u[0])]=np.nan
ax.pcolormesh(xx,yy,initial,cmap=cmocean.cm.thermal,norm=colors.Normalize(0,2),shading='nearest',transform=domain,rasterized=True,zorder=1,alpha=.55)
fig.canvas.draw()
background=Image.fromarray(np.asarray(fig.canvas.buffer_rgba()).copy()).convert('RGB')
width,height=background.size
active=np.ones(len(plon),dtype=bool)
def sample(a,sec):
    z=sec/(l['timeStepSeconds']);k=min(int(z),a.shape[0]-2);f=z-k
    ri=np.column_stack([py+(plat-lat[py])/l['dlat'],px+(plon-lon[px])/l['dlon']])
    return ((1-f)*map_coordinates(a[k],ri.T,order=1,mode='constant',cval=np.nan)+f*map_coordinates(a[k+1],ri.T,order=1,mode='constant',cval=np.nan))
if 'timeStepSeconds' not in l:l['timeStepSeconds']=10800
points=np.column_stack([plon,plat]);trail=[points.copy()]
with tempfile.TemporaryDirectory(prefix='hidden-rivers-presentation-') as temp:
    for i in range(frames):
        sec=i*dt
        east=sample(u,sec);north=sample(v,sec)
        active &= np.isfinite(east)&np.isfinite(north)&(np.abs(plat)<80)
        plon[active]+=east[active]*dt/(111320*np.maximum(.15,np.cos(np.deg2rad(plat[active]))))
        plat[active]+=north[active]*dt/110574
        active &= (plon>=r['bounds'][0])&(plon<=r['bounds'][2])&(plat>=r['bounds'][1])&(plat<=r['bounds'][3])
        points=np.column_stack([plon,plat]);trail.append(points.copy());trail=trail[-25:]
        speed=np.hypot(east,north);speed=np.where((speed>=0)&(speed<20),speed,0)
        frame=background.copy();draw=ImageDraw.Draw(frame,'RGBA')
        selected=np.flatnonzero(active)
        llon=np.stack([p[:,0] for p in trail])[:,selected]
        llat=np.stack([p[:,1] for p in trail])[:,selected]
        world=projection.transform_points(domain,llon,llat)[...,:2]
        pixel= ax.transData.transform(world.reshape(-1,2)).reshape(*world.shape)
        for j,k in enumerate(selected):
            path=[(round(x),round(height-y)) for x,y in pixel[:,j] if np.isfinite(x+y)]
            if len(path)<2:continue
            rgb=tuple(int(value*255) for value in cmocean.cm.thermal(float(np.clip(speed[k]/2,0,1)))[:3])
            draw.line(path,fill=(*rgb,43),width=7,joint='curve')
            draw.line(path,fill=(*rgb,205),width=2,joint='curve')
            x,y=path[-1];draw.ellipse((x-2,y-2,x+2,y+2),fill=(*rgb,255))
        if i%72==0:print(f'{i}/{frames} frames',flush=True)
        frame.save(Path(temp)/f'frame-{i:04}.jpg',quality=87)
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(fps),'-i',str(Path(temp)/'frame-%04d.jpg'),'-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart','-an','-metadata','title=Hidden Rivers | Ocean currents in motion','-metadata','comment=Text-free particle visualization of the HYCOM ESPC-D-V02 Agulhas surface velocity field, 29 September–1 October 2026. Trajectories show horizontal motion on a fixed depth surface.','-t','24',str(OUT)]
    subprocess.run(cmd,check=True)
print(f'Created {OUT} ({frames} frames, {total/3600:.0f} model hours)',flush=True)
