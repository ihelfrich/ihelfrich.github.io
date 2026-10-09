---
title: Defend a forecast in an unfamiliar setting
order: 15
description: Transfer the course's arguments across economic cases using information, unit, stability, and identification audits.
question: Which parts of the argument remain valid when the setting changes?
prerequisites: Lectures 1–14 and an independently reproduced project calculation.
lecture: April 30
concepts: [transfer, invariance, model choice, forecast risk, identification, individual defense]
---

## Begin again with the economic object

An unfamiliar dataset invites familiar software. Resist choosing a model before defining what its output would mean. Ask what decision is being made, which quantity matters, what its units and geography are, when its records become available, and what loss the action creates.

The same observed pattern can support different models under different mechanisms. Persistence can reflect state dynamics, noisy measurement, temporal aggregation, an integrated level, or a shared regional factor. A graph alone does not choose among those explanations. The model's derivation and maintained assumptions make the distinction explicit.

The final exercise asks you to carry that reasoning into a new setting. You may know every formula in the course and still fail the task by using tomorrow's observation today, confusing a flow with a stock, or interpreting a predictive link as an intervention effect. Those errors occur before or after estimation; accurate computation does not neutralize them.

## Use invariants to find errors quickly

An invariant is a relationship that should survive a declared transformation. If a linear forecasting procedure is implemented consistently, rescaling the outcome by $a$ should rescale its level forecasts by $a$. Forecast variances should scale by $a^2$. Dimensionless persistence parameters should remain equivalent under the corresponding model transformation.

If a fixed-origin procedure uses only the admitted past, changing later observations must leave its earlier forecast unchanged. If a reduced-form VAR is reordered and correctly permuted back, it should represent the same reduced-form prediction. Structural Cholesky interpretations can change under ordering because the identifying restriction changes.

These are different invariants. Reduced-form permutation equivalence does not imply structural-ordering invariance. A smoother intentionally fails a past-state future-mutation test because its stated information set includes later observations. Use an invariant that matches the procedure's claim.

Rank failure is another quick diagnostic. A regression with two identical columns cannot uniquely estimate two separate coefficients. Detect the redundancy and change the parameterization before presenting estimates. A numerical solver returning one possible coefficient vector does not create separate identification.

## Return to the forecast-error decomposition

For a stable linear process with known parameters, forecast uncertainty arises from future innovations. For an AR(1), $V_h=\sigma^2\sum_{j=0}^{h-1}\phi^{2j}$. For a random walk, $V_h=h\sigma^2$. For a VAR, $V_h=\sum_{j=0}^{h-1}A^j\Sigma(A^j)'$. For a conditional-volatility process, the relevant variance changes with the information at the origin.

Each formula encodes a different mechanism. A stable univariate process has bounded long-horizon process variance. An integrated process accumulates uncertainty. A vector process carries cross-covariances. A GARCH process uses the latest return surprise to update risk. Recognizing the mechanism matters more than memorizing which package command prints an interval.

Estimation uncertainty, predictor uncertainty, measurement uncertainty, and model selection can add further layers. State which layers your calculation addresses. A simple interval with a precise label can be more useful than an elaborate interval whose information and assumptions are unclear.

## Choose a repair that addresses the finding

Suppose a model's errors are biased upward. A mean or intercept correction can be a candidate repair if the bias is stable and its estimated correction is admissible at future origins. If errors remain serially correlated, a dynamic mean or error model can be considered. If squared errors cluster, investigate conditional variance. If the target definition changes, repair the measurement or redefine the task.

If the audit finds future information in a centered regressor, increasing lag order does not remove it. Replace the regressor construction with an admissible one and reevaluate. If the audit finds an unidentified structural interpretation, improving forecast RMSE does not identify the causal effect. Add credible identifying information or narrow the claim.

If a proposed repair has no reliable benefit on later targets, retaining the existing procedure is an evidence-based action. If an input is unavailable or the target has become incompatible with its history, retirement may be necessary even before another model is ready. A decision should follow the actual failure mode.

## A regional financial example

Imagine monthly lending activity across two regions, a financial spread, and a weather measure. A planner asks whether a shock in one region raises lending risk in the other. The data may support a forecasting question: does the other region's history improve a later risk prediction? They may not support the intervention question without additional identification.

