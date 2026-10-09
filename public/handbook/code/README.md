# Chapter 1: finite alert–demand worlds

These programs enumerate a controlled teaching model. They do not use sampled utility data or estimate an empirical alert effect. Six background states have integer weights of one. Dividing by total weight gives probability 1/6. Independent alert assignment crosses those backgrounds with A=0 and A=1, producing twelve equal states.

Run from this directory, or pass an absolute script path:

```sh
python alert-worlds.py
julia --startup-file=no alert-worlds.jl
Rscript alert-worlds.R
python verify.py
```

The calculations use Python's standard library, Julia Base, and base R. No external numerical package or internet connection is required. Python 3.14.7, Julia 1.12.7, and R 4.6.1 are the native reference environment; the generated `results/verification.json` records the versions actually executed. Python, R and Julia implement the quantities independently. The verifier executes them concurrently and requires matching metric names, finite values, cross-language agreement, analytic targets, state-by-state invariance, positive assigned-alert loads, and correct MW-to-kW scaling.

`data/manifest.json` describes the input and its SHA256. `results/verification.json` describes the checks. The continuous parameter-family and nonidentification proofs are in the chapter. Numerical checks at five parameter values do not replace those proofs. No Monte Carlo sample, browser language runtime, or live assessment is included.

The figure-generation program `figures.py` uses Matplotlib. It reads the same fixture; Matplotlib is only required when regenerating the scientific figures. The released SVG, PNG, and PDF figures can be viewed without it.

Authored teaching text, examples, code and figures: © 2026 Ian Helfrich, all rights reserved. Public access does not grant a blanket redistribution or adaptation license. Cited books and papers are linked, not included.
