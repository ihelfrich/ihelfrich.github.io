# St. Louis development and income scenario models

Contract version: `st-louis-development-models-v1`. Classification: deterministic, user-controlled scenario arithmetic. These are not empirical estimators. Empirical AI valuation status: **Not trained**.

## Development envelope

Inputs are lotAreaSqFt (ft², >0), far (dimensionless, ≥0), coveragePct (0–100), stories (whole number, ≥0), efficiencyPct (0–100), averageUnitSqFt (ft²/unit, >0), hardCostPerGrossSqFt (USD/ft², ≥0), softCostPct (≥0) and contingencyPct (≥0). No unknown monetary value receives a default. Source lot area may be copied only on an explicit action from selected official parcel evidence, preserving source identity and metadata. Editable area remains an assumption; a changed source area is identified as modified.

Gross floor area = min(lot area × FAR, lot area × coverage × stories). Usable area = gross × efficiency. Whole units = floor(usable / average unit area). Residual usable area = usable − whole units × average unit area. Hard cost = gross × hard cost per gross ft². Soft cost = hard cost × soft-cost rate. Explicit contingency = (hard + soft cost) × contingency rate. Total construction budget = hard + soft + contingency. The budget excludes land, acquisition, finance, operating carry and any cost not entered through the stated components. Unverified FAR, coverage and height assumptions are not zoning dimensional rules or legal entitlement.

## Income value and growth

Inputs are currentNoiAnnual (USD/year; signed), growthPct (annual, ≥−100), discountRatePct (annual, >−100), terminalCapPct (annual, >0), horizonYears (integer, 1–100), exitCostsPct (0–100), and lowGrowthPct/highGrowthPct (annual, ≥−100; low ≤ base ≤ high). UI percentages are divided by 100 once. All annual cash flows occur at year end.

Current NOI is year 0. NOI in year t is current NOI × (1 + growth)^t. Current NOI is never silently interpreted as next-year NOI. For horizon H, projected value is the sum of years 1…H NOI discounted by (1 + discount)^t, plus year H+1 NOI / terminal-cap rate × (1 − exit-cost rate), discounted by (1 + discount)^H. Terminal sale follows the final annual NOI payment. Negative NOI and resulting negative value remain signed; losses are never clipped. These values are scenario outputs, not current verified market values.

Low/base/high growth is user supplied and holds every other assumption fixed. These scenarios are not confidence intervals, statistical quantiles or calibrated forecasts. “Import calculated rental NOI” is explicit and retains the existing calculated scenario as provenance. Such NOI is an assumption from the rental model, not an observed account. A changed imported NOI is marked as modified.

## Cadence, failure and provenance

Execution is synchronous and deterministic, in fixed year order. Calculation occurs only on form submission or the explicit illustrative-fixture action. No network fetch, polling, model training or third-party service is involved. Missing/nonfinite input, domain violations, inverted sensitivity bounds, and nonfinite arithmetic fail with named input errors. Invalid edits clear displayed results; a changed selected property clears results and source-based assumptions. Exports include model version, assumptions, units, source/import basis, output, and validation status. Illustrative inputs are explicitly invented and never applied as facts about a selected property.

## Validation and limits

Verification consists of mechanical arithmetic and invariant tests: zero envelope and zero cost, min constraints, floor/remainder identity, nonnegative construction components, construction budget sum, linear area/cost and NOI scaling where defined, zero-growth closed form, explicit year-0/year-1/terminal-year conventions, discounting identity, 100% exit costs, growth −100%, signed negative results, invalid inputs and overflow failure. UI checks cover source-area/import actions, source identity changes, result invalidation, and export provenance. Test results are recorded in the implementation report; invariant verification is not empirical validation.

An empirical AI valuation model would require licensed transaction and property data, dated/quality-controlled joins, a clearly defined valuation target, training/calibration only on the training period, held-out temporal and geographic evaluation, comparable-baseline errors, uncertainty calibration, subgroup diagnostics and continuing drift monitoring. None of that training or validation has been performed by this workspace. Assessed values are not substituted for sale prices; no sale-price growth is inferred from one assessment snapshot.
