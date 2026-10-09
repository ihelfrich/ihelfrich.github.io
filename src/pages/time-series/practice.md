---
layout: ../../layouts/TimeSeriesText.astro
title: Practice with worked answers
description: Fifteen problem sets and an applied practice examination, with calculations, diagnoses, and explanations.
---

## How to use these assignments

Attempt a calculation and an explanation before opening its answer. In a later session, change a parameter or setting and solve again from memory. The suggested short sessions are preparation, not graded completion requirements. Use the [chapter sources](/time-series/code/) to reproduce the executable examples in one language; use the parity suite when comparing implementations.

Each assignment has three tasks. Choose a pair for a 10–12-minute practice session and return to the remaining task later. The worked answers explain the argument and its limits. Live competency forms, retakes, and exam keys are separate private instructor materials.

## Assignment 1: Quantity, clock, and geography

1. March sales are released May 10. A forecast is issued April 30. Can it admit March sales? Identify the date comparison that decides.
2. Two areas have temperatures 30 and 90°F and weights 0.75 and 0.25. Compute heating exposure relative to 65°F by transforming the weighted mean and by weighting transformed temperatures.
3. A dataset contains monthly spending flows and month-end debt stocks. Define meaningful quarterly aggregates of both.

<details><summary>Worked answer</summary>

The March record is unavailable on April 30 because May 10 follows the origin. Its March period label does not override the release date. A real-time reconstruction requires the record available at April 30; a latest-vintage retrospective analysis should be labeled accordingly.

Weighted temperature is $0.75(30)+0.25(90)=45$. Transforming it gives $65-45=20$. Local transformations give 35 and zero, so their weighted value is $0.75(35)=26.25$. The positive-part transformation is convex; aggregating before transforming loses exposure variation.

Sum monthly spending flows to obtain quarterly spending. For debt, use a defined quarter-end stock or an average stock if that is the question. Summing three month-end stocks double-counts continuing debt positions and changes the quantity's interpretation.

</details>

## Assignment 2: Recursion and uncertainty

1. An AR(1) has $c=2$, $\phi=0.75$, innovation variance 4, and current value 12. Find its mean, two-step forecast, and known-parameter two-step error variance.
2. Describe the response to a positive shock when $\phi=-0.5$. Does its variance alternate in sign?
3. Explain why quarterly averages do not generally inherit persistence $\phi^3$ from a monthly AR(1).

<details><summary>Worked answer</summary>

Mean is $2/(1-0.75)=8$. The forecast is $8+0.75^2(12-8)=10.25$. Error variance is $4(1+0.75^2)=6.25$, giving standard deviation 2.5. This excludes estimation uncertainty and relies on the specified innovation assumptions.

The response alternates in sign and halves in magnitude each period. After a unit shock, the sequence is

$$1,-0.5,0.25,-0.125,\ldots.$$

Variance remains nonnegative because it uses squared response coefficients.

Quarterly averages combine three correlated monthly states. Their adjacent-quarter covariance includes nine pairwise distances, not only a three-period lag. Sampling the quarter's last month is different from averaging the quarter. Use the covariance sums in Lecture 2 to calculate the appropriate aggregate correlation.

</details>

## Assignment 3: Recoverable shocks

1. An MA(1) has coefficient 0.25 and innovation variance 16. Find its variance, lag-one covariance, and lag-one correlation.
2. Construct its reciprocal-root covariance-equivalent representation and identify which is invertible.
3. What happens to an ARMA(1,1) when $\theta=-\phi$? Why can a larger model be misleading in that case?

<details><summary>Worked answer</summary>

Variance is $16(1+0.25^2)=17$; lag-one covariance is $16(0.25)=4$; correlation is $4/17$. Later positive-lag covariances are zero under the white-noise assumptions.

The reciprocal coefficient is 4 and innovation variance is 1. Its variance is $1(1+16)=17$ and lag-one covariance is 4. The coefficient 0.25 representation is invertible; the coefficient 4 representation is not. Equality of covariance functions supplies a second-order equivalence, with stronger distributional equivalence under appropriate Gaussian assumptions.

The AR and MA lag polynomials cancel, leaving white noise apart from initialization conventions. The redundant parameters can appear to offer flexibility without identifying separate mechanisms. Inspect common factors and simplify the representation.

