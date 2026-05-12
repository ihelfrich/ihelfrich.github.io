---
title: "US NMTC Viewer"
blurb: "Cesium-based interactive viewer for every New Markets Tax Credit project deployed in the U.S. between FY2001 and FY2022. The data spine behind the rural-mobilization-gap paper."
status: live
url: "https://ihelfrich.github.io/us-nmtc-viewer/"
repo: "https://github.com/ihelfrich/us-nmtc-viewer"
tags: ["dataset", "viewer", "blended-finance", "nmtc"]
date: 2026-04-20
pinned: true
---

The NMTC dataset I use in Helfrich (2026) on the rural mobilization gap, exposed as an interactive 3D viewer. Every project is a point colored by CDE, sized by Qualified Equity Investment amount, filterable by year, sector, and rural/non-metro flag. Click a project to see the underlying CDE, the loan structure, and the linked QALICB.

The viewer doubles as a data-quality checker: visible spatial outliers in the public CDFI Fund release become obvious when you plot the geocodes against the tract centroid grid.
