---
layout: ../../layouts/TimeSeriesText.astro
title: References and teaching methods
description: The mathematical foundations, related teaching approaches, original course design, and verification record.
---

## Teaching approach

This book organizes time-series econometrics around a continuing economic decision. Each lecture joins a mathematical derivation to executable implications, an explicit information clock, a deliberate failure case, and a repair that must be defended. The three projects carry one procedure through construction, independent audit, and a frozen later test.

Students keep a record of their predictions and assumptions before outcomes are revealed. In the forecast room, they record a decision, see the outcome, and explain whether the evidence changes their view. Earlier entries remain in the record. Independent R, Julia, and Python implementations provide another check: do the same inputs and conventions produce the same quantities and forecast rows?

The course draws on established econometric methods and the teaching approaches below. Its examples connect measurement choices, mathematical arguments, code, and later evidence across one semester.

## Teaching references

**Executable quantitative education.** [QuantEcon](https://quantecon.org/) publishes quantitative lectures and code, including linear state-space and ARMA material. [Jupyter Book](https://jupyterbook.org/stable/) supports computational books. [Forecasting: Principles and Practice](https://otexts.com/fpp3/) connects methods to practical forecasting. Here, the laboratories let students reproduce a result, change an assumption, and examine the consequences.

**Learning through cases and active investigation.** The [ASA GAISE College Report](https://www.amstat.org/docs/default-source/amstat-documents/gaisecollege_full.pdf) recommends contextual investigation and active learning. Research on [explaining across contrasting cases](https://aaalab.stanford.edu/papers/Explaining-across-contrasting-cases-for-deep-understanding-in-science-an-example-using-interactive-simulations.pdf) motivates comparing examples that differ in a consequential feature. The book implements that principle through admissible versus centered filters, alternative covariance factors, stable versus changed regimes, and selected versus untouched evaluation periods. These contrasts expose assumptions that a single successful example can conceal.

**Documentation and model accountability.** [Model Cards for Model Reporting](https://arxiv.org/abs/1810.03993) motivates explicit reporting of model uses and limitations. A course forecast specification records the economic target, release rule, update procedure, loss, fallback, code version, and data hash. That record makes it possible to reconstruct an earlier forecast and explain why a later decision changed.

The references explain the design choices; evaluating their effect on student learning will require classroom evidence.

## Mathematical foundations

| Topic | Primary or author-maintained source | Role in the course |
| --- | --- | --- |
| Linear stochastic systems | [QuantEcon: Linear State Space Models](https://python.quantecon.org/linear_models.html) | State representations, prediction, and measurement |
| Covariance-stationary processes | [QuantEcon: ARMA](https://python-advanced.quantecon.org/arma.html) | Time-domain representations and covariance behavior |
| Graduate texts | [Hamilton (1994)](https://press.princeton.edu/books/hardcover/9780691042893/time-series-analysis); [Kilian and Lütkepohl (2017)](https://doi.org/10.1017/9781108164818) | Standard treatments of the course's models and of structural VARs |
| Unit-root distributions | [Dickey and Fuller (1979)](https://www.tandfonline.com/doi/abs/10.1080/01621459.1979.10482531); [Kwiatkowski, Phillips, Schmidt, and Shin (1992)](https://doi.org/10.1016/0304-4076(92)90104-Y) | Nonstandard testing reference and the stationarity null |
| Spurious regression | [Granger and Newbold (1974)](https://doi.org/10.1016/0304-4076(74)90034-7); [Phillips (1986)](https://doi.org/10.1016/0304-4076(86)90001-1) | Levels regressions of independent integrated series |
| Model selection | [Akaike (1974)](https://doi.org/10.1109/TAC.1974.1100705); [Schwarz (1978)](https://doi.org/10.1214/aos/1176344136) | Information criteria for lag order |
| Forecast comparison | [Diebold and Mariano (1995)](https://doi.org/10.1080/07350015.1995.10524599); [West (1996)](https://doi.org/10.2307/2171956); [Clark and McCracken (2001)](https://doi.org/10.1016/S0304-4076(01)00071-9); [Giacomini and White (2006)](https://doi.org/10.1111/j.1468-0262.2006.00718.x) | Paired-loss inference, estimated and nested models |
| Multivariate dynamics | [Sims (1980)](https://www.jstor.org/stable/1912017); [Granger (1969)](https://doi.org/10.2307/1912791) | VARs, economic restrictions, and predictive causality |
| Impulse responses | [Jordà (2005)](https://doi.org/10.1257/0002828053828518); [Plagborg-Møller and Wolf (2021)](https://doi.org/10.3982/ECTA17813) | Local projections and their relation to VAR responses |
| Cointegration | [Engle and Granger (1987)](https://www.jstor.org/stable/1913236) | Shared trends and error correction |
| State estimation | [Kalman (1960)](https://asmedigitalcollection.asme.org/fluidsengineering/article/82/1/35/397706/A-New-Approach-to-Linear-Filtering-and-Prediction) | Prediction and observation updates |
| Conditional volatility | [Bollerslev (1986)](https://www.sciencedirect.com/science/article/pii/0304407686900631) | GARCH variance dynamics |
| Temperature and demand | [Chang, Kim, Miller, Park, and Park (2016)](https://www.sciencedirect.com/science/article/abs/pii/S0140988316302602) | Motivation for preserving high-frequency exposure information |

The temperature paper's published title is *A new approach to modeling the effects of temperature fluctuations on monthly electricity demand*, in *Energy Economics* 60, 206–216, DOI [10.1016/j.eneco.2016.09.016](https://doi.org/10.1016/j.eneco.2016.09.016). The core course uses a simpler piecewise-response model; it does not claim to reproduce the functional estimator.

Software documentation is used to check conventions: [Statsmodels VAR](https://www.statsmodels.org/stable/vector_ar.html), [VECM deterministic terms](https://www.statsmodels.org/stable/generated/statsmodels.tsa.vector_ar.vecm.VECM.html), [impulse-response covariance factors](https://www.statsmodels.org/stable/generated/statsmodels.tsa.vector_ar.var_model.VARResults.irf.html), and [arch volatility components](https://arch.readthedocs.io/en/latest/univariate/univariate_volatility_modeling.html). The reference laboratories implement the calculations directly in the supplied course files.

## Numerical verification

The [verification report](/time-series/code/results/verification.json) documents concurrent R, Julia, and Python runs. Independent implementations use the same fixed inputs and conventions. Analytic checks cover moments, forecast variances, degree-day transformation order, optimal loss quantiles, unit invariance, covariance reconstruction, and admissible parameter domains. Future-mutation tests expose information use. Every project forecast is compared across languages with its origin and target dates retained.

Monte Carlo unit-root and spurious-regression examples use three sample sizes and 2,000 replications per design, drawn from one Park–Miller stream split into consecutive blocks, with simulation standard errors reported. A separate script repeats the designs with 200,000 replications from NumPy's generator as a reference. Their rates are finite-sample estimates under the declared Gaussian random-walk design. They do not calibrate arbitrary empirical tests. The ARMA and GARCH laboratories use coarse grids to expose the objective and parameter restrictions; they do not provide standard errors or replace a continuous optimizer.

Several results complicate the expected story. The baseline independent random walks have little level correlation on their particular realization, although the nominal 5% levels $t$ test rejects for 75 to 91 percent of simulated pairs. The GARCH grid selects a different parameter triple from the one used to generate the data. The repaired electricity model loses narrowly to seasonal naive on continuation data, and those data are preliminary values whose revision could reverse the ranking. Students must explain those results as well as the cases in which a model improves the forecast.

## Data provenance and limits

[EIA-861M](https://www.eia.gov/electricity/data/eia861m/) supplies the fixed Texas residential electricity series. [NOAA Climate at a Glance](https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/statewide/time-series) supplies monthly statewide temperature. The extraction checks actual geographic labels and units, unique observations, and matched periods. Its [manifest](/time-series/code/data/texas-manifest.json) retains hashes and the fixed-vintage limitation.

In the downloaded vintage, EIA marks the 2025 months as preliminary and every earlier month as final, so the continuation targets are preliminary values. The assumed two-month release lag is instructional. The extracted history does not reconstruct provider-specific historical releases. The analysis is pseudo-out-of-sample on one downloaded vintage. Monthly-temperature transforms are exposure proxies, not direct measurements of within-month daily degree-day totals. A synthetic network is labeled a teaching graph and is not presented as an observed transmission system.

## Edition, rights, and corrections

The first edition is dated October 2026. Its dates follow a model fifteen-week calendar for planning a semester. The downloadable source is editable; live assessments and grading keys are maintained separately.

Correction record, October 2026: the Lecture 6 laboratory previously seeded Monte Carlo replication $i$ with $515+i$. Because the generator is multiplicative, consecutive seeds gave nearly equal first draws, and the reported DF rejection rates of 0.070, 0.035, and 0.035 from 200 replications did not describe independent random walks. The laboratory now draws 2,000 replications from one stream, and the verification suite checks the spread of the first draws.

For a correction, identify the page, equation or source function, input conditions, and the result you obtain. A useful issue includes a reproducible counterexample and its implication for the text. [Source repository](https://github.com/ihelfrich/ihelfrich.github.io/tree/main/src/content/time-series). Copyright © 2026 Ian Helfrich; all rights reserved. Provider data and cited works retain their own terms.