</details>

## Assignment 4: Evaluation and action

1. A forecast issued at $t$ targets $t+3$. A regressor describes $t+1$ and is released at $t+2$. Is it admissible at the origin?
2. Underprediction costs three units per unit error; overprediction costs one. Which conditional quantile minimizes expected cost?
3. Two methods' squared losses are $(1,9,4)$ and $(4,4,9)$ on identical targets. Compute their paired average difference and describe the limitation of the comparison.

<details><summary>Worked answer</summary>

The regressor is inadmissible at $t$ because both its described period and release follow the origin. A separately forecast or scenario value could be used with a clear label and appropriate uncertainty treatment.

The optimum satisfies $F(a)=3/(3+1)=0.75$. A conditional-mean forecast is not automatically the cost-minimizing action under this asymmetric loss.

Paired differences are $(-3,5,-5)$, averaging $-1$. The first method has lower mean squared loss on these three targets. The second target reverses the ranking, and three observations provide weak evidence of general performance. Dependence and target representativeness also matter.

</details>

## Assignment 5: Measurement and filtering

1. A latent AR(1) has persistence 0.6 and innovation variance 0.64. Independent observation noise has variance 3. Find the observed lag-one correlation.
2. A centered five-period average at $t$ includes two future records. Both increase by 30. How much does the historical average change?
3. A noiseless state rises three units per period. What bias relative to the current state does a trailing three-period mean have?

<details><summary>Worked answer</summary>

The latent variance is $0.64/(1-0.36)=1$, and its lag-one covariance is 0.6. Observed variance is $1+3=4$, so observed correlation is 0.15. The lower correlation need not imply low latent persistence.

The centered value increases by $(30+30)/5=12$. A fixed-parameter trailing filter using only dates through $t$ would be unchanged. A full-sample parameter refit can introduce another source of future dependence and must be audited separately.

The trailing mean averages states at $t,t-1,t-2$, so its expected level is the state at $t-1$. It is three units below the current state. Noise reduction and timely state estimation are different objectives.

</details>

## Assignment 6: Trends and testing

1. A random walk has current value 40, drift 1, and innovation variance 2. Find its five-step forecast and process-error variance.
2. Difference a stationary white-noise series with variance 2. Find the new variance and lag-one correlation.
3. An intercept DF statistic is $-2.4$, compared with a declared threshold $-2.86$. Interpret the result without claiming proof of a unit root.

<details><summary>Worked answer</summary>

Forecast is $40+5=45$ and variance is $5(2)=10$. A shock permanently affects the level; a fitted deterministic trend does not remove the accumulated innovation path.

Differencing gives an MA(1) with coefficient $-1$. Variance is 4 and lag-one covariance is $-2$, so correlation is $-0.5$. The added dependence is a reason to investigate over-differencing.

The statistic does not cross the stated rejection threshold. This is non-rejection under that specification, not proof of a unit root. Lag choice, deterministic terms, breaks, and near-unit alternatives affect interpretation. The usual normal cutoff is not the DF reference.

</details>

## Assignment 7: Dynamic regression

1. Let $Y_t=5+2X_t+\eta_t$ and error persistence be 0.4. With $(Y_t,Y_{t-1})=(14,9)$ and $(X_t,X_{t-1})=(5,2)$, calculate the transformed outcome, predictor, intercept, and innovation.
2. The latest error state is 2, its persistence 0.4, and next period's regression component is 20. Find the one-step scenario forecast.
3. Explain why actual future temperature and a future month indicator have different availability status.

<details><summary>Worked answer</summary>

Transformed outcome is $14-0.4(9)=10.4$; predictor is $5-0.4(2)=4.2$; intercept is $5(1-0.4)=3$. The transformed regression component is $3+2(4.2)=11.4$, leaving innovation $-1$. Transforming only the outcome and predictor while leaving the intercept unchanged misparameterizes the equation.

The forecast is $20+0.4(2)=20.8$. It conditions on the supplied regression inputs. If those inputs include uncertain future weather, their forecast or scenario construction and uncertainty must be stated.

A calendar month is known before it occurs. Actual weather is not. A climate expectation, weather forecast, or scenario can be admissible if constructed from information available at the origin.

