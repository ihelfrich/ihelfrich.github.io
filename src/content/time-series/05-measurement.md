---
title: Signals, noisy measures, and information-preserving filters
order: 5
description: Separate latent economic quantities from their observed indicators and distinguish real-time filters from retrospective smoothers.
question: Does a cleaner-looking series preserve the information available at the decision date?
prerequisites: Lectures 1–4, covariance, conditional expectation, and weighted averages.
lecture: February 12
concepts: [latent quantities, measurement error, filtering, centered averages, composition, revisions]
---

## The economic quantity and its indicator

Suppose $S_t$ is an economic quantity of interest and the recorded indicator is

$$
Y_t=S_t+\nu_t.
$$

The measurement disturbance $\nu_t$ may represent reporting noise, sampling variation, a changing collection instrument, or an imperfect operational definition. Calling it measurement error does not imply it is independent of $S_t$, independent over time, mean zero, or constant in variance. Each of those is an additional assumption.

Under the elementary assumptions of zero-mean noise independent of the signal, $\operatorname{Var}(Y_t)=\operatorname{Var}(S_t)+\operatorname{Var}(\nu_t)$. If noise is also independent across dates, positive-lag covariance of $Y$ equals that of $S$, while the lag-zero variance is larger. Consequently observed autocorrelations are attenuated toward zero:

$$
\rho_Y(k)=\rho_S(k)\frac{\operatorname{Var}(S_t)}{\operatorname{Var}(S_t)+\operatorname{Var}(\nu_t)},\qquad k>0.
$$

A less persistent observed indicator can therefore measure a persistent latent quantity noisily. That explanation competes with a genuinely less persistent underlying process. One noisy indicator alone may not identify both components without additional structure.

## Averaging trades noise reduction against responsiveness

Consider a trailing three-period average,

$$
\widetilde Y_t=\frac{Y_t+Y_{t-1}+Y_{t-2}}3.
$$

If the measurement disturbances are independent with variance $r$, their average contributes $r/3$ to this filtered measure's variance. But the signal component becomes $(S_t+S_{t-1}+S_{t-2})/3$, which is not generally equal to $S_t$. Noise reduction is purchased by averaging across potentially changing states.

For a deterministic ramp $S_t=a+bt$, the trailing average is $a+b(t-1)$. It lags the current state by $b$. For a sudden jump, it adjusts over three observations. A lower variance does not establish a better estimate of the current quantity when responsiveness matters to the decision.

Serially correlated measurement disturbances reduce the noise benefit. In general,

$$
\operatorname{Var}\left(\frac{\nu_t+\nu_{t-1}+\nu_{t-2}}3\right)
=\frac{3r+4\gamma_\nu(1)+2\gamma_\nu(2)}9.
$$

The same covariance counting used for temporal aggregation applies. With perfectly persistent noise, averaging does not eliminate it. If a reporting instrument changes, the filtered series can blur a measurement break into an apparent economic transition.

## Filtering and smoothing use different information

A filter estimates a current or past state using information available up to its stated decision date. A smoother estimates a historical state using observations after that historical date. Both can be useful. Their outputs answer different questions.

A centered five-period moving average is

$$
\overline Y_t=\frac{Y_{t-2}+Y_{t-1}+Y_t+Y_{t+1}+Y_{t+2}}5.
$$

It uses two future observations. It may describe a historical pattern more symmetrically than a trailing average, but it was unavailable at date $t$. At the end of a sample, the centered measure cannot be computed without padding, extrapolation, or shortening the window. Each choice changes the endpoint behavior.

The distinction becomes especially important when constructing regressors. If a forecasting model uses the centered measure at the historical origin, it imports future outcomes through preprocessing. The regression formula may contain only variables labeled $t$; the information violation is hidden inside their construction.

Seasonal adjustment and benchmark revisions can have similar effects. A series released as a current indicator can be revised after future observations arrive. The latest adjusted history is useful for retrospective analysis but may not be the measure available to an earlier forecaster. Preserve the vintage or qualify the experiment.

## A future-mutation test

An algorithm producing $\widehat S_{t|t}$ should satisfy a useful implementation invariant: replacing observations after $t$ must not change that output, when its fitted parameters and past information are held fixed. Formally, if two datasets agree through $t$, an admissible fixed-parameter filter gives the same value at $t$ on both.

This condition is necessary for the asserted information restriction. It is not sufficient for a good estimator. A constant forecast passes the mutation test while potentially wasting nearly all available information. A procedure may also leak through full-sample estimated parameters even if its final filtering recursion is one-sided. Audit both parameter fitting and state updating.

