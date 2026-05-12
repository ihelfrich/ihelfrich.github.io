---
title: "Effective distance: a satellite-calibrated bilateral trade-cost panel, 2000-2024"
authors: ["Elizaveta Gonchar", "Ian Helfrich"]
year: 2026
status: "working paper"
venue: "in preparation; target Journal of International Economics"
abstract: "Builds the first global, time-varying, satellite-calibrated, multi-modal bilateral effective-distance panel for 200 countries over 2000-2024. The construction uses VIIRS and DMSP-VIIRS nightlights, WorldPop / GHS-POP / HRSL gridded population, and OpenStreetMap-derived transport networks (road, maritime, air) to compute least-cost-path distances with endogenous mode choice. Validated in the Yotov et al. (2016) structural gravity framework with Weidner-Zylkin (2021) bias correction. Three live counterfactuals: the 2021 Suez closure (Ever Given), the 2023 Panama Canal drought, and the 2024 Houthi Red Sea rerouting. Material revisions to ACR welfare numbers under each. Released as CC-BY public-good infrastructure."
tags: ["trade", "gravity", "effective-distance", "satellite-economics", "panel-data"]
---

The big version of the work we started in [Trade in the Spotlight](/research/gonchar-helfrich-2025-spotlight) (SSRN 5202676). That paper introduced the OVDL measure (Origin-VIIRS-to-Destination-LandScan). This one adds the transport-network layer, structural gravity validation with three-way FE PPML, and welfare counterfactuals for the three live chokepoint shocks.

Why now: CEPII's `distw` is the field standard despite being static (2004 city populations). Three recent chokepoint shocks make the cost of ignoring time-varying transport-network geography empirically salient and press-legible. Open satellite data and open transport networks now make a global panel computationally feasible for a small team. No competitor has released the panel yet; IMF Working Paper 25/93 suggests the space is warming.

Output: 200 countries × 25 years × 8 distance variants, roughly 40,000 rows per variant-year. Companion code in `Paper5_EffectiveDistance/` (PyTorch + cuGraph for the network layer). Target submission JIE; release on Zenodo with DOI.
