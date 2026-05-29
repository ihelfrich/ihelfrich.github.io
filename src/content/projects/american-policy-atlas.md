---
title: "American Policy Atlas"
blurb: "A teaching observatory for statistics built on every U.S. county. Scrollytelling modules walk from a single map to spatial autocorrelation, empirical-Bayes shrinkage, and a California redlining flagship — each with the live numbers and a grounded research-assistant panel."
status: live
url: "https://ihelfrich.github.io/american-policy-atlas/"
repo: "https://github.com/ihelfrich/american-policy-atlas"
tags: ["observatory", "statistics", "teaching", "census", "spatial"]
date: 2026-05-29
pinned: true
---

An atlas that teaches inference rather than just displaying it. The map of 3,144 counties is the entry point; from there the modules build up the machinery a reader needs to argue about the numbers — confidence intervals on the diabetes rate, the income–poverty regression and why the slope moves when you add a control, Moran's I (I = 0.60, permutation p = 0.001) for spatial dependence, and empirical-Bayes shrinkage for the small-county problem.

The flagship case study is the California redlining story at the census-tract level: HOLC grades against present-day health and credit outcomes, with the associational claims kept honest. A right-drawer research assistant answers questions grounded only in the atlas's own corpus — client-side TF-IDF retrieval on bare GitHub Pages, with an optional Cloudflare Workers AI layer for generated answers when an endpoint is configured. No API key ever ships to the browser.
