"""Build a small, source-labeled remote-sensing atlas for Hidden Rivers.

The basemap is Esri World Imagery. The Great Barrier Reef heat-stress overlay
is NOAA Coral Reef Watch's gridded Degree Heating Week product, not a mockup.
The downloadable source NetCDF is fetched on demand and is not copied into the
site. Run with uv and the dependencies listed in scripts/hidden-rivers/README.md.
"""
from __future__ import annotations

import io
import json
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from netCDF4 import Dataset
from PIL import Image
import cartopy.crs as ccrs
import cartopy.feature as cfeature

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/hidden-rivers/remote-atlas"
OUT.mkdir(parents=True, exist_ok=True)
CACHE = Path(tempfile.gettempdir()) / "hidden-rivers-remote-imagery"
CACHE.mkdir(exist_ok=True)
BG = "#071c2a"
INK = "#edf6f2"
MUTED = "#9db7b9"
GOLD = "#f4c95d"
TEAL = "#59d9cf"
PLACES = [
    {"id":"blue-hole", "title":"Lighthouse Reef", "kicker":"BELIZE · CARIBBEAN SEA", "bounds":[-87.78,17.12,-87.36,17.54], "focus":[-87.5344,17.3153], "point":"Great Blue Hole", "caption":"The reef is visible from orbit; its famous blue circle is a collapse structure, not an ocean current. The hole is about 305 m across and 123 m deep.", "source":"NASA/METI/AIST/Japan Space Systems & U.S./Japan ASTER Science Team", "sourceUrl":"https://asterweb.jpl.nasa.gov/gallery-detail.asp?name=bluehole"},
    {"id":"great-barrier-reef", "title":"The reef in a heatwave", "kicker":"GREAT BARRIER REEF · AUSTRALIA", "bounds":[147.2,-19.6,150.9,-16.0], "focus":[149.2,-18.1], "point":"Whitsunday sector", "caption":"Satellite-derived Degree Heating Weeks show accumulated thermal stress across the reef on 15 March 2024. DHW summarizes heat stress; it is not a direct observation of coral condition.", "source":"NOAA Coral Reef Watch v3.1 DHW · 5 km · 15 Mar 2024", "sourceUrl":"https://coralreefwatch.noaa.gov/product/5km/"},
    {"id":"outer-banks", "title":"A coast that keeps moving", "kicker":"OUTER BANKS · NORTH CAROLINA", "bounds":[-78.0,34.8,-74.1,36.8], "focus":[-75.53,35.25], "point":"Cape Hatteras", "caption":"Barrier islands, inlets, and shoals form a restless edge. Satellite imagery shows the shoreline; it does not by itself measure a long-term erosion rate.", "source":"Esri World Imagery; NOAA National Geodetic Survey coastal mapping", "sourceUrl":"https://www.fisheries.noaa.gov/inport/item/72201"},
    {"id":"guiana-shield", "title":"Amaila Falls, Guyana", "kicker":"GUIANA SHIELD · POTARO–SIPARUNI", "bounds":[-62.0,4.3,-58.0,7.0], "focus":[-59.5333,5.3667], "point":"Proposed Amaila Falls site", "caption":"China Railway Group was selected for a proposed Amaila Falls project in 2021. This map marks the proposed site; the cited records do not establish an operating dam or substantiate the claim that it is unregulated.", "source":"Esri World Imagery; Guyana Energy Agency; Guyana DPI (2021)", "sourceUrl":"https://dpi.gov.gy/cabinet-grants-no-objection-to-amaila-falls-hydropower-project-afhp-and-the-new-demerara-harbour-bridge-ndhb/"},
    {"id":"point-nemo", "title":"Point Nemo", "kicker":"SOUTH PACIFIC · OCEANIC POLE OF INACCESSIBILITY", "bounds":[-143,-58,-104,-39], "focus":[-123.3933,-48.8767], "point":"48°52.6′S · 123°23.6′W", "caption":"The point farthest from land lies beneath the South Pacific gyre. Here, the surface gives few clues to the abyssal landscape and slow, basin-scale circulation below.", "source":"Esri World Imagery; NOAA National Ocean Service", "sourceUrl":"https://oceanservice.noaa.gov/facts/nemo.html"},
    {"id":"amazon-plume", "title":"The Amazon runs out to sea", "kicker":"AMAZON MOUTH · TROPICAL ATLANTIC", "bounds":[-62,-4,-37,14], "focus":[-48,5], "point":"Amazon freshwater plume", "caption":"A daily satellite-informed surface-salinity field across the Amazon plume. Freshwater fans into the tropical Atlantic; the broad grid resolves basin-scale structure, not the narrow plume edge or estuarine channels.", "source":"NOAA CoastWatch daily SMAP SSS · 0.25° grid · 15 Mar 2024", "sourceUrl":"https://oceanwatch.noaa.gov/cwn/products/sea-surface-salinity-near-real-time-smap.html"},
]


