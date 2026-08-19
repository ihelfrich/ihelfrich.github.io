---
title: "MacroResearchTools"
blurb: "Python toolkit for macroeconomic research with Numba-accelerated FRED pipelines and structural-VAR scaffolding. Built for the kind of empirical macro work where the data engineering eats the analyst's day."
status: in-progress
tags: ["macro", "python", "numba", "FRED"]
date: 2025-08-07
pinned: false
---

The FRED-fetch and panel-construction layer predates later teaching tools; a stripped-down version has supported generalized macroeconomics instruction. The Numba acceleration matters when rolling-window VARs run over a 60-year monthly panel and the data pipeline would otherwise dominate the analysis time.

Private until I've cleaned up the API and decided whether it's a paper-accompaniment release or a standalone tool.
