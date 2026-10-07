"""Render global near-surface flow from NOAA's drifter-derived climatology.

uv run --no-project --with numpy --with scipy --with matplotlib --with cartopy --with pillow --with netCDF4 \
  python scripts/hidden-rivers/build_global_drifter_film.py
"""
from __future__ import annotations

import io
import json
import subprocess
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from netCDF4 import Dataset
from PIL import Image, ImageDraw
from scipy.ndimage import map_coordinates
import cartopy.crs as ccrs
import cartopy.feature as cfeature

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"public/hidden-rivers"
ATLAS=OUT/"remote-atlas"
ATLAS.mkdir(parents=True,exist_ok=True)
BG="#061522"; LAND="#17343b"; INK="#edf6f2"; MUTED="#9db7b9"; TEAL="#51d9c8"


def month_mean(values):
    valid=np.isfinite(values);count=valid.sum(axis=0)
    result=np.nansum(values,axis=0)/np.maximum(count,1)
    result[count==0]=np.nan
    return result


def load_fields():
    # NOAA ERDDAP grid is [month, longitude, latitude]. Four-cell index strides
    # keep the complete global seasonal field at ~1° display spacing.
    query="U[(0):1:(11)][(-179.875):4:(179.875)][(-72.875):4:(84.875)],V[(0):1:(11)][(-179.875):4:(179.875)][(-72.875):4:(84.875)]"
    url="https://erddap.aoml.noaa.gov/gdp/erddap/griddap/drifter_monthlymeans.nc?"+urllib.parse.quote(query,safe="[]():.,-T Z")
    request=urllib.request.Request(url,headers={"User-Agent":"HiddenRiversAtlas/1.0 (NOAA Global Drifter Program citation in site)"})
    with urllib.request.urlopen(request,timeout=60) as response: data=response.read()
    with Dataset("drifter-memory.nc",memory=data) as ds:
        lon=np.array(ds.variables["longitude"][:]);lat=np.array(ds.variables["latitude"][:])
        u=np.ma.filled(ds.variables["U"][:],np.nan).transpose(0,2,1).astype(np.float32)
        v=np.ma.filled(ds.variables["V"][:],np.nan).transpose(0,2,1).astype(np.float32)
    return lon,lat,u,v


def render_maps(lon,lat,u,v):
    mean_u=month_mean(u);mean_v=month_mean(v);speed=np.hypot(mean_u,mean_v)
    fig=plt.figure(figsize=(16,9),facecolor=BG)
    ax=fig.add_axes([.025,.16,.95,.72],projection=ccrs.Robinson());ax.set_global();ax.set_facecolor(BG)
    mesh=ax.pcolormesh(lon,lat,np.ma.masked_invalid(speed),transform=ccrs.PlateCarree(),cmap="magma",vmin=0,vmax=.45,shading="nearest",zorder=1,rasterized=True)
    ax.add_feature(cfeature.LAND.with_scale("110m"),facecolor=LAND,edgecolor="#63858a",linewidth=.35,zorder=3)
    # Sparse vectors reveal direction without turning the map into a hedgehog.
    sl=(slice(None,None,8),slice(None,None,8));u_sub=mean_u[sl];v_sub=mean_v[sl]
    lons,lats=np.meshgrid(lon[::8],lat[::8]);valid=np.isfinite(u_sub)&np.isfinite(v_sub)&(np.hypot(u_sub,v_sub)>.03)
    ax.quiver(lons[valid],lats[valid],u_sub[valid],v_sub[valid],transform=ccrs.PlateCarree(),color="#e4faf3",alpha=.65,scale=8,width=.0009,headwidth=2.6,zorder=4)
    ax.set_title("Annual mean · near-surface drifter currents",loc="left",color=INK,fontsize=15,pad=14)
    cb=fig.colorbar(mesh,ax=ax,orientation="horizontal",fraction=.035,pad=.055,shrink=.42,anchor=(.15,0))
    cb.set_label("Mean current speed · m s⁻¹",color=INK,labelpad=6);cb.ax.tick_params(colors=INK,labelsize=8);cb.outline.set_edgecolor(MUTED)
    fig.text(.035,.95,"GLOBAL DRIFTER PROGRAM · OBSERVATIONAL CLIMATOLOGY",color=TEAL,fontsize=9,weight="bold",va="top")
    fig.text(.035,.075,"Monthly means from satellite-tracked surface drifters · drogue centered at 15 m · source record through Feb 2023",color=INK,fontsize=9)
    fig.text(.035,.042,"A seasonal average, not a real-time current map or forecast. Vector sampling and color encode different properties.",color=MUTED,fontsize=8)
    fig.savefig(ATLAS/"global-drifter-currents.webp",dpi=150,facecolor=BG,pil_kwargs={"quality":92,"method":6});plt.close(fig)

    clean=plt.figure(figsize=(16,9),facecolor=BG)
    ax=clean.add_axes([0,0,1,1],projection=ccrs.Robinson());ax.set_global();ax.set_facecolor(BG)
    ax.pcolormesh(lon,lat,np.ma.masked_invalid(speed),transform=ccrs.PlateCarree(),cmap="magma",vmin=0,vmax=.45,shading="nearest",zorder=1,rasterized=True)
    ax.add_feature(cfeature.LAND.with_scale("110m"),facecolor=LAND,edgecolor="none",zorder=3)
    ax.quiver(lons[valid],lats[valid],u_sub[valid],v_sub[valid],transform=ccrs.PlateCarree(),color="#e4faf3",alpha=.54,scale=8,width=.00075,headwidth=2.6,zorder=4)
    clean.savefig(ATLAS/"global-drifter-currents-visual.webp",dpi=150,facecolor=BG,pil_kwargs={"quality":92,"method":6});plt.close(clean)