</details>

## Assignment 8: State updates

1. Prior state mean is 8, variance 3, observation variance 6, and observation 14. Find the gain, posterior mean, and variance.
2. What is the update if that observation is missing? Why is inserting zero wrong?
3. Explain why a retrospective smoother can improve state RMSE while being inadmissible for an earlier real-time decision.

<details><summary>Worked answer</summary>

Gain is $3/(3+6)=1/3$. Innovation is 6, so posterior mean is 10 and posterior variance is $(1-1/3)3=2$. Mean units and squared variance units remain distinct.

After the prediction step, retain prior mean 8 and variance 3. Inserting zero would treat absence as a real zero-valued measurement and pull the estimate toward it. Missingness may itself require a more complex model if it is informative.

The smoother conditions on observations after the historical date. Those observations can refine a past-state estimate but were unavailable at the original decision. Filtered and smoothed outputs answer different information-set questions.

</details>

## Assignment 9: Systems and networks

1. A zero-intercept VAR has $A=\begin{pmatrix}0.4&0.3\\0.2&0.6\end{pmatrix}$ and current vector $(10,5)'$. Compute its first two forecasts.
2. A matrix has diagonal entries 0.7 and both off-diagonal entries 0.4. Are the diagonals sufficient to establish stability?
3. With one-step covariance $\begin{pmatrix}4&1\\1&9\end{pmatrix}$, find error variance for the sum of the two outcomes.

<details><summary>Worked answer</summary>

One-step forecast is $(5.5,5)'$. Multiplying again gives $(3.7,4.1)'$. In this column-vector convention, a row of $A$ maps source histories into one destination's prediction.

The matrix's eigenvalues are 1.1 and 0.3, so the system is unstable despite both diagonal entries being below one. Stability concerns the joint feedback system.

Variance of the sum is $4+9+2(1)=15$. Ignoring contemporaneous covariance understates risk here. A known network and a covariance matrix supply different information; neither by itself identifies an intervention.

</details>

## Assignment 10: Shock identification

1. Factor $\Sigma=\begin{pmatrix}1&0.6\\0.6&1.36\end{pmatrix}$ into a lower-triangular $LL'$.
2. Multiply the factor by a 90-degree orthogonal rotation. Does covariance change? Does the first shock's interpretation remain the same?
3. A VAR response has a narrow sampling band. What does that establish about its recursive ordering?

<details><summary>Worked answer</summary>

The factor is $L=\begin{pmatrix}1&0\\0.6&1\end{pmatrix}$. Its product with its transpose gives the stated covariance. The zero imposes a recursive immediate exclusion.

With $Q=\begin{pmatrix}0&-1\\1&0\end{pmatrix}$, $LQ=\begin{pmatrix}0&-1\\1&-0.6\end{pmatrix}$. Covariance is unchanged because $QQ'=I$. The first shock's impact pattern changes, so covariance has not uniquely identified its economic meaning.

A sampling band describes estimation variation under maintained identification and other assumptions. Its narrowness does not establish that the ordering is economically correct. Examine credible alternative restrictions and the claim's sensitivity.

</details>

## Assignment 11: Error correction

1. A relation is $Y=1.5X$. Current values are $Y_t=100$ and $X_t=60$, adjustment coefficient is $-0.2$, expected $\Delta X$ is 2, and its short-run coefficient is 1.5. Forecast the next change and level of $Y$.
2. In the simple spread model, is adjustment coefficient $-3$ stable merely because it is negative?
3. Why does a DF test applied to an estimated cointegrating residual need an appropriate residual-based reference distribution?

<details><summary>Worked answer</summary>

The spread is $100-1.5(60)=10$. Predicted change is $-0.2(10)+1.5(2)=1$, so the next predicted level is 101. The equilibrium relation, adjustment coefficient, and input forecast each have a separate role.

In the simple constructed spread, persistence is $1+\alpha=-2$, so $\alpha=-3$ implies explosive alternating deviations. Stability requires $-2<\alpha<0$ in that model. A general multivariate system requires its own joint stability check.

The residual incorporates estimated long-run parameters, altering the null distribution. An ordinary observed-series DF threshold does not automatically apply. The specification's deterministic terms and dimensions must also be retained.