def imagery(bounds: list[float]) -> Image.Image:
    west, south, east, north = bounds
    width = 2200
    height = round(width * (north - south) / ((east - west) * np.cos(np.deg2rad((north + south) / 2))))
    height = int(np.clip(height, 900, 1900))
    params = {"bbox": ",".join(map(str, bounds)), "bboxSR":4326, "imageSR":4326,
              "size":f"{width},{height}", "format":"jpg", "f":"image"}
    url = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?" + urllib.parse.urlencode(params)
    key = "-".join(str(x).replace("-", "m").replace(".", "p") for x in bounds)
    path = CACHE / f"{key}.jpg"
    if path.exists():
        return Image.open(path).convert("RGB")
    req = urllib.request.Request(url, headers={"User-Agent":"HiddenRiversAtlas/1.0 (public research visualization)"})
    with urllib.request.urlopen(req, timeout=45) as response:
        if "image" not in response.headers.get("Content-Type", ""):
            raise RuntimeError(f"Imagery service returned {response.headers.get('Content-Type')}")
        content = response.read()
        path.write_bytes(content)
        return Image.open(io.BytesIO(content)).convert("RGB")


def download_dhw() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    url = "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/dhw/2024/ct5km_dhw_v3.1_20240315.nc"
    req = urllib.request.Request(url, headers={"User-Agent":"HiddenRiversAtlas/1.0"})
    with urllib.request.urlopen(req, timeout=45) as response:
        content = response.read()
    with Dataset("inmemory.nc", memory=content) as ds:
        lon = np.array(ds.variables["lon"][:])
        lat = np.array(ds.variables["lat"][:])
        values = np.ma.filled(ds.variables["degree_heating_week"][0], np.nan)
    return lon, lat, values


def download_smap_snapshot() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    # One dated, native-grid daily field avoids presenting a period contrast as
    # a trend. Near-land retrievals are less reliable than open-ocean values.
    query = "sss[(2024-03-15T00:00:00Z)][(0.0)][(-4.0):(14.0)][(-62.0):(-37.0)]"
    url = "https://coastwatch.noaa.gov/erddap/griddap/noaacwSMAPsssDaily.nc?" + urllib.parse.quote(query, safe="[]():.,-T Z")
    req = urllib.request.Request(url, headers={"User-Agent":"HiddenRiversAtlas/1.0 (NOAA CoastWatch data citation in map)"})
    with urllib.request.urlopen(req, timeout=90) as response:
        content = response.read()
    with Dataset("smap-inmemory.nc", memory=content) as ds:
        lat = np.array(ds.variables["latitude"][:])
        lon = np.array(ds.variables["longitude"][:])
        field = np.ma.filled(ds.variables["sss"][0, 0, :, :], np.nan)
    return lon, lat, field


def add_scale(ax, bounds):
    west, south, east, north = bounds
    lat = south + .045 * (north - south)
    lon = west + .06 * (east - west)
    km = (east - west) * 111.32 * np.cos(np.deg2rad((south+north)/2)) * .22
    dlon = km / (111.32 * np.cos(np.deg2rad(lat)))
    ax.plot([lon, lon+dlon], [lat,lat], color=INK, lw=2.3, transform=ccrs.PlateCarree(), zorder=10)
    ax.plot([lon,lon], [lat-.01*(north-south),lat+.01*(north-south)], color=INK, lw=1.3, transform=ccrs.PlateCarree(), zorder=10)
    ax.plot([lon+dlon,lon+dlon], [lat-.01*(north-south),lat+.01*(north-south)], color=INK, lw=1.3, transform=ccrs.PlateCarree(), zorder=10)
    ax.text(lon+dlon/2, lat+.022*(north-south), f"{km:.0f} km", color=INK, fontsize=9, ha="center", transform=ccrs.PlateCarree(), zorder=11,
            bbox={"facecolor":BG,"alpha":.72,"edgecolor":"none","pad":2})


