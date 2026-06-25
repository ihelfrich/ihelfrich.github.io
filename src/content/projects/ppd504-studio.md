---
title: "PPD 504 Studio"
blurb: "Interactive studio for an MPA-level statistics course: 19 hands-on D3 labs (sampling, distributions, correlation, regression) plus an 80-problem practice bank whose data-driven answers compute live from real Census and FRED data. No build step, fully offline."
status: live
url: "https://ihelfrich.github.io/ppd504-studio/"
repo: "https://github.com/ihelfrich/ppd504-studio"
tags: ["teaching", "statistics", "d3", "public-policy"]
date: 2026-06-25
pinned: true
---

Built for Essential Statistics for Public Management (the Meier, Brudney & Bohte syllabus). Every concept is something you can grab, drag, and break: a balance beam for mean versus median, a sampling-distribution builder, Wald's bombers for survivorship bias, a beat-the-line OLS sandbox that shows you cannot do better than least squares, the empirical rule with live shading, and a Benford first-digit explorer.

The practice layer is the part I am proudest of. Each lesson ends with a bank of problems carrying a graduated Hint then Show-solution reveal. The data-driven problems pull real public data (Census ACS 2023 state income, education, poverty, population, and a sex-by-education table; FRED unemployment and house prices), and every answer is computed live from the bundled numbers through the stats library, so no figure is hand-typed or can drift. Students see the same education-to-income regression (r = 0.83) and the same right-skew in state incomes that a real analyst would.

The whole thing is one folder of plain HTML, CSS, and JavaScript with D3 vendored locally. It loads instantly, runs with no network, and works straight from a file. The same shell is a reusable chassis: add a lab by writing one module file and one nav entry.
