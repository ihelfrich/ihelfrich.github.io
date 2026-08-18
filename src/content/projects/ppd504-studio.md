---
title: "Public-Data Statistics Studio"
blurb: "An archived graduate-level statistics studio with interactive sampling, distribution, correlation, and regression labs plus reproducible Census and FRED exercises."
status: live
url: "https://ihelfrich.github.io/ppd504-studio/"
repo: "https://github.com/ihelfrich/ppd504-studio"
tags: ["teaching", "statistics", "d3", "public-policy"]
date: 2026-06-25
pinned: false
---

This archived course implementation is retained as evidence of reusable instructional patterns, not presented as a standalone career-defining project. Its interactive elements include a mean-versus-median balance beam, a sampling-distribution builder, a survivorship-bias demonstration, an OLS sandbox, an empirical-rule visualization, and a Benford first-digit explorer.

The practice layer is the part I am proudest of. Each lesson ends with a bank of problems carrying a graduated Hint then Show-solution reveal. The data-driven problems pull real public data (Census ACS 2023 state income, education, poverty, population, and a sex-by-education table; FRED unemployment and house prices), and every answer is computed live from the bundled numbers through the stats library, so no figure is hand-typed or can drift. Students see the same education-to-income regression (r = 0.83) and the same right-skew in state incomes that a real analyst would.

The implementation is one folder of plain HTML, CSS, and JavaScript with D3 vendored locally. It loads without a network and demonstrates a reusable lab chassis. The reviewed, generalizable ideas are being incorporated into the broader Statistics and Inference capability family rather than marketed under a single course code.
