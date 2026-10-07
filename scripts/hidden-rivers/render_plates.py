"""Reproducible atlas plates from the released arrays, without new inference.

uv run --no-project --with numpy --with scipy --with matplotlib --with cartopy --with cmocean
  --with pillow python scripts/hidden-rivers/render_plates.py
Colors encode the stated variable; all projections, timestamps, masks and units
are taken from the release metadata. Streamlines are instantaneous directions,
not particle trajectories. PNGs are exports; WebP copies serve the gallery.
"""
from pathlib import Path
import json
import sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cf
from PIL import Image
import cmocean

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT/'public/hidden-rivers/data'
OUT = ROOT/'public/hidden-rivers/plates'
OUT.mkdir(exist_ok=True)
manifest = json.loads((DATA/'manifest.json').read_text())
diagnostics = json.loads((DATA/'diagnostics.json').read_text())
BG, INK, MUTED, LAND = '#081a2c', '#edf3f0', '#9bb7c7', '#405b61'
plt.rcParams.update({'font.family':'DejaVu Sans', 'text.color':INK,
                     'axes.labelcolor':INK, 'xtick.color':MUTED, 'ytick.color':MUTED})
plates=[]
PRESENTATION = '--presentation' in sys.argv

def canvas(number, title, subtitle, bounds):
    if PRESENTATION:
        fig=plt.figure(figsize=(16,9),facecolor=BG)
        ax=fig.add_axes([0,0,1,1],projection=ccrs.Mercator(central_longitude=(bounds[0]+bounds[2])/2))
        ax.set_extent([bounds[0],bounds[2],bounds[1],bounds[3]],crs=ccrs.PlateCarree())
        ax.set_facecolor(BG);ax.set_axis_off()
        return fig,ax
    fig=plt.figure(figsize=(14,10),facecolor=BG)
    fig.text(.06,.94,f'HIDDEN RIVERS    /    ATLAS {number:02}',fontsize=10,color=MUTED,weight='medium')
    fig.text(.06,.887,title,fontsize=30,weight='light')
    fig.text(.06,.85,subtitle,fontsize=11,color=MUTED)
    centre=(bounds[0]+bounds[2])/2
    ax=fig.add_axes([.06,.19,.88,.60],projection=ccrs.Mercator(central_longitude=centre))
    ax.set_extent([bounds[0],bounds[2],bounds[1],bounds[3]],crs=ccrs.PlateCarree())
    ax.set_facecolor(BG)
    for spine in ax.spines.values(): spine.set_edgecolor('#54717b');spine.set_linewidth(.5)
    return fig,ax

def geography(ax):
    ax.add_feature(cf.LAND.with_scale('50m'),facecolor=LAND,zorder=4)
    ax.add_feature(cf.COASTLINE.with_scale('50m'),edgecolor='#b7c9c4',linewidth=.48,zorder=5)
    if PRESENTATION:return
    grid=ax.gridlines(draw_labels=True,linewidth=.35,color=INK,alpha=.16,linestyle=':')
    grid.top_labels=False;grid.right_labels=False
    grid.xlabel_style={'size':9,'color':MUTED};grid.ylabel_style={'size':9,'color':MUTED}

def labels(ax,places):
    if PRESENTATION:return
    for text,lon,lat in places:
        ax.plot(lon,lat,'o',markersize=2,color=INK,transform=ccrs.PlateCarree(),zorder=8)
        ax.text(lon+.25,lat+.18,text,fontsize=8,color=INK,transform=ccrs.PlateCarree(),zorder=9)

def finish(fig,artist,slug,title,caption,scale,notes,region,depth,mode='flow',date='2026-10-02T00:00:00Z',source_files=()):
    if PRESENTATION:
        fig.savefig(OUT/f'{slug}-presentation.webp',dpi=160,facecolor=BG)
        plt.close(fig)
        return
    cax=fig.add_axes([.65,.09,.29,.012])
    cb=fig.colorbar(artist,cax=cax,orientation='horizontal',extend='both')
    cb.outline.set_visible(False);cb.ax.tick_params(labelsize=8,length=2);cb.set_label(scale,size=9,labelpad=7)
    fig.text(.06,.11,notes,fontsize=9,color=MUTED,linespacing=1.7)
    fig.text(.06,.038,'HYCOM / ESPC-D-V02  ·  Natural Earth coastlines  ·  Mercator projection',fontsize=8,color=MUTED)
    fig.text(.94,.038,'IAN HELFRICH',fontsize=8,color=MUTED,ha='right')
    fig.savefig(OUT/f'{slug}.png',dpi=200,facecolor=BG)
    Image.open(OUT/f'{slug}.png').convert('RGB').resize((1400,1000),Image.Resampling.LANCZOS).save(OUT/f'{slug}.webp',quality=91)
    plt.close(fig)
    plates.append({'id':slug,'title':title,'caption':caption,'date':date,'region':region,'depth':depth,'mode':mode,'width':2800,'height':2000,'sourceFiles':list(source_files)})

