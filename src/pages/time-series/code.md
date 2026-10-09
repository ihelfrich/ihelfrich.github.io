---
layout: ../../layouts/TimeSeriesText.astro
title: Code, data, and reproducibility
description: Complete executable lecture and project sources in R, Julia, and Python, with fixed inputs and explicit verification.
---

## Choose one language

The three independent implementations share inputs, parameter conventions, target dates, and numerical checks. You can study in one language and inspect another when a result is unclear. You need only one of the three runtimes to work through the course.

Download the [complete laboratory bundle](/time-series/downloads/time-series-labs.zip), extract it, and open a terminal in its `code` directory. Keep the relative directory structure: entry points load the corresponding `course` implementation, and those implementations read fixed files in `data`.

The tested environment is Python 3.14.7 with NumPy 2.4.3, SciPy 1.17.1, and Matplotlib 3.10.8; R 4.6.1; and Julia 1.12.7. The core R and Julia examples use standard libraries only. Python requirements and their resolution are recorded in `pyproject.toml` and `uv.lock`. No provider API credential is needed to run the examples.

## Python

Install Python and [uv](https://docs.astral.sh/uv/) if they are not available. In the extracted code directory:

```sh
uv sync --locked
uv run python ch01.py
uv run python projects.py
```

The first command prepares the project environment. A chapter entry point runs its exact experiment. `projects.py` runs the complete public project case. Core computation uses NumPy; the pinned scientific environment also supports supplementary calculation and figure generation.

## R

Use an installed R runtime and run:

```sh
Rscript ch01.R
Rscript projects.R
```

The reference implementations require base R. They do not install packages or change global settings. Read [course.R](/time-series/code/course.R) for every calculation, including least-squares conventions, residual recursion, filtering, covariance factors, and variance updates.

## Julia

Use an installed Julia runtime and run:

```sh
julia --startup-file=no ch01.jl
julia --startup-file=no projects.jl
```

The implementations use `LinearAlgebra`, `Statistics`, and `DelimitedFiles`. They require no external Julia packages. The verification runner can use a local writable depot for precompilation where the home depot is unavailable. Read [course.jl](/time-series/code/course.jl) for the full implementation.

## Verify all three concurrently

With all three runtimes available:

```sh
uv run python verify.py
```

The runner executes the full lecture implementations concurrently, then executes the three project implementations concurrently. It checks input hashes, finite outputs, analytic identities, future-mutation invariants, parameter-domain failures, metric coverage, cross-language agreement, and every retained project forecast's dates and value.

The current [verification report](/time-series/code/results/verification.json) records **112 lecture quantities**, **13 project quantities**, and **276 matched project forecast rows**. Lecture numerical tolerance is $10^{-9}$ absolute and relative; project tolerance is $10^{-8}$. The observed discrepancies are much smaller. Agreement is evidence of consistent implementation, not proof of a shared economic assumption.

The tests include deliberately failing cases: an inadmissible centered feature responds to future changes; a smoother intentionally uses later information; a covariance rotation changes shock interpretation without changing covariance; a rank-deficient design is rejected; a finite-variance GARCH routine rejects inadmissible parameters. The resulting repair or narrowed interpretation belongs to the lesson.

Run `uv run python verify-boundaries.py` for seven additional state-space checks in each language. They compare filtering and smoothing with exact single-observation Gaussian calculations, check zero process variance and missing observations, and reject empty inputs or nonfinite parameters. The [boundary report](/time-series/code/results/boundary-verification.json) records the results.

## Lecture entry points

Each row runs a complete case and writes its metrics. The chapter describes the economic argument, exact conventions, and the relevant functions in the full source. Entry points are intentionally short so the common algorithms remain in one inspectable file per language.

| Lecture | Main executable concepts | Python | R | Julia |
| --- | --- | --- | --- | --- |
| <span id="lecture-01">1</span> | Release clock, geography, naive benchmark | [ch01.py](/time-series/code/ch01.py) | [ch01.R](/time-series/code/ch01.R) | [ch01.jl](/time-series/code/ch01.jl) |
| <span id="lecture-02">2</span> | AR recursion, moments, forecasts, aggregation | [ch02.py](/time-series/code/ch02.py) | [ch02.R](/time-series/code/ch02.R) | [ch02.jl](/time-series/code/ch02.jl) |
| <span id="lecture-03">3</span> | ARMA residuals, ACF/PACF, invertibility, forecasts | [ch03.py](/time-series/code/ch03.py) | [ch03.R](/time-series/code/ch03.R) | [ch03.jl](/time-series/code/ch03.jl) |
| <span id="lecture-04">4</span> | Rolling origins, loss, coverage, Ljung–Box statistic | [ch04.py](/time-series/code/ch04.py) | [ch04.R](/time-series/code/ch04.R) | [ch04.jl](/time-series/code/ch04.jl) |
| <span id="lecture-05">5</span> | Noisy signals, trailing/centered filters, mutation | [ch05.py](/time-series/code/ch05.py) | [ch05.R](/time-series/code/ch05.R) | [ch05.jl](/time-series/code/ch05.jl) |
| <span id="lecture-06">6</span> | Trends, DF/ADF, integration, Monte Carlo error | [ch06.py](/time-series/code/ch06.py) | [ch06.R](/time-series/code/ch06.R) | [ch06.jl](/time-series/code/ch06.jl) |
| <span id="lecture-07">7</span> | Fourier terms, temperature proxies, feasible GLS | [ch07.py](/time-series/code/ch07.py) | [ch07.R](/time-series/code/ch07.R) | [ch07.jl](/time-series/code/ch07.jl) |
| <span id="lecture-08">8</span> | Filter, smoother, missing update, Gaussian likelihood | [ch08.py](/time-series/code/ch08.py) | [ch08.R](/time-series/code/ch08.R) | [ch08.jl](/time-series/code/ch08.jl) |
| <span id="lecture-09">9</span> | VAR fit, eigenvalues, networks, forecast covariance | [ch09.py](/time-series/code/ch09.py) | [ch09.R](/time-series/code/ch09.R) | [ch09.jl](/time-series/code/ch09.jl) |
| <span id="lecture-10">10</span> | Cholesky ordering, rotation, responses | [ch10.py](/time-series/code/ch10.py) | [ch10.R](/time-series/code/ch10.R) | [ch10.jl](/time-series/code/ch10.jl) |
| <span id="lecture-11">11</span> | Common trend, spread, ECM estimation and forecast | [ch11.py](/time-series/code/ch11.py) | [ch11.R](/time-series/code/ch11.R) | [ch11.jl](/time-series/code/ch11.jl) |
| <span id="lecture-12">12</span> | GARCH recursion/grid, risk quantile, scale invariance | [ch12.py](/time-series/code/ch12.py) | [ch12.R](/time-series/code/ch12.R) | [ch12.jl](/time-series/code/ch12.jl) |
| <span id="lecture-13">13</span> | Breaks, windows, paired loss, block/HAC uncertainty | [ch13.py](/time-series/code/ch13.py) | [ch13.R](/time-series/code/ch13.R) | [ch13.jl](/time-series/code/ch13.jl) |
| <span id="lecture-14">14</span> | Validation choice, frozen update, continuation | [ch14.py](/time-series/code/ch14.py) | [ch14.R](/time-series/code/ch14.R) | [ch14.jl](/time-series/code/ch14.jl) |
| <span id="lecture-15">15</span> | Unit/future invariants, boundaries, rank failure | [ch15.py](/time-series/code/ch15.py) | [ch15.R](/time-series/code/ch15.R) | [ch15.jl](/time-series/code/ch15.jl) |

## Project sources and results

[projects.py](/time-series/code/projects.py), [projects.R](/time-series/code/projects.R), and [projects.jl](/time-series/code/projects.jl) implement the complete Build/Audit/Revise case. Read the [specifications and actual results](/time-series/projects/) before interpreting its files.

Download the [forecast table](/time-series/code/results/project-forecasts-python.csv), [freeze record](/time-series/code/results/project-freeze.json), and [project comparison quantities](/time-series/code/results/projects-python.csv). Equivalent R and Julia outputs are included in the bundle and verified row by row. The public example's final benchmark advantage is retained as a substantive result.

## Fixed input files

The [synthetic innovations](/time-series/code/data/innovations.csv) have a [generator and hash record](/time-series/code/data/innovations-manifest.json). All languages read the same 2,048-by-6 file. Monte Carlo paths use the explicitly implemented Park–Miller/Box–Muller algorithm, not three unrelated language-default generators.

The [Texas electricity and temperature extract](/time-series/code/data/texas-electricity.csv) has a [provider and units manifest](/time-series/code/data/texas-manifest.json). The [extraction source](/time-series/code/data/build_extract.py) checks the provider's geographic label, workbook units, unique state-month rows, and month matches. Rebuilding the provider extract needs `openpyxl==3.1.5`; running the course does not.

The provider endpoints can change their latest values. Rebuilding a later extract is a new vintage and should receive a new hash. Do not overwrite the fixed course input and still claim exact reproduction of this edition's reported quantities.

## Source and publication formats

Read the [editable chapter source](https://github.com/ihelfrich/ihelfrich.github.io/tree/main/src/content/time-series), print the [lecture text](/time-series/print/), or download the [PDF book](/time-series/downloads/time-series-econometrics.pdf), which also includes projects, assignments, and references. The [public source archive](/time-series/downloads/time-series-public-source.zip) contains Markdown, code, data, figures, and editable print source. Live assessments, grading keys, private instructor scripts, and graded holdouts are kept in the separate instructor package.

© 2026 Ian Helfrich. All rights reserved. The public availability of the authored book does not grant a blanket redistribution or adaptation license. EIA and NOAA data and third-party sources retain their original terms and attribution.