def save_visual(place, field, backdrop):
    """Create the clean, text-free version used by the cinema presentation."""
    west,south,east,north=place["bounds"]
    if place["id"] not in ("great-barrier-reef", "amazon-plume"):
        backdrop.save(OUT/f"{place['id']}-visual.webp",format="WEBP",quality=94,method=6)
        return
    fig=plt.figure(figsize=(16,8),facecolor=BG)
    proj=ccrs.Mercator(central_longitude=(west+east)/2)
    left=fig.add_axes([0,.02,.5,.96],projection=proj)
    right=fig.add_axes([.5,.02,.5,.96],projection=proj)
    for ax in (left,right):
        ax.set_extent([west,east,south,north],crs=ccrs.PlateCarree());ax.set_facecolor("#092839");ax.set_axis_off()
    left.imshow(backdrop,extent=[west,east,south,north],origin="upper",transform=ccrs.PlateCarree(),zorder=0)
    lon,lat,values=field
    if place["id"]=="great-barrier-reef":
        xi=np.flatnonzero((lon>=west)&(lon<=east))[::3];yi=np.flatnonzero((lat>=south)&(lat<=north))[::3]
        if lat[yi[0]]>lat[yi[-1]]:yi=yi[::-1]
        values=values[np.ix_(yi,xi)];lon=lon[xi];lat=lat[yi]
        overlay=right.pcolormesh(lon,lat,np.ma.masked_less(values,1),cmap="magma",vmin=1,vmax=16,alpha=.9,shading="nearest",transform=ccrs.PlateCarree(),zorder=2)
    else:
        overlay=right.pcolormesh(lon,lat,np.ma.masked_invalid(values),cmap="YlGnBu_r",vmin=28,vmax=37,alpha=.9,shading="nearest",transform=ccrs.PlateCarree(),zorder=2)
    right.add_feature(cfeature.LAND.with_scale("10m"),facecolor="#345664",edgecolor="#d6ece6",linewidth=.38,zorder=3)
    right.add_feature(cfeature.COASTLINE.with_scale("10m"),edgecolor="#e5f1e8",linewidth=.45,alpha=.9,zorder=4)
    fig.savefig(OUT/f"{place['id']}-visual.webp",dpi=150,facecolor=BG,pil_kwargs={"quality":93,"method":6})
    plt.close(fig)


