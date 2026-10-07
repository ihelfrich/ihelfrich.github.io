"""Ocean folio: calibrated physical quantities with separate text-free exports.

uv run --no-project --with numpy --with scipy --with matplotlib --with cartopy --with cmocean \
  --with netCDF4 --with gsw --with pillow python scripts/hidden-rivers/render_ocean_folio.py
WOA sources are cached in /tmp/hidden-rivers-density; --fetch downloads them.
No new trajectories, inferred overflow paths or observational validation.
"""
from pathlib import Path
import argparse
import hashlib
import json
import urllib.request
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cf
import cmocean
from netCDF4 import Dataset
import gsw
from PIL import Image
from scipy.interpolate import RegularGridInterpolator

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/hidden-rivers/data'
OUT = ROOT / 'public/hidden-rivers/ocean-folio'
OUT.mkdir(exist_ok=True)
CACHE = Path('/tmp/hidden-rivers-density')
BG, INK, DIM, LAND = '#071521', '#f2ede2', '#a8bec5', '#182f3b'
DATE = '2026-10-01T00:00:00Z'
plt.rcParams.update({'font.family':'DejaVu Sans', 'text.color':INK,
                     'axes.labelcolor':DIM, 'xtick.color':DIM, 'ytick.color':DIM})
manifest = json.loads((DATA/'manifest.json').read_text())
diagnostics = json.loads((DATA/'diagnostics.json').read_text())
region = next(r for r in manifest['regions'] if r['id']=='agulhas')
metadata = {'created':'2026-10-07','imagePixels':[3840,2160], 'views':[],
            'interpretation':'Export resolution does not increase the resolving power of source fields. Map scalar colors use linear display interpolation only within valid source stencils; sections preserve native cells.'}

def ramps():
    for name,cmap in [('speed',cmocean.cm.thermal),('vorticity',cmocean.cm.balance),('ftle',cmocean.cm.matter_r),('temperature',cmocean.cm.thermal),('salinity',cmocean.cm.haline),('density',cmocean.cm.dense)]:
        rgb=(cmap(np.linspace(0,1,512))[:,:3]*255).round().astype('uint8')
        Image.fromarray(np.repeat(rgb[None,:,:],16,axis=0)).save(OUT/f'{name}-scale.png')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def canvas():
    return plt.figure(figsize=(16,9),facecolor=BG)

def save(fig, slug, info):
    path = OUT/f'{slug}.png'
    fig.savefig(path,dpi=240,facecolor=BG)
    plt.close(fig)
    # Small copies are previews; downloads retain the full export.
    im=Image.open(path).convert('RGB');im.resize((1920,1080),Image.Resampling.LANCZOS).save(OUT/f'{slug}-preview.png',optimize=True)
    metadata['views'].append({'id':slug,'file':path.name,'sha256':digest(path),**info})

def map_axes(fig, box, labels=False):
    ax=fig.add_axes(box,projection=ccrs.Mercator(central_longitude=22.5))
    ax.set_extent([10,35,-43,-30],crs=ccrs.PlateCarree());ax.set_facecolor(BG)
    ax.set_axis_off()
    ax.add_feature(cf.LAND.with_scale('50m'),facecolor=LAND,zorder=5)
    ax.add_feature(cf.COASTLINE.with_scale('50m'),edgecolor='#879b9d',linewidth=.4,zorder=6)
    if labels:
        for name,x,y in [('Cape Town',18.42,-33.93),('Gqeberha',25.6,-33.96)]:
            ax.text(x,y+.32,name,fontsize=7,color=INK,transform=ccrs.PlateCarree(),zorder=8)
    return ax

def velocity(depth):
    m=next(v for v in region['layers'] if v['depth']==depth)
    a=np.fromfile(DATA/m['file'],dtype='<i2').reshape((2,*m['shape'])).astype(float)
    a[a==manifest['missing']]=np.nan;a*=manifest['velocityScale']
    u,v=a[:,m['dates'].index(DATE)]
    return m, m['lon0']+np.arange(u.shape[1])*m['dlon'],m['lat0']+np.arange(u.shape[0])*m['dlat'],u,v

def bathymetry(ax):
    m=region['terrain'];z=np.fromfile(DATA/m['file'],dtype='<i2').reshape(m['shape'])
    lon=m['lon0']+np.arange(z.shape[1])*m['dlon'];lat=m['lat0']+np.arange(z.shape[0])*m['dlat']
    ax.contour(lon,lat,z,levels=[-4000,-2000,-1000,-200],colors='#a2b4bb',linewidths=.3,alpha=.24,transform=ccrs.PlateCarree(),zorder=2)