</details>

## Assignment 12: Conditional risk

1. GARCH parameters are $\omega=0.1$, $\alpha=0.2$, and $\beta=0.7$. Current variance is 1.5 and residual is 2 percentage points. Find next variance and the following variance forecast.
2. Convert the model to decimal-return units.
3. Can the variance forecast alone determine a 5% return quantile?

<details><summary>Worked answer</summary>

Next variance is $0.1+0.2(4)+0.7(1.5)=1.95$. Long-run variance is $0.1/(1-0.9)=1$. The following variance forecast is $1+0.9(1.95-1)=1.855$.

Divide residuals by 100 and variances and $\omega$ by 10,000. Thus next variance is 0.000195 and $\omega$ is 0.00001; $\alpha$ and $\beta$ remain unchanged. Quantiles and standard deviations divide by 100.

The quantile also needs a conditional mean and standardized-shock distribution. Under zero-mean Gaussian shocks, it is approximately $-1.645\sqrt{1.95}$ percentage points. A heavy-tailed distribution can produce a different threshold with the same conditional variance.

</details>

## Assignment 13: Change and retirement

1. A rolling procedure's squared losses are $(4,1,9)$ and an expanding procedure's are $(1,4,4)$ on identical targets. Find the paired mean difference.
2. Explain a condition under which a shorter window helps and a condition under which it can hurt.
3. A repair reduces expected monthly decision cost by two units but costs six units monthly to operate. What additional evidence or rationale would justify replacement?

<details><summary>Worked answer</summary>

Differences are $(3,-3,5)$, averaging $5/3$. The rolling procedure is worse on average over these targets, even though it wins on the second. Window choice should not be based on a generic claim that recency is always better.

A shorter window can reduce contamination from an obsolete regime after a break. In a stable process it discards relevant information and can increase estimation variation. Measurement changes can also resemble breaks and require a different repair.

Under the simple stated cost accounting, replacement loses four units per month. A justification would require additional benefits, a different risk objective, or evidence that the cost estimates are incomplete. A small RMSE improvement alone does not establish operational value.

</details>

## Assignment 14: Freeze and continue

1. Candidate validation losses are $(1.4,1.1,1.2)$; continuation losses are $(1.0,1.6,0.9)$. What continuation loss did the declared minimum-validation rule achieve?
2. Can a frozen rolling procedure refit coefficients as new observations arrive?
3. How should an origin on which the model fails enter the comparison?

<details><summary>Worked answer</summary>

Validation selects the second method, whose continuation loss is 1.6. Reporting 0.9 would substitute a method selected using continuation outcomes. That is a retrospective selection result, not the original rule's result.

Yes, if the refitting schedule and admitted information were part of the frozen algorithm. Freezing the procedure is different from fixing every fitted parameter. Changing the window based on continuation errors is a new selection.

Use the declared fallback or abstention rule and retain a failure flag. Dropping the row changes the target set and can inflate performance. Operational reliability is part of the evaluated procedure.

</details>

## Assignment 15: Transfer and defense

1. A linear forecast is 12 and its process variance is 9. Rescale the outcome by 100. What should the equivalent forecast and variance be?
2. A regional VAR improves prediction, and its report claims a policy intervention caused the improvement. What is missing?
3. Put these audit tasks in a defensible order: interval interpretation, target definition, predictor availability, numerical implementation.

<details><summary>Worked answer</summary>

The forecast should be 1,200 and variance 90,000. Scale means by 100 and squared quantities by 10,000. If a consistent implementation violates this relationship, investigate transformations and units.

Predictive improvement does not identify an intervention effect. The report needs a credible identification strategy with assumptions and supporting evidence, or it must narrow the causal claim while retaining the useful predictive result.

Define the target first, verify admissible information, then audit computation and interpret uncertainty under the correct model. An exact interval for a misdefined quantity or infeasible forecast does not answer the intended decision.

</details>

## Applied practice examination

Work independently before reading the answer. This public examination illustrates the reasoning blueprint; it is not a live exam form. The live final's assigned date, duration, and permitted resources are supplied by the instructor for the official examination period.