def film(lon,lat,u,v):
    # Particle paths are a visual integration through the 12 monthly-mean
    # fields. They illustrate the seasonal circulation; they are not drifter
    # tracks and are not used for physical inference.
    ny,nx=len(lat),len(lon);rng=np.random.default_rng(20261007)
    mean_u=month_mean(u);mean_v=month_mean(v);mean_speed=month_mean(np.hypot(u,v))
    wet=np.flatnonzero(np.isfinite(mean_u)&(mean_speed>.07))
    chosen=rng.choice(wet,min(800,len(wet)),replace=False);py,px=np.unravel_index(chosen,(ny,nx))
    plon=lon[px].astype(np.float64);plat=lat[py].astype(np.float64);active=np.ones(len(plon),bool)
    domain=ccrs.PlateCarree();projection=ccrs.Robinson()
    fig=plt.figure(figsize=(16,9),dpi=80,facecolor=BG)
    ax=fig.add_axes([0,0,1,1],projection=projection);ax.set_global();ax.set_facecolor(BG);ax.set_axis_off()
    ax.pcolormesh(lon,lat,np.ma.masked_invalid(mean_speed),cmap="magma",vmin=0,vmax=.45,shading="nearest",transform=domain,zorder=1,rasterized=True)
    ax.add_feature(cfeature.LAND.with_scale("110m"),facecolor=LAND,edgecolor="#45636b",linewidth=.35,zorder=3)
    fig.canvas.draw();background=Image.fromarray(np.asarray(fig.canvas.buffer_rgba()).copy()).convert("RGB");width,height=background.size
    projection_transform=ax.transData
    def sample(field,month,x,y):
        month_phase=month%12; mi=int(month_phase); mj=(mi+1)%12; frac=month_phase-mi
        ri=np.vstack([(y-lat[0])/(lat[1]-lat[0]),(x-lon[0])/(lon[1]-lon[0])])
        a=map_coordinates(field[mi],ri,order=1,mode="constant",cval=np.nan)
        b=map_coordinates(field[mj],ri,order=1,mode="constant",cval=np.nan)
        return (1-frac)*a+frac*b
    days_per_step=2.;steps=183;fps=10
    trails=[np.column_stack([plon,plat]).copy()]
    with tempfile.TemporaryDirectory(prefix="hidden-rivers-global-film-") as temp:
        for frame in range(steps):
            day=frame*days_per_step;month=day/30.4375
            eu=sample(u,month,plon,plat);nv=sample(v,month,plon,plat)
            dlon=eu*days_per_step*86400/(111320*np.maximum(.15,np.cos(np.deg2rad(plat))))
            dlat=nv*days_per_step*86400/110574
            plon[active]=(plon[active]+dlon[active]+180)%360-180;plat[active]+=dlat[active]
            active &= np.isfinite(eu)&np.isfinite(nv)&(plat>-72)&(plat<84)
            trails.append(np.column_stack([plon,plat]));trails=trails[-9:]
            frame_img=background.copy();draw=ImageDraw.Draw(frame_img,"RGBA")
            idx=np.flatnonzero(active)
            path_lons=np.stack([p[:,0] for p in trails])[:,idx];path_lats=np.stack([p[:,1] for p in trails])[:,idx]
            world=projection.transform_points(domain,path_lons,path_lats)[...,:2]
            pixel=projection_transform.transform(world.reshape(-1,2)).reshape(*world.shape)
            spd=np.hypot(eu,nv)
            for j,k in enumerate(idx):
                points=[(round(x),round(height-y)) for x,y in pixel[:,j] if np.isfinite(x+y)]
                if len(points)<2:continue
                t=np.clip(spd[k]/.8,0,1);color=(int(45+205*t),int(190-100*t),int(206-80*t))
                draw.line(points,fill=(*color,52),width=5,joint="curve");draw.line(points,fill=(*color,210),width=1,joint="curve")
                x0,y0=points[-1];draw.ellipse((x0-1.5,y0-1.5,x0+1.5,y0+1.5),fill=(*color,230))
            frame_img.save(Path(temp)/f"frame-{frame:04}.jpg",quality=88)
            if frame%45==0:print(f"Global seasonal film {frame}/{steps}",flush=True)
        movie=OUT/"film-global-currents.mp4"
        cmd=["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate",str(fps),"-i",str(Path(temp)/"frame-%04d.jpg"),"-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p","-movflags","+faststart","-an","-metadata","title=Global ocean currents | NOAA drifter climatology","-metadata","comment=Text-free seasonal loop through NOAA Global Drifter Program monthly mean near-surface currents; drogue centered at 15m. Particle paths are illustrative integrations, not observed drifter tracks.","-t",str(steps/fps),str(movie)]
        subprocess.run(cmd,check=True)