def speed(region_id,depth,title,subtitle,number,places=()):
    region=next(r for r in manifest['regions'] if r['id']==region_id)
    m=next(x for x in region['layers'] if x['depth']==depth)
    a=np.fromfile(DATA/m['file'],dtype='<i2').reshape((2,*m['shape'])).astype(float)
    a[a==manifest['missing']]=np.nan;a*=manifest['velocityScale']
    t=m['dates'].index('2026-10-02T00:00:00Z');u,v=a[:,t]
    lon=m['lon0']+np.arange(m['shape'][2])*m['dlon'];lat=m['lat0']+np.arange(m['shape'][1])*m['dlat']
    fig,ax=canvas(number,title,subtitle,region['bounds'])
    artist=ax.pcolormesh(lon,lat,np.hypot(u,v),cmap=cmocean.cm.thermal,vmin=0,vmax=2,shading='nearest',transform=ccrs.PlateCarree(),rasterized=True)
    # Convert eastward speed to longitude rate before plotting directions on a
    # longitude/latitude grid. Common R and degree factors cancel in the tangent.
    ax.streamplot(lon,lat,np.ma.masked_invalid(u/np.cos(np.deg2rad(lat[:,None]))),np.ma.masked_invalid(v),
                  color=INK,density=1.65,linewidth=.5,arrowsize=.55,transform=ccrs.PlateCarree(),zorder=3)
    geography(ax);labels(ax,places)
    slug=f'{region_id}-{depth}-speed'
    finish(fig,artist,slug,title,subtitle,'Horizontal speed · m s⁻¹',
           f'2 OCT 2026 · 00:00 UTC · {"SURFACE" if depth==0 else str(depth)+" m DEPTH"}\nStreamlines show instantaneous direction. Missing model cells are uncolored.',region_id,depth,source_files=[m['file']])

speed('agulhas',0,'The Agulhas turn','Surface currents south of Africa',1,[('Cape Town',18.42,-33.93),('Gqeberha',25.6,-33.96)])
speed('bahamas',200,'Through the Florida Straits','Horizontal currents at 200 metres',2,[('Miami',-80.19,25.77),('Nassau',-77.35,25.07),('Havana',-82.36,23.11)])
speed('denmark',1000,'Below Denmark Strait','Horizontal currents at 1,000 metres',3,[('Reykjavík',-21.94,64.15),('Tasiilaq',-37.64,65.61)])
region=manifest['regions'][0]
layer=diagnostics['regions'][0]['layers'][0]
grid=layer['grid']
lon=grid['lon0']+np.arange(grid['shape'][1])*grid['dlon'];lat=grid['lat0']+np.arange(grid['shape'][0])*grid['dlat']
for number,field,title,subtitle,cmap,lo,hi,factor,unit,mode in [
    (4,'vorticity','The sign of rotation','Counterclockwise and clockwise rotation in the Agulhas surface field',cmocean.cm.balance,-6,6,1e5,'Relative vorticity · 10⁻⁵ s⁻¹','vorticity'),
    (5,'ftle','Where neighboring paths separate','Forward finite-time stretching · 48-hour integration',cmocean.cm.amp,0,1.2,1,'FTLE · day⁻¹','stretching')]:
    f=layer['fields'][field];date='2026-10-01T00:00:00Z';t=f['dates'].index(date)
    values=np.fromfile(DATA/f['file'],dtype='<f4').reshape(f['shape'])[t]*factor
    fig,ax=canvas(number,title,subtitle,region['bounds'])
    artist=ax.pcolormesh(lon,lat,values,cmap=cmap,vmin=lo,vmax=hi,shading='nearest',transform=ccrs.PlateCarree())
    geography(ax);labels(ax,[('Cape Town',18.42,-33.93)])
    note='1 OCT 2026 · 00:00 UTC · SURFACE\nBlue: clockwise. Red: counterclockwise. Zero is neutral.' if field=='vorticity' else '1–3 OCT 2026 · SURFACE\nIncomplete 48-hour trajectories are masked. Stretching is not a verified barrier.'
    finish(fig,artist,'agulhas-'+field,title,subtitle,unit,note,'agulhas',0,mode,date,[f['file']])

