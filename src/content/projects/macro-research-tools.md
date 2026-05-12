---
title: "MacroResearchTools"
blurb: "Python toolkit for macroeconomic research with Numba-accelerated FRED pipelines and structural-VAR scaffolding. Built for the kind of empirical macro work where the data engineering eats the analyst's day."
status: in-progress
repo: "https://github.com/ihelfrich/MacroResearchTools"
tags: ["macro", "python", "numba", "FRED"]
date: 2025-08-07
pinned: false
---

The FRED-fetch and panel-construction layer pre-dates the macroprep teaching site; macroprep uses a stripped-down version of this pipeline. The Numba acceleration matters when you're running rolling-window VARs over a 60-year monthly panel and you'd rather not wait 40 minutes for the kernel to come back.

Private until I've cleaned up the API and decided whether it's a paper-accompaniment release or a standalone tool.