Define lending as a flow or stock, specify how the financial spread is constructed, and align release dates. If a spread combines individually integrated prices, investigate a cointegrating relation rather than assuming its stability. If the risk measure is a volatility forecast, use return or residual units coherently. If weather measures regional exposure, state its spatial weights and transformation order.

A small VAR can summarize joint predictive dynamics. A state-space model can distinguish a latent quantity from a noisy indicator under specified measurement assumptions. A conditional variance model can describe time-varying risk. Combining models does not automatically strengthen the argument: every extra component introduces assumptions and a need for data supporting them.

Choose the smallest procedure that answers the defined task defensibly. The result may be a benchmark plus a well-labeled scenario, not a unified model of every variable. This is a substantive modeling choice rather than a lack of ambition.

## Execute the final audit battery

Run `ch15`. It fits a linear AR forecast on a fixed training prefix, rescales the outcome by 100, and checks that dividing the rescaled forecast by 100 recovers the original. It then changes every later observation by 1,000 and verifies that the earlier forecast does not move.

The code compares the analytic horizon-one and horizon-twelve variances of a random walk with innovation variance one: 1 and 12. A zero-persistence AR has variance one at either horizon. Those boundary values distinguish accumulating innovations from independent level observations.

It deliberately supplies a rank-deficient regression and checks that the implementation reports failure. These checks run in all three languages on identical inputs. A language-specific failure indicates an implementation issue; agreement supplies evidence of consistent conventions. The economic assumptions still require your defense.

Extend the battery to your project. Use a test that can actually fail: mutate future targets, change units, create a missing required input, or reverse an asserted link direction. Predict the result before running. If your supposed invariance fails, identify whether the procedure's claim or the implementation is wrong.

## An individual defense

You should be able to explain the project without beginning with software. State the decision and target. Derive the relevant forecast or variance relation. Identify the admitted information. Explain one calculation in the implementation. State the audit finding and why the repair addresses it. Interpret the continuation result and name the action it justifies.

The defense should preserve uncertainty. “The later sample favors the rolling procedure under squared loss” is stronger and more precise than “rolling models are better.” “The identified response depends on a recursive ordering we can justify through timing” is more defensible than “the graph proves transmission.” “The dataset is a fixed latest vintage” identifies what the historical comparison can claim.

When a new fact arrives, revise the argument ledger rather than rewriting its past entries. A record of changing judgments is useful scientific evidence. It reveals which assumptions survived and which predictions changed the decision.

## Worked unfamiliar case

A forecaster reports next-quarter total regional spending using a monthly average series, a centered economic index, and a normal interval from a constant-variance regression. What should the audit inspect first?

First verify the target's aggregation: a quarterly flow total requires an appropriate sum, not a monthly average relabeled as a total. Then inspect the index's construction and release dates; centering may include future observations. Only after the quantity and information set are correct should the audit interpret the interval's variance assumption and parameter uncertainty.

Suppose the forecast improves after those repairs but the report also claims that a regional policy intervention caused the improvement. A successful predictive repair does not establish that intervention effect. The causal sentence requires its own identification argument. The final action can be to use the repaired forecast while withholding the unsupported causal interpretation.

## What to retain after the course

Keep the derivations, executable examples, and project record as connected tools. The formulas explain what the code should compute. The code makes implications reproducible. Deliberate counterexamples identify the limits of an argument. Later outcomes determine whether a procedure remains useful for its decision.

Keep a project record that another analyst could follow: what you knew, what you predicted, what went wrong, and what you changed. When you revisit the work, that record should explain the decision as clearly as the code reproduces the calculation.

The public practice materials support independent study. Live assessments and grading keys are retained separately by the instructor. The final assessment asks for the same transferable reasoning developed here: a coherent target, an admissible forecast, a correct calculation, an investigated failure, and a defensible action.

## Further reading

The [ASA GAISE College Report](https://www.amstat.org/docs/default-source/amstat-documents/gaisecollege_full.pdf) supports contextual investigation and active learning. [QuantEcon](https://quantecon.org/) provides a model of executable quantitative teaching. The [book's methods record](/time-series/methods/) documents its teaching references, numerical checks, and data sources.
