---
title: "Hidden Rivers"
blurb: "A 3D ocean observatory for modeled trajectories, rotation, finite-time stretching, and coastal retrieval across all 128 Tessera dimensions."
status: live
url: "https://ihelfrich.github.io/hidden-rivers/"
repo: "https://github.com/ihelfrich/ihelfrich.github.io/tree/main/src/scripts/hidden-rivers"
tags: ["oceanography", "geospatial analysis", "scientific visualization", "Tessera"]
searchTerms: ["underwater rivers", "HYCOM", "Agulhas", "Denmark Strait", "Bahamas", "bathymetry", "3D currents", "particle advection", "velocity profiles", "current direction", "CSV export", "FTLE", "finite-time Lyapunov exponent", "vorticity", "deformation", "Tessera embeddings", "cosine similarity", "coastal retrieval", "Cape Peninsula", "Cesium", "sampling sensitivity"]
date: 2026-10-06
pinned: true
---

Hidden Rivers follows modeled ocean currents through time and depth in the Agulhas region, Florida and the Bahamas, and Denmark Strait and the Irminger Sea. Its WebGL observatory combines georeferenced NOAA seafloor relief with deterministic trajectories through HYCOM velocity fields. Rotation and deformation views show relative vorticity and 48-hour forward finite-time stretching. The same seeded paths persist while the user changes time or camera position.

The Agulhas surface uses 41 three-hour analyses from September 29 through October 4, 2026. Agulhas at 200 and 1,000 m, Florida/Bahamas at 200 m, and Denmark Strait/Irminger Sea at 1,000 m use six daily analyses over the same interval. Depth comparison deliberately subsamples the surface to daily inputs, separating temporal sampling from the comparison across depths. A location inspector reports signed velocity, current direction, time series, and downloadable point data.

The coastal microscope queries 2024 Tessera representations over a 5.12 km Cape Peninsula footprint. It retains all 128 published dimensions for 65,475 valid sampled pixels. Selecting one reference retrieves similar representations; selecting a second reveals their relative similarity. Spatially separated matches, explicit color scales, and numerical exports make the query inspectable. A selected pixel can also open a linked Cesium terrain and building view when the browser has a configured Cesium connection.

The numerical audit compares integration steps, finite-difference perturbations, and source cadence. At the Agulhas surface, three-hour versus daily inputs change the 48-hour stretching diagnostic by a median 0.114 day⁻¹, much more than halving the integration step. This measures sensitivity to sampling, not agreement with observations. Source hashes, masks, formulas, and complete integration windows accompany the downloadable arrays.

A [48-second film](/hidden-rivers/film-v3.mp4) renders the browser's actual trajectories, local rotation, a fixed stretching window, and aligned depth layers at explicit model times and camera poses. The particles remain on horizontal depth surfaces. They do not reconstruct vertical descent, identify water masses, or establish volume transport. Tessera similarity is a separate annual representation analysis linked by geography; it does not measure currents or certify habitat classes.

[Open the ocean observatory](/hidden-rivers/) · [Query coastal representations](/hidden-rivers/#coastal) · [Methods and sources](/hidden-rivers/#methods) · [Related oceanographic work](/projects/oceanographic-systems)