In the laboratory, a latent AR(1) signal is observed with independent noise. We calculate a trailing three-period mean and a centered five-period mean. Then we add 100 to every observation after index 120. The trailing value at 120 changes by zero. The centered value changes by 40, because two of its five inputs have increased by 100.

The exact 40-unit change is an arithmetic diagnostic of future dependence. It does not rely on a significance test. The two filters have different window lengths, so their noise performance should not be treated as a controlled comparison of centering alone. The experiment's primary purpose is to expose their information sets. For a controlled comparison of window placement, use equal-length trailing and centered windows and retain the same output target.

## Measurement composition can resemble a dynamic change

Let $Y_t=\sum_i w_{i,t}X_{i,t}$. Between dates,

$$
Y_t-Y_{t-1}
=\sum_iw_{i,t-1}(X_{i,t}-X_{i,t-1})
+\sum_i(w_{i,t}-w_{i,t-1})X_{i,t}.
$$

The first term reflects within-unit changes using previous weights. The second reflects changing composition evaluated at current values. This decomposition is an accounting identity; it assigns the interaction term according to the chosen timing convention. A different convention can allocate that interaction differently without changing the total.

An aggregate wage can rise when low-wage workers leave the observed sample even if nobody receives a wage increase. A regional temperature index can change when station inclusion changes. A network index can change when links are redefined. A model that treats every aggregate movement as a shock to a fixed population misinterprets the variable it observes.

Record the weight rule and test a fixed-composition series when feasible. Compare the results before deciding whether the dynamics changed. A repaired measurement specification may be more valuable than a larger autoregressive model.

## What can be learned from multiple indicators?

If two indicators measure the same state with independent noises, their shared variation can help isolate the state. For example, $Y_{1t}=S_t+\nu_{1t}$ and $Y_{2t}=\lambda S_t+\nu_{2t}$ imply $\operatorname{Cov}(Y_{1t},Y_{2t})=\lambda\operatorname{Var}(S_t)$ under the independence assumptions. Identifying the scale requires a normalization or an external unit definition.

A principal component can summarize shared variation, but its weights maximize a statistical criterion. They do not automatically define an economically valid measure. The sign is arbitrary; the scale depends on normalization; standardizing indicators changes the criterion. If a component is used for forecasting, estimate its transformations and weights on the training sample and freeze them at the origin.

The core course uses explicit small measurement systems so these assumptions can be inspected. Lecture 8 develops a scalar state-space filter with specified variances. Estimating high-dimensional factors or unrestricted state-space systems belongs to an extension after the basic information and identification issues are understood.

## Execute and revise the measurement specification

Run `ch05`. The synthetic realization's raw indicator error relative to its known state has an RMSE near 1.003; the trailing mean's error is near 0.931. This improvement is specific to the chosen signal persistence, noise variance, and sample. Increase the speed of signal movement or reduce measurement noise; averaging can become less useful. Keep the output target fixed as the current state while changing those conditions.

At a chosen date, record the raw value, filtered value, uncertainty claim, and admitted observations. Apply the future-mutation test. Then inspect the source to verify the exact input indices. Draw the window on a timeline; that drawing should agree with the code in every language.

For Project 1's prototype freeze, submit the measurement specification along with the model. An auditor should be able to reconstruct the target and each regressor from documented inputs. A cleaner graph is insufficient evidence of a better measurement process.

## Worked problem

Suppose a true state follows $S_t=0.8S_{t-1}+\eta_t$, where $\operatorname{Var}(\eta)=0.36$, and independent measurement noise has variance 1. The stationary state variance is $0.36/(1-0.64)=1$. The state lag-one covariance is 0.8, while observed variance is 2. Hence observed lag-one correlation is 0.4. Fitting a simple AR(1) directly to the observed series can produce a coefficient much smaller than the latent persistence.

Now suppose the true state rises exactly two units per period and noise is absent. A trailing three-period average is two units below the current state. Its graph is smoother only in a trivial sense: it is an equally straight line displaced in time. A decision requiring the current state should account for that delay.

The measurement ledger should specify which quantity is latent, what the observed indicator contains, which assumptions permit separation, and whether the reported estimate is filtered or smoothed. Those statements prepare the state-space argument without requiring a complex estimator yet.

## Further reading

[QuantEcon's Linear State Space Models](https://python.quantecon.org/linear_models.html) connects latent states to observed variables. [NOAA's geographic climate series](https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/statewide/time-series) provide an applied setting in which spatial definitions matter.