A regional agency must choose next month's reserve for residential electricity demand. The dataset contains monthly sales, average temperature, and a regional activity index. Sales records arrive with an assumed two-month lag. The activity index is a centered five-month average. A forecaster uses the latest downloaded vintage to report historical forecasts. A seasonal naive benchmark and a calendar regression are evaluated on the same twelve continuation months.

The regression was selected on a preceding two-year repair segment and its update rule was frozen before continuation outcomes were examined. It refits using only admitted observations. The benchmark's continuation RMSE is 0.90 million MWh and the regression's is 0.92. The regression's normal interval covers 8 of 12 targets. The report also presents a Cholesky VAR response as proof that demand shocks transmit causally from one region to another.

1. **Reasoning through the case, 4 points.** Define the target and admissible training endpoint at an origin. Diagnose the centered index. Explain the selection-continuation boundary and recommend a forecasting action supported by the comparison.
2. **Assumptions and limitations, 3 points.** Identify the vintage limitation, explain what the normal interval assumes and omits, and critique the structural claim's identification.
3. **Interpretation and decision, 3 points.** Explain the size and limits of the loss difference, propose a repair or further evaluation tied to an actual finding, and state what later evidence would change your action.

<details><summary>Worked examination answer and point descriptions</summary>

The target is next month's residential sales in a specified region, measured in million MWh. At an end-of-month origin, the assumed sales lag makes the last admitted observation two months older than the origin. A recursion using that latest level must forecast three periods to reach the next-month target. The centered activity index is unavailable at its historical date because it includes two later observations. Replace it with an admissible construction or explicitly treat it as retrospective evidence; then reevaluate the affected procedure.

The selected regression's window and update rule were frozen using the repair period, so its later refits can be admissible. The twelve continuation outcomes evaluate that retained rule. Reselecting using those outcomes would create a new exploratory procedure. The benchmark has slightly lower realized RMSE, and the small sample does not establish durable superiority. Retaining the benchmark as the main rule is defensible while evaluating a repaired regression on a new boundary.

The latest downloaded vintage does not reconstruct every historical release. The comparison is pseudo-out-of-sample unless historical vintages are supplied. A Gaussian interval assumes the specified conditional distribution and variance treatment; a simple plug-in interval may omit parameter, predictor, selection, and measurement uncertainty. Coverage 8/12 is about 66.7%, which warrants investigation, but a short and possibly dependent target sequence limits formal conclusions.

Cholesky factorization reproduces residual covariance under an ordering restriction. It does not establish that the restriction correctly identifies a regional intervention. State the recursive immediate exclusions, examine credible alternatives, and narrow the causal claim unless additional identifying evidence supports it.

A repair should address the actual issue: remove future information from the index, improve the justified uncertainty calculation, and preserve the benchmark and target definition. Freeze the revised algorithm before evaluating another continuation segment. Reconsider the recommendation if later matched losses show economically meaningful and reliable improvement, if the benchmark becomes infeasible, or if the target's measurement changes.

For the 4 reasoning points, full-credit evidence correctly defines the clock, diagnoses the centered input, preserves selection boundaries, and recommends an evidence-supported action. For the 3 assumption points, full-credit evidence explains vintages, interval scope, and identification. For the 3 interpretation points, it interprets the actual comparison, proposes a targeted repair, and states reconsideration evidence. A minor arithmetic slip need not erase otherwise coherent reasoning; a consequential information or identification error affects the criterion it undermines.

</details>

## Competency practice and reassessment

The six competencies cover dynamics and stationarity; forecast evaluation; trends and unit roots; multivariate dynamics and identification; long-run relations; and volatility and instability. Checks require a calculation or diagnosis and a brief explanation. Initial and equivalent reassessment forms have comparable scope with changed parameters, representations, or cases.

Each contributes up to five course points: insufficient assessable evidence earns 0; relevant partial understanding with a consequential gap earns 2.5; independently meeting every essential requirement earns 5. A further boundary insight receives descriptive feedback and the same maximum 5. The higher independently verified level counts after the one scheduled reassessment. Practice completion is not a prerequisite for attempting graded work.

Use the assignments to prepare a gap note after feedback: identify what was missing, explain the correction, and solve a changed example. The note guides preparation and earns no separate points. The final exam has no retake; project revision and competency reassessment remain separate opportunities described in the course syllabus.
