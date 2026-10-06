---
title: "Hidden Rivers"
blurb: "A 3D ocean-current atlas combining depth-resolved HYCOM fields, NOAA seafloor relief, and Tessera coastal embeddings."
status: live
url: "https://ihelfrich.github.io/hidden-rivers/"
repo: "https://github.com/ihelfrich/ihelfrich.github.io/tree/main/src/scripts/hidden-rivers"
tags: ["oceanography", "geospatial analysis", "scientific visualization", "Tessera"]
searchTerms: ["underwater rivers", "HYCOM", "Agulhas", "Denmark Strait", "Bahamas", "bathymetry", "3D currents", "particle advection", "velocity profiles", "current direction", "CSV export"]
date: 2026-10-06
pinned: true
---

Hidden Rivers shows how ocean circulation changes across places and depths. Its 3D explorer combines geographically located seafloor relief with current fields for the Agulhas region, the Florida Current and Bahamas, and Denmark Strait and the Irminger Sea.

The Agulhas case includes the surface, 200 m, and 1,000 m. A separate coastal panel uses real 2024 Tessera embeddings. A 60-second film follows six daily ocean-model snapshots from September 29 through October 4, 2026. Dates, units, depth, and vertical exaggeration remain visible.

The explorer supports a north-up map, speed shading, and instantaneous direction arrows. A location inspector compares signed eastward and northward velocity across the available depths, charts the six daily speed samples, and exports a CSV. Map images include dates and source attribution; shareable links retain the selected time, location, and display settings.

The moving particles are numerical tracers constrained to horizontal depth planes. They do not reconstruct vertical descent, establish water-mass identity, or replace current-meter validation. Tessera is a coastal context layer and does not estimate underwater velocity. The methods and source manifest document interpolation, masking, sampling, and the limits of the visualization.

[Open the 3D atlas](/hidden-rivers/) · [Methods and sources](/hidden-rivers/#methods) · [Related oceanographic work](/projects/oceanographic-systems)