def scalar_map(ax,lon,lat,values,cmap,lo,hi):
    # Interpolate the scalar, never its RGB or its missing mask. NaN corners
    # remain NaN, so smoothing cannot bridge a dry stencil or extend coverage.
    x=np.linspace(lon[0],lon[-1],650);y=np.linspace(lat[0],lat[-1],450)
    yy,xx=np.meshgrid(y,x,indexing='ij')
    points=np.stack([yy,xx],axis=-1)
    smooth=RegularGridInterpolator((lat,lon),values,bounds_error=False,fill_value=np.nan)(points)
    return ax.pcolormesh(x,y,np.ma.masked_invalid(smooth),cmap=cmap,vmin=lo,vmax=hi,
                         shading='nearest',transform=ccrs.PlateCarree(),rasterized=True,zorder=1)

def speed_map(ax,depth):
    m,lon,lat,u,v=velocity(depth)
    im=scalar_map(ax,lon,lat,np.hypot(u,v),cmocean.cm.thermal,0,2)
    bathymetry(ax)
    ax.streamplot(lon,lat,np.ma.masked_invalid(u/np.cos(np.deg2rad(lat[:,None]))),np.ma.masked_invalid(v),
                  color='#f3e9cc',density=2.3,linewidth=.36,arrowsize=.36,
                  transform=ccrs.PlateCarree(),zorder=3)
    return im,m

def heading(fig,index,title,subtitle):
    fig.text(.045,.953,f'HIDDEN RIVERS     /     {index:02d}',color=DIM,fontsize=8)
    fig.text(.045,.907,title,fontsize=25,weight='light')
    fig.text(.045,.868,subtitle,fontsize=9,color=DIM)

def colorbar(fig,im,label,ticks,box=(.69,.057,.26,.009),extend='neither'):
    ax=fig.add_axes(box);cb=fig.colorbar(im,cax=ax,orientation='horizontal',ticks=ticks,extend=extend)
    cb.outline.set_visible(False);cb.ax.tick_params(length=2,labelsize=7)
    cb.set_label(label,size=8,labelpad=5)

def depth_plates():
    for depth in [0,500,1000,2000]:
        fig=canvas();ax=map_axes(fig,[0,0,1,1]);im,m=speed_map(ax,depth)
        save(fig,f'agulhas-{depth}',{'quantity':'horizontal speed','units':'m s-1','range':[0,2],
             'depthMetres':depth,'date':DATE,'sourceFile':m['file'],'sourceSha256':digest(DATA/m['file']),
             'sourceGridDegrees':[m['dlon'],m['dlat']],'projection':'Mercator',
             'limits':'Instantaneous model streamlines, not measured parcel tracks. Values above 2 m/s use the top color.'})
    fig=canvas();heading(fig,1,'One current, four depths','Agulhas retroflection · 1 October 2026, 00:00 UTC · identical geographic extents and speed scale')
    for depth,box in zip([0,500,1000,2000],[[.045,.47,.445,.355],[.51,.47,.445,.355],[.045,.09,.445,.355],[.51,.09,.445,.355]]):
        ax=map_axes(fig,box);im,m=speed_map(ax,depth)
        fig.text(box[0]+.012,box[1]+box[3]-.027,'SURFACE' if depth==0 else f'{depth:,} m',fontsize=9,color=INK)
    colorbar(fig,im,'Horizontal speed · m/s',[0,.5,1,1.5,2],box=(.69,.065,.26,.008),extend='max')
    fig.text(.045,.032,'HYCOM ESPC-D-V02 model analysis · NOAA ETOPO1 relief · Natural Earth coastlines',fontsize=7,color=DIM)
    save(fig,'depth-print',{'quantity':'four matched horizontal speed maps','range':[0,2],'depthMetres':[0,500,1000,2000],'date':DATE})