# An additional plate makes the land representation inspectable independently
# of WebGL, with a full-vector calculation at the documented reference pixel.
base=ROOT/'public/hidden-rivers/coastal';m=json.loads((base/'manifest.json').read_text())
q=np.fromfile(base/'vectors.i8',dtype='i1').reshape(-1,128).astype(np.float64)
valid=np.fromfile(base/'valid.u8',dtype='u1').astype(bool)
anchor=m['initialPixel'][1]*m['width']+m['initialPixel'][0]
norm=np.linalg.norm(q,axis=1);scores=np.full(len(q),np.nan)
scores[valid]=(q[valid]@q[anchor])/(norm[valid]*norm[anchor])
if PRESENTATION:
    fig=plt.figure(figsize=(10,10),facecolor=BG)
    ax=fig.add_axes([0,0,1,1]);ax.set_axis_off()
    ax.imshow(scores.reshape(m['height'],m['width']),cmap='cividis',vmin=.5,vmax=1)
    fig.savefig(OUT/'cape-tessera-presentation.webp',dpi=200,facecolor=BG)
    plt.close(fig)
    print('Rendered six text-free presentation maps',flush=True)
    sys.exit(0)
fig=plt.figure(figsize=(14,10),facecolor=BG)
fig.text(.06,.94,'HIDDEN RIVERS    /    ATLAS 06',fontsize=10,color=MUTED)
fig.text(.06,.887,'A reference in the Cape Peninsula',fontsize=30,weight='light')
fig.text(.06,.85,'Annual satellite representation · all 128 Tessera components · 2024',fontsize=11,color=MUTED)
for index,title in enumerate(['Satellite context','Cosine similarity to reference A']):
    ax=fig.add_axes([.06+index*.47,.22,.41,.57]);ax.set_title(title,fontsize=11,color=INK,pad=12)
    if index==0:ax.imshow(Image.open(base/'cape-imagery.jpg'),extent=[0,256,256,0])
    else:artist=ax.imshow(scores.reshape(m['height'],m['width']),cmap='cividis',vmin=.5,vmax=1,extent=[0,256,256,0])
    ax.plot(m['initialPixel'][0]+.5,m['initialPixel'][1]+.5,'+',color='white',markersize=16,markeredgewidth=1.5)
    ax.set_xticks([]);ax.set_yticks([])
cax=fig.add_axes([.57,.12,.35,.012]);cb=fig.colorbar(artist,cax=cax,orientation='horizontal',extend='min');cb.set_label('Cosine similarity to A',size=10);cb.outline.set_visible(False)
fig.text(.06,.13,'5.12 km native-grid window · 20 m sample spacing\nYellow: greater similarity. Blue: lower similarity.\nA retrieval score, not a habitat class or probability.',fontsize=10,color=MUTED,linespacing=1.7)
fig.text(.06,.045,'Tessera v1.1 / dClimate · imagery © Esri, Maxar, Earthstar Geographics · native UTM grid',fontsize=8,color=MUTED)
fig.savefig(OUT/'cape-tessera.png',dpi=200,facecolor=BG);plt.close(fig)
Image.open(OUT/'cape-tessera.png').convert('RGB').resize((1400,1000),Image.Resampling.LANCZOS).save(OUT/'cape-tessera.webp',quality=91)
plates.append({'id':'cape-tessera','title':'A reference in the Cape Peninsula','caption':'Full-vector Tessera similarity beside satellite context.','date':'2024','region':'cape','depth':None,'mode':'tessera','width':2800,'height':2000,'sourceFiles':['../coastal/vectors.i8','../coastal/valid.u8']})
(OUT/'manifest.json').write_text(json.dumps({'plates':plates,'rendering':'render_plates.py; fixed quantitative scales, masked missing data; no invented measurements'},indent=2)+'\n')
print(f'Rendered {len(plates)} atlas plates',flush=True)
