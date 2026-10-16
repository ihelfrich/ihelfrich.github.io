# Monetary Economics draft review

Status: draft; 60 original constructed questions, six units of ten. Reviewed October 13, 2026. No course activation or runtime changes.

## Sources and level

Verified two official research-university sources through live page retrieval:

- MIT, *14.461 Advanced Macroeconomics I*, Fall 2012 [calendar](https://ocw.mit.edu/courses/14-461-advanced-macroeconomics-i-fall-2012/pages/calendar/): public liquidity, nominal rigidities, liquidity traps, government spending, reputation, borrowing constraints, wage rigidity and information. The page explicitly identifies the course as graduate. It guides the monetary and stabilization coverage, not a claim that this draft reproduces MIT exercises.
- UC Berkeley, *Economics 210c/236a Monetary History*, Fall 2008 [course page](https://eml.berkeley.edu/~webfac/cromer/e210c_f08/e210c.shtml): official readings links identify VARs, narrative evidence and natural experiments, monetary policy and interest rates, the credit channel and inflation inertia. This guides the identification unit.

Both are official R1-university materials. Source URLs are curricular provenance, not evidence that the hypothetical numerical examples occurred or that a present institution follows the stated rules. Every question supplies the model assumptions needed for its answer. This is an upper-undergraduate/graduate bridge, with prerequisites recorded in the outline: intermediate micro and macro, calculus and optimization, probability, basic bank accounting and introductory econometrics. Advanced questions add present values, normal updating and matrix rank.

## Review of all questions

Every item was checked for one supported answer, three false alternatives under the specified assumptions, a substantive explanation and a method hint. The audit below records the decisive condition or calculation for each question. All have reviewStatus=draft and scenarioType=constructed.

| ID suffix | Review result |
|---|---|
| u1-01 | Weak dominance uses identical terminal payoffs, no extra holding cost or B advantage, and free asset choice. |
| u1-02 | The cash constraint applies before labor income arrives: 80/2=40. |
| u1-03 | Legal simultaneous netting leaves a 10-unit liability from A to B. |
| u1-04 | The card instructs a deposit transfer; no overdraft means no implied new borrowing. |
| u1-05 | Additive liquidity services compensate a 2-percentage-point return gap. |
| u1-06 | Pledgeable income, not project NPV, limits borrowing; additional wealth 15. |
| u1-07 | The haircut reduces loan capacity to 150. |
| u1-08 | Assets 110 exceed total liabilities 80, but current cash 10 cannot cover withdrawal 30. |
| u1-09 | No acceptance or redemption benefit and positive carrying cost imply no positive acquisition price. |
| u1-10 | The payment moves reserves and deposits between banks with zero aggregate change. |
| u2-01 | Interior continuous transfer frequency gives average balances proportional to the square root of transaction cost. |
| u2-02 | Opportunity cost is the difference between available yields. |
| u2-03 | Velocity is the reciprocal of the specified stable money-income ratio. |
| u2-04 | The multiplier is conditional accounting, not a mechanical lending-causality claim. |
| u2-05 | Loan and deposit creation leaves initial reserves and equity unchanged. |
| u2-06 | Unit risk weights and fixed equity give 20 of lending capacity. |
| u2-07 | Funding replacement restores reserves while changing liability composition. |
| u2-08 | Sequential service plus costly early liquidation creates strategic run incentives despite long-run solvency. |
| u2-09 | Exact exponential ratio is 0.904837; 0.90 is only an approximation. |
| u2-10 | Tail-probability marginal benefit rises weakly under a rightward FOSD shift; unique interior optimum weakly rises. |
| u3-01 | Costless access and matched risk/maturity establish bounds, not the corridor midpoint. |
| u3-02 | Satiation removes the liquidity premium while retaining remunerated reserve returns. |
| u3-03 | A nonbank seller receives a deposit; its bank receives reserves, not the purchased bond. |
| u3-04 | Imperfect substitution and limited arbitrage permit the supply-duration channel at fixed expected short rates. |
| u3-05 | Explicit additive approximation gives a 3.5% term yield. |
| u3-06 | A 1.5-point spread widening dominates a 1-point policy cut. |
| u3-07 | Fixed physical collateral does not fix its pledgeable market value. |
| u3-08 | Perfect substitutes, satiation and no signals jointly remove the swap's modeled channels. |
| u3-09 | Central-bank information can coexist with the policy innovation within the same narrow window. |
| u3-10 | Two-day averaging and no daily minimum imply second-day reserves of 6. |
| u4-01 | The stated labor-demand schedule gives a 21% increase, not a 10% increase. |
| u4-02 | Net gain G−F determines state-dependent adjustment; equality is not strict preference. |
| u4-03 | Common log-price translation preserves log-price variance. |
| u4-04 | Restoration divides by the current price level; required inflation is −3.846%. |
| u4-05 | Two iterations of the supplied lag process give 0.72 percentage points. |
| u4-06 | Deflating a fixed nominal repayment yields 1.1 expected versus 1 realized basket. |
| u4-07 | The reciprocal price-level change reduces purchasing power by 20%, not 25%. |
| u4-08 | Seigniorage differentiates both rate and base; π=0.5 is the unique maximum on π≥0. |
| u4-09 | Predetermined nominal wages preclude proportional adjustment of every nominal contract. |
| u4-10 | Normal signal extraction gives weight 1/4 and posterior mean 3. |
| u5-01 | The credit wedge raises the private-rate floor to 3%. |
| u5-02 | Fixed taxes, idle capacity and the given consumption rule imply a multiplier of 4. |
| u5-03 | A liquidity loan bridges payment timing under the stated sound-asset assumption. |
| u5-04 | Eligibility remains an access constraint independently of solvency. |
| u5-05 | Punishment starts next period, so its present value is 4 rather than 5. |
| u5-06 | Multiplicative instrument uncertainty requires E[b²], producing action 0.5. |
| u5-07 | Contractual reset rules, rather than principal alone, determine current cash-flow exposure. |
| u5-08 | Applying heterogeneous MPCs before aggregation gives net spending of 7. |
| u5-09 | The actual inherited price level and future target imply 1.010% inflation. |
| u5-10 | The response matrix has rank one; two named instruments cannot span two independent targets. |
| u6-01 | Private demand forecasts confound the observed endogenous rate-output relationship. |
| u6-02 | Narrative motivation can encode a direct supply-shock path, violating the proposed IV exclusion. |
| u6-03 | The reduced-form/first-stage ratio is −0.5% per percentage point, with validity explicitly conditional. |
| u6-04 | Population relevance cannot be supplied by sample size. |
| u6-05 | A recursive contemporaneous zero is an identifying assumption rather than a covariance finding. |
| u6-06 | The dependent variable identifies cumulative log growth, not a sum of level responses. |
| u6-07 | Credit is a post-treatment mediator; control may block total effects or create selection bias. |
| u6-08 | Zero measured announcement news does not imply zero anticipated policy effect. |
| u6-09 | The integral over the three one-quarter level losses is 4 output-unit quarters. |
| u6-10 | Matching shock responses does not identify unobserved welfare distortions or policy-rule rankings. |

## Executed verification

A Python standard-library validation executed through uv checked 60 schema matches to the existing advanced-macroeconomics question shape; 60 unique IDs; six units with ten sequential topics each; four unique choices per item with exactly three wrong choices; nonempty prompts, explanations, hints and sources; draft/constructed metadata; and exact outline/topic synchronization. It passed.

Executed 31 numerical assertions covering all numerical calculations and relevant balance-sheet quantities, plus five model checks: local optimality comparisons for seigniorage and uncertain policy effectiveness, log-dispersion invariance, a zero instrument-effect determinant, and reserve-transfer conservation. All passed. Exact versus approximate quantities and units were separately reviewed.

Compared the existing advanced-macroeconomics titles and prompts: no exact duplicates. Conceptual overlap was reviewed as well. This draft avoids its Euler/Ramsey/OLG/RBC exercises, Calvo duration, NK IS/Phillips arithmetic, Taylor principle, standard lower-bound demand gap, simple inflation-bias optimization, debt arithmetic and Lucas-critique question. Shared broad policy themes use distinct tasks: asset-service dominance, accounting and liquidity, collateral/funding wedges, price-level path restoration, repeated-game punishment, instrument uncertainty and empirical identification. The reputation exercise uses a specified repeated-game incentive calculation rather than the existing discretion/commitment inflation problem.

Corrections during review: removed an initial equal-purchase-price premise from u1-01 that conflicted with its proposed equilibrium-price comparisons; made free choice and absence of other B services explicit. Renamed u4-10 from rational inattention to Bayesian updating because the exercise has no endogenous attention choice. No unresolved computational defect identified. Human editorial approval and application integration remain pending; no rendered-page claim is made because these files are unactivated drafts.
