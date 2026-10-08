---
title: "Hidden Rivers"
blurb: "Explore deep ocean currents, Amazon waters and reefs through an interactive globe, satellite spectra and scientific maps."
status: live
url: "https://ihelfrich.github.io/hidden-rivers/"
repo: "https://github.com/ihelfrich/ihelfrich.github.io/tree/main/src/scripts/hidden-rivers"
tags: ["oceanography", "geospatial analysis", "scientific visualization", "remote sensing", "Sentinel-2", "PCA"]
searchTerms: ["underwater rivers", "HYCOM", "Agulhas", "Denmark Strait", "Bahamas", "bathymetry", "3D currents", "particle advection", "velocity profiles", "current direction", "CSV export", "FTLE", "finite-time Lyapunov exponent", "vorticity", "deformation", "Tessera embeddings", "cosine similarity", "coastal retrieval", "Cape Peninsula", "Cesium", "sampling sensitivity"]
date: 2026-10-07
pinned: true
---

Hidden Rivers connects inland rivers, estuaries, freshwater plumes and ocean circulation on a Cesium globe. Six short visual journeys follow deep currents, the meeting of Amazon waters, reef light, the Atlantic freshwater plume, the Cape Fear and the open ocean. A searchable place picker and a flat map provide other ways to explore. Terrain keeps its real vertical scale.

Dated Copernicus Sentinel-2 Level-2A scenes supply natural-color imagery and a green–near-infrared water index. Water PCA uses the native 10 m blue, green, red and near-infrared bands, with a shared covariance basis and color stretch across each place’s acquisitions. The first component closely tracks visible brightness; a second component adds the contrast described by that place’s actual band loadings. Three palettes preserve ordered lightness, and two water samples can be compared through their reflectance and component scores. Manaus, Lighthouse Reef and the Great Barrier Reef include source-resolution close-ups. Clouds and shadows stay masked. Date playback shows separate acquisitions.

These optical contrasts help distinguish waters and reveal reef patterns. They do not retrieve sediment concentration, coral health or water depth: the standard land-oriented atmospheric correction, illumination and submerged bottom all affect the signal.

HydroRIVERS supplies drainage geometry and downstream connections derived from elevation data. Moving river marks show verified direction; their display rate is not measured river velocity. The ocean views use NOAA’s drifter-derived monthly current climatology at a 15 m drogue depth, or HYCOM analyses at available surface and interior levels. Depth selection changes the velocity data. Streamlines describe a selected velocity field; they do not reconstruct vertical motion or claim to be observed parcel tracks.

Comparisons keep satellite imagery and spectral layers in the same geographic frame. Depth selection changes the modelled current field and the streamlines’ depth coordinates. View links retain the data selection, palette, story and camera position. Presentation mode removes the text and controls; PNG export saves the visible globe or flat map.

The separate research view retains the rotation, finite-time stretching, Tessera similarity, terrain context, downloadable plates and silent films. It includes the source-cadence audit: the Agulhas surface’s 48-hour stretching calculation changes more when three-hour inputs are reduced to daily samples than when the integration step is halved. This is numerical sensitivity, not validation against colocated observations.

The ocean folio returns to the project's original fluid-dynamics question. Matched Agulhas maps compare four depths on one speed scale; signed rotation and 48-hour separation show different physical aspects of the same current. A north–south Atlantic section uses NOAA World Ocean Atlas 2023 temperature and salinity climatology to calculate potential density with TEOS-10. A controlled density calculation, teaching prompts, 3,840 × 2,160 exports and text-free presentation accompany the images. The 1° hydrographic grid describes basin structure; it cannot resolve an overflow plume. Research notes identify the observations needed for Denmark Strait, Ross Sea and Congo Canyon studies.

An interactive three-dimensional tank lets visitors turn the water, release dye at different depths and set two to four saline layers. The browser solves incompressible Boussinesq flow with conservative salt and pigment transport and TEOS-10 density at 10 °C. A cutaway reveals the interior; dye, salinity and speed views show the same calculated state. Resolution choices change the actual grid. Published checks cover hydrostatic rest, conservation, pressure projection, analytic vortex decay and selected grid and timestep comparisons. This is a qualitative laminar model, with fixed temperature and a rigid surface; it is not a laboratory-calibrated or turbulent ocean simulation.

[Open the water atlas](/hidden-rivers/) · [Ocean folio](/hidden-rivers/folio/) · [Ocean calculations and print maps](/hidden-rivers/research/) · [Related oceanographic work](/projects/oceanographic-systems)