def main():
    lon,lat,u,v=load_fields();render_maps(lon,lat,u,v);film(lon,lat,u,v)
    metadata={"source":"NOAA Global Drifter Program monthly mean climatology","dataset":"drifter_monthlymeans","url":"https://erddap.aoml.noaa.gov/gdp/erddap/griddap/drifter_monthlymeans.html","method":"Monthly mean near-surface velocities derived from satellite-tracked drifter observations","drogueDepthMeters":15,"recordThrough":"2023-02-28","displayGridDegrees":1.0,"map":"/hidden-rivers/remote-atlas/global-drifter-currents.webp","textFreeMap":"/hidden-rivers/remote-atlas/global-drifter-currents-visual.webp","textFreeVideo":"/hidden-rivers/film-global-currents.mp4","interpretation":"Climatological seasonal circulation, not a real-time field. Animated particles are illustrative integrations, not observed drifter tracks."}
    (ATLAS/"global-drifter-currents.json").write_text(json.dumps(metadata,indent=2)+"\n")
    manifest_path=ATLAS/"manifest.json"
    if manifest_path.exists():
        manifest=json.loads(manifest_path.read_text())
        manifest["maps"]=[m for m in manifest.get("maps",[]) if m.get("id")!="global-drifter-currents"]
        manifest["maps"].insert(0,{"id":"global-drifter-currents","title":"The currents that wrap the world","image":metadata["map"],"presentationImage":metadata["textFreeMap"],"displayDate":"Monthly climatology · record through Feb 2023","source":"NOAA Global Drifter Program; drogue centered at 15 m","sourceUrl":metadata["url"],"caption":metadata["interpretation"]})
        manifest_path.write_text(json.dumps(manifest,indent=2)+"\n")


if __name__=="__main__":main()