def dynamics_plates():
    m=diagnostics['regions'][0]['layers'][0];g=m['grid']
    lon=g['lon0']+np.arange(g['shape'][1])*g['dlon'];lat=g['lat0']+np.arange(g['shape'][0])*g['dlat']
    for name,cmap,lo,hi,factor,units in [('vorticity',cmocean.cm.balance,-6,6,1e5,'10^-5 s^-1'),('ftle',cmocean.cm.matter_r,0,1.2,1,'day^-1')]:
        f=m['fields'][name];values=np.fromfile(DATA/f['file'],dtype='<f4').reshape(f['shape'])[f['dates'].index(DATE)]*factor
        for annotated in [False,True]:
            fig=canvas()
            if annotated: heading(fig,2,'Rotation' if name=='vorticity' else 'The separation of neighboring paths',
                 'Agulhas surface · 1 October 2026' + (' · signed local rotation' if name=='vorticity' else ' · forward integration to 3 October, 00:00 UTC'))
            ax=map_axes(fig,[.045,.12,.91,.71] if annotated else [0,0,1,1],annotated)
            im=scalar_map(ax,lon,lat,values,cmap,lo,hi)
            bathymetry(ax)
            if name=='vorticity':
                _,vlon,vlat,u,v=velocity(0)
                ax.streamplot(vlon,vlat,np.ma.masked_invalid(u/np.cos(np.deg2rad(vlat[:,None]))),np.ma.masked_invalid(v),color='#f2ead8',density=1.8,linewidth=.27,arrowsize=.35,transform=ccrs.PlateCarree(),zorder=3)
            if annotated:
                colorbar(fig,im,'Relative vorticity · 10⁻⁵ s⁻¹' if name=='vorticity' else '48-hour forward FTLE · day⁻¹',[-6,0,6] if name=='vorticity' else [0,.6,1.2],extend='both')
                fig.text(.045,.058,'Blue: clockwise. Copper: counterclockwise.' if name=='vorticity' else 'Bright regions indicate finite-time separation, including shear.',fontsize=8,color=DIM)
                fig.text(.045,.029,'HYCOM-derived diagnostic · masked cells are uncolored · color limits clip the display',fontsize=7,color=DIM)
            save(fig,name+('-print' if annotated else ''),{'quantity':name,'range':[lo,hi],'units':units,
                 'sourceFile':f['file'],'sourceSha256':digest(DATA/f['file']),'date':DATE,
                 'sourceGridDegrees':[g['dlon'],g['dlat']],
                 'limits':'Rotation does not identify a persistent eddy; FTLE ridges alone are not validated transport barriers.'})

