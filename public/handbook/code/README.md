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


# Chapter 2: measurement, calibration, and denominators

Run the independent standard-library implementations and verifier:

```sh
python measurement.py
julia --startup-file=no measurement.jl
Rscript measurement.R
python verify-measurement.py
```

The 36-row `data/meter-states.csv` fixture crosses true energy, two independent meter-noise multipliers, and an independent billing perturbation. `data/measurement-manifest.json` specifies units, probabilities, calibration/noise settings and the separate controlled denominator examples. `data/measurement-dictionary.csv` records the fields' meanings and support. These are invented teaching records, not observed tariffs or actual meter tests.

The verifier matches 301 independently computed quantities, 189 analytic targets, and 108 row identities at three noise amplitudes and three calibrations. It checks classical attenuation, a repeated-reading covariance ratio, the failure of a copied reading or shared calibration, projection and conditional-mean risks, averaging, MWh-to-kWh scaling, ratio growth, and weighted aggregation. `results/measurement-verification.json` records native versions and tolerances; `results/measurement-reference.json` contains all checked population quantities. No Monte Carlo draws or finite-sample unbiasedness claims are involved.

`measurement-figures.py` uses Matplotlib to regenerate the original web and vector print diagrams. Browser controls enumerate the declared model in JavaScript; they do not run Python, Julia or R. The manuscript supplies the proofs and restrictions that give these numerical results their interpretation.
