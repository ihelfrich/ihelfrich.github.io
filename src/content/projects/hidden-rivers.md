---
title: "Hidden Rivers"
blurb: "A satellite water atlas connecting Amazon rivers, coastal plumes, reefs, and ocean currents at their actual data depths."
status: live
url: "https://ihelfrich.github.io/hidden-rivers/"
repo: "https://github.com/ihelfrich/ihelfrich.github.io/tree/main/src/scripts/hidden-rivers"
tags: ["oceanography", "geospatial analysis", "scientific visualization", "remote sensing", "Sentinel-2", "PCA"]
searchTerms: ["underwater rivers", "HYCOM", "Agulhas", "Denmark Strait", "Bahamas", "bathymetry", "3D currents", "particle advection", "velocity profiles", "current direction", "CSV export", "FTLE", "finite-time Lyapunov exponent", "vorticity", "deformation", "Tessera embeddings", "cosine similarity", "coastal retrieval", "Cape Peninsula", "Cesium", "sampling sensitivity"]
date: 2026-10-07
pinned: true
---

Hidden Rivers connects inland rivers, estuaries, freshwater plumes and ocean circulation on one continuous satellite map. Standard pan, scroll, pinch and keyboard navigation work across the atlas. A searchable place picker moves between the Amazon basin, North Carolina coast, Guyana, Lighthouse Reef, the Great Barrier Reef and major ocean-current systems.

Dated Copernicus Sentinel-2 Level-2A scenes supply natural-color imagery and a green–near-infrared water index. Four-band PCA uses B2/B3/B4/B8, with a shared covariance basis and color stretch across each place’s acquisitions. PC1 controls lightness; PC2 and PC3 supply restrained opponent colors. Clouds and shadows stay masked. The date playback shows separate acquisitions rather than synthesizing intermediate observations.

HydroRIVERS supplies drainage geometry and downstream connections derived from elevation data. Moving river marks show verified direction; their display rate is not measured river velocity. The ocean views use NOAA’s drifter-derived monthly current climatology at a 15 m drogue depth, or HYCOM analyses at available surface and interior levels. Depth selection changes the velocity data. Streamlines describe a selected velocity field; they do not reconstruct vertical motion or claim to be observed parcel tracks.

Comparisons keep satellite imagery and spectral layers in the same geographic frame. Clicking inspects a sampled water index or signed ocean velocity. View links retain the place, layer, depth, date and map position. Presentation mode removes the interface, while PNG export saves the visible map with a small source credit.

The separate research view retains the rotation, finite-time stretching, Tessera similarity, terrain context, downloadable plates and silent films. It includes the source-cadence audit: the Agulhas surface’s 48-hour stretching calculation changes more when three-hour inputs are reduced to daily samples than when the integration step is halved. This is numerical sensitivity, not validation against colocated observations.

[Open the water atlas](/hidden-rivers/) · [Ocean calculations and print maps](/hidden-rivers/research/) · [Related oceanographic work](/projects/oceanographic-systems)