def section_plates(fetch=False):
    CACHE.mkdir(exist_ok=True);paths={};sources=[]
    for variable,code in [('temperature','t'),('salinity','s')]:
        p=CACHE/f'woa23_decav_{code}00_01.nc'
        url=f'https://www.ncei.noaa.gov/data/oceans/woa/WOA23/DATA/{variable}/netcdf/decav/1.00/{p.name}'
        if not p.exists():
            if not fetch: raise FileNotFoundError(f'{p}; use --fetch')
            with urllib.request.urlopen(url,timeout=30) as r,p.open('wb') as w:
                while b:=r.read(2**20):w.write(b)
        paths[code]=p;sources.append({'url':url,'sha256':digest(p),'variable':variable})
    with Dataset(paths['t']) as t,Dataset(paths['s']) as s:
        lat=np.asarray(t['lat'][:]);lon=np.asarray(t['lon'][:]);depth=np.asarray(t['depth'][:])
        assert np.array_equal(lat,s['lat'][:]) and np.array_equal(lon,s['lon'][:]) and np.array_equal(depth,s['depth'][:])
        j=int(np.argmin(abs(lon+30.5)));iy=np.where((lat>=-60)&(lat<=65))[0];iz=np.where(depth<=4000)[0]
        T=np.asarray(t['t_an'][0,iz,iy,j].filled(np.nan));S=np.asarray(s['s_an'][0,iz,iy,j].filled(np.nan))
    lat,depth=lat[iy],depth[iz];valid=np.isfinite(T)&np.isfinite(S)
    pressure=gsw.p_from_z(-depth[:,None],lat[None,:]);SA=gsw.SA_from_SP(S,pressure,lon[j],lat[None,:])
    CT=gsw.CT_from_t(SA,T,pressure);sigma=gsw.sigma0(SA,CT);sigma[~valid]=np.nan
    # Preserve the subset used for every image, without committing the global files.
    np.savez_compressed(OUT/'atlantic-section.npz',latitude=lat,depth=depth,longitude=lon[j],temperature=T,salinity=S,sigma0=sigma)
    section={'longitudeDegrees':float(lon[j]),'period':'1955–2022 annual climatology','gridDegrees':1,
             'method':'WOA23 t_an/s_an; pressure from depth/latitude; TEOS-10 SA_from_SP, CT_from_t, sigma0. Density is calculated from mean T/S, not the mean of individual densities. Sigma0 is referenced to 0 dbar, not in-situ density or neutral density.',
             'sourceFiles':sources,'finiteCells':int(valid.sum()),'shape':list(T.shape),
             'limits':'Objectively analyzed climatology, not a contemporaneous survey or velocity field. The 1-degree grid cannot resolve overflow troughs. Section axes have separate scales; there is no rendered terrain.'}
    metadata['section']=section
    for name,values,cmap,lo,hi,units,ticks in [('temperature',T,cmocean.cm.thermal,-2,28,'°C',[0,10,20,28]),('salinity',S,cmocean.cm.haline,33,37,'practical salinity',[33,34,35,36,37]),('density',sigma,cmocean.cm.dense,25,28,'kg/m³',[25,26,27,28])]:
        for annotated in [False,True] if name=='density' else [False]:
            fig=canvas()
            if annotated: heading(fig,3,'The layered Atlantic','A north–south section at 30.5°W · NOAA World Ocean Atlas 2023 · annual climatology, 1955–2022')
            ax=fig.add_axes([.07,.19,.88,.62] if annotated else [.03,.035,.94,.93]);ax.set_facecolor(BG)
            im=ax.pcolormesh(lat,depth,np.ma.masked_invalid(values),cmap=cmap,vmin=lo,vmax=hi,shading='nearest',rasterized=True)
            contours=ax.contour(lat,depth,sigma,levels=[25,26,27,27.5,27.7,27.8,27.9],colors='#e7eee9',alpha=.35,linewidths=.45)
            ax.set_ylim(4000,0);ax.set_xlim(-60,65)
            if annotated:
                ax.clabel(contours,levels=[27,27.5,27.8],fontsize=7,fmt='%g',inline=True)
                ax.set_xticks([-60,-30,0,30,60],['60°S','30°S','Equator','30°N','60°N']);ax.set_yticks([0,1000,2000,3000,4000]);ax.set_ylabel('Depth · metres',fontsize=8)
                ax.tick_params(labelsize=8,length=3);ax.spines[['top','right']].set_visible(False);ax.spines[['left','bottom']].set_color('#465a64')
                colorbar(fig,im,'Potential density anomaly σ₀ · kg/m³',[25,26,27,28],box=(.69,.085,.26,.009),extend='min')
                fig.text(.07,.085,'Contour lines share the same density reference.\nThe section describes water properties, not flow direction.',fontsize=8,color=DIM,linespacing=1.6)
                fig.text(.07,.033,'1° source grid · 0–4,000 m · independent horizontal/vertical axes · TEOS-10, reference pressure 0 dbar',fontsize=7,color=DIM)
            else: ax.set_axis_off()
            save(fig,'atlantic-'+name+('-print' if annotated else ''),{'quantity':name,'units':units,'range':[lo,hi],
                 'period':section['period'],'contours':'sigma0: 25, 26, 27, 27.5, 27.7, 27.8, 27.9 kg/m3','limits':section['limits']})
    assert np.array_equal(np.isfinite(sigma),valid)
    assert 22<float(np.nanmin(sigma))<26 and 27.5<float(np.nanmax(sigma))<29
    # A controlled classroom comparison at one reference pressure/location.
    # This is an equation-of-state calculation, not a tank-flow simulation.
    temps=np.arange(0,30.01,.25);salts=np.arange(30,38.01,.1)
    SP,Tmesh=np.meshgrid(salts,temps)
    SA=gsw.SA_from_SP(SP,0,-30.5,30.5);CT=gsw.CT_from_t(SA,Tmesh,0)
    density=gsw.rho(SA,CT,0)
    assert np.all(np.diff(density,axis=1)>0) and np.all(np.diff(density[1:],axis=0)<0)
    (OUT/'density-lab.json').write_text(json.dumps({'temperatureStart':0,'temperatureStep':.25,'salinityStart':30,'salinityStep':.1,'shape':list(density.shape),'density':np.round(density,5).ravel().tolist(),'units':'kg m-3','reference':'TEOS-10: SP → SA at 30.5°W, 30.5°N; CT_from_t; rho at 0 dbar. Display interpolation is bilinear. No fluid motion is simulated.'},separators=(',',':'))+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--fetch',action='store_true');args=parser.parse_args()
    ramps();depth_plates();dynamics_plates();section_plates(args.fetch)
    (OUT/'manifest.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(f"Rendered {len(metadata['views'])} source-grounded images in {OUT}")