def render(place, dhw):
    west,south,east,north=place["bounds"]
    fig=plt.figure(figsize=(16,10),facecolor=BG)
    if place["id"] in ("great-barrier-reef", "amazon-plume"):
        axes=[fig.add_axes([.035,.20,.445,.76],projection=ccrs.Mercator(central_longitude=(west+east)/2)),
              fig.add_axes([.52,.20,.445,.76],projection=ccrs.Mercator(central_longitude=(west+east)/2))]
    else:
        axes=[fig.add_axes([0.035,0.20,0.93,0.76],projection=ccrs.Mercator(central_longitude=(west+east)/2))]
    ax=axes[0]
    ax.set_extent([west,east,south,north],crs=ccrs.PlateCarree())
    ax.set_facecolor("#0a2635")
    img=imagery(place["bounds"])
    save_visual(place,dhw,img)
    ax.imshow(img,extent=[west,east,south,north],origin="upper",transform=ccrs.PlateCarree(),zorder=0)
    if place["id"]=="great-barrier-reef":
        lon,lat,vals=dhw
        xi=np.flatnonzero((lon>=west)&(lon<=east))[::3]
        yi=np.flatnonzero((lat>=south)&(lat<=north))[::3]
        if lat[yi[0]]>lat[yi[-1]]: yi=yi[::-1]
        xs=lon[xi];ys=lat[yi];z=vals[np.ix_(yi,xi)]
        overlay=axes[1]
        overlay.set_extent([west,east,south,north],crs=ccrs.PlateCarree());overlay.set_facecolor("#0a2635")
        art=overlay.pcolormesh(xs,ys,np.ma.masked_less(z,1),cmap="magma",vmin=1,vmax=16,alpha=.88,shading="nearest",transform=ccrs.PlateCarree(),zorder=2)
        overlay.add_feature(cfeature.LAND.with_scale("10m"),facecolor="#345664",edgecolor="#d6ece6",linewidth=.38,zorder=3)
        overlay.add_feature(cfeature.COASTLINE.with_scale("10m"),edgecolor="#e5f1e8",linewidth=.45,alpha=.9,zorder=4)
        overlay.set_title("NOAA · cumulative heat stress",color=INK,fontsize=10,pad=8)
        cb=fig.colorbar(art,ax=overlay,orientation="vertical",fraction=.04,pad=.02,shrink=.65)
        cb.set_label("Degree Heating Weeks (°C-weeks)",color=INK,fontsize=10)
        cb.ax.tick_params(colors=INK,labelsize=8);cb.outline.set_edgecolor(MUTED)
    elif place["id"]=="amazon-plume":
        lon,lat,delta=dhw
        overlay=axes[1]
        overlay.set_extent([west,east,south,north],crs=ccrs.PlateCarree());overlay.set_facecolor("#092839")
        art=overlay.pcolormesh(lon,lat,np.ma.masked_invalid(delta),cmap="YlGnBu_r",vmin=28,vmax=37,alpha=.9,shading="nearest",transform=ccrs.PlateCarree(),zorder=2)
        overlay.add_feature(cfeature.LAND.with_scale("10m"),facecolor="#345664",edgecolor="#d6ece6",linewidth=.38,zorder=3)
        overlay.add_feature(cfeature.COASTLINE.with_scale("10m"),edgecolor="#e5f1e8",linewidth=.45,alpha=.9,zorder=4)
        overlay.set_title("SMAP · surface salinity · 15 Mar 2024",color=INK,fontsize=10,pad=8)
        cb=fig.colorbar(art,ax=overlay,orientation="vertical",fraction=.04,pad=.02,shrink=.65)
        cb.set_label("Sea-surface salinity · PSU",color=INK,fontsize=10)
        cb.ax.tick_params(colors=INK,labelsize=8);cb.outline.set_edgecolor(MUTED)
        ax.set_title("Satellite imagery context",color=INK,fontsize=10,pad=8)
    ax.add_feature(cfeature.COASTLINE.with_scale("10m"),edgecolor="#e5f1e8",linewidth=.48,alpha=.65,zorder=3)
    lon,lat=place["focus"]
    ax.scatter([lon],[lat],s=70,marker="o",facecolor=GOLD,edgecolor=BG,linewidth=1.2,transform=ccrs.PlateCarree(),zorder=12)
    ax.scatter([lon],[lat],s=350,marker="o",facecolor="none",edgecolor=GOLD,linewidth=1.1,alpha=.8,transform=ccrs.PlateCarree(),zorder=11)
    ax.text(lon+(east-west)*.022,lat+(north-south)*.035,place["point"],color=INK,fontsize=10,weight="bold",transform=ccrs.PlateCarree(),zorder=13,
            bbox={"facecolor":BG,"alpha":.82,"edgecolor":"none","pad":3})
    gl=ax.gridlines(draw_labels=True,linewidth=.35,color=INK,alpha=.35,linestyle=":")
    gl.top_labels=False;gl.right_labels=False;gl.xlabel_style={"color":INK,"size":8};gl.ylabel_style={"color":INK,"size":8}
    add_scale(ax,place["bounds"])
    fig.text(.045,.965,place["kicker"],color=TEAL,fontsize=10,weight="bold",va="top")
    fig.text(.045,.917,place["title"],color=INK,fontsize=28,weight="light",va="top")
    fig.text(.045,.165,place["caption"],color=INK,fontsize=11,va="top",wrap=True)
    fig.text(.045,.079,place["source"],color=MUTED,fontsize=8,va="top")
    fig.text(.045,.043,"BASEMAP: ESRI WORLD IMAGERY  ·  CARTOGRAPHIC PROJECTION: MERCATOR  ·  NORTH UP",color="#78969a",fontsize=7.5,va="top")
    fig.text(.955,.043,"HIDDEN RIVERS",color="#78969a",fontsize=7.5,ha="right",va="top")
    fig.savefig(OUT/f"{place['id']}.webp",dpi=150,facecolor=BG,pil_kwargs={"quality":91,"method":6})
    plt.close(fig)


def main():
    dhw=download_dhw()
    smap=download_smap_snapshot()
    for place in PLACES:
        print(f"Rendering {place['id']}…",flush=True)
        render(place,smap if place["id"]=="amazon-plume" else dhw)
    (OUT/"manifest.json").write_text(json.dumps({"title":"Remote sensing atlas","maps":[{**p,"image":f"/hidden-rivers/remote-atlas/{p['id']}.webp","presentationImage":f"/hidden-rivers/remote-atlas/{p['id']}-visual.webp","displayDate":"2024-03-15" if p["id"] in ("great-barrier-reef","amazon-plume") else "Satellite imagery composite; acquisition dates vary by tile"} for p in PLACES],"credits":"Esri, Maxar, Earthstar Geographics, and the GIS User Community; NOAA CoastWatch and Coral Reef Watch; NASA/JPL/PO.DAAC; NOAA/NOS; Guyana Energy Agency; Government of Guyana."},indent=2)+"\n")


if __name__=="__main__": main()
