# Causal inference draft review

Status: author-reviewed draft; not activated. 60 original constructed questions, six units of ten. All questions specify their own context and have one keyed answer, three distinct distractors, an explanation, a method hint, source URLs and draft/constructed metadata. Outline includes prerequisites and separately named advanced extensions. No runtime or active curriculum files were changed.

## Source verification

Verified October 13, 2026 through official university pages:

- MIT 14.387, Applied Econometrics: Mostly Harmless Big Data (Fall 2014): https://ocw.mit.edu/courses/14-387-applied-econometrics-mostly-harmless-big-data-fall-2014/ — verified coverage of regression/matching, IV, DiD, RD, standard errors and high-dimensional methods.
- MIT 14.32/14.320, Econometric Data Science (Spring 2022): https://economics.mit.edu/sites/default/files/inline-files/Syl32SP22r3.pdf — verified potential outcomes, trials, regression, IV, DiD and RD, plus probability/statistics prerequisites.
- Harvard official course description, Econometrics and Causal Inference with R: https://coursebrowser.dce.harvard.edu/course/econometrics-and-causal-inference-with-r/ — verified observational causal-inference course framing. Used as an additional breadth anchor in the outline, not as a source of numerical examples.

These are coverage anchors, not claims that university instructors reviewed these questions or supplied their scenarios. Curriculum-plan sources for this course were empty; the local fields curriculum map provided the MIT 14.32 anchor. A Harvard STAT 186 fetch failed; it was not relied upon. Question wording and examples were composed afresh rather than copied from assessments.

## Corrections and executed checks

A delimiter used during authoring split conditional-expectation bars in the distractors for 1.3 and 3.1. Replaced both with explicit three-element arrays preserving the mathematics. Final validation rejects any item with other than exactly three wrong options. All 60 pass; all 60 IDs and topics are unique; each unit has ten items; all four options within each item differ; required metadata and hints are nonempty; outline topics match question topics.

Independent exact-fraction arithmetic pass: 1.1=2; 1.2=16/5; 1.9=11/5; 1.10=[−3/10,7/10]; 2.2=3; 2.8=2; 3.2=16/5; 3.4=4; 4.1=5; 4.5=2/5; 4.10=22/3; 5.1=3; 5.9=7/2; 6.2=4; 6.3=6; 6.7=[3,7]; 6.8=7/2. No numerical key required correction.

## Item-by-item self-review

Each entry records the main assumption, distinction, or calculation checked, including whether distractors introduce a second valid answer.

| Topic | Review result |
|---|---|
| 1.1 | Full potential-outcome table intentionally supplied; four effects average to 2. |
| 1.2 | Actual-receipt subgroup weighting distinguishes ATE from ATT. |
| 1.3 | Selection decomposition uses untreated mean among recipients; sign checked; options repaired. |
| 1.4 | Consistency reveals only the realized potential outcome. |
| 1.5 | Version distribution must be specified for a mixture intervention. |
| 1.6 | Exposure mapping permits interference but still requires mapping sufficiency. |
| 1.7 | Difference of marginal medians need not equal median individual effect. |
| 1.8 | Defined estimand does not imply identification from observed receipt. |
| 1.9 | Target shares give 2.2; effect transport explicitly assumed. |
| 1.10 | Binary missing outcomes generate attainable bounds −0.3 to 0.7. |
| 2.1 | Randomized offer identifies offer effect without receipt exclusion. |
| 2.2 | Sample ITT 3 distinguished from exact population effect. |
| 2.3 | Actual take-up remains selected despite randomized encouragement. |
| 2.4 | One-sided access rules out always-takers and defiers; only former is an option. |
| 2.5 | Randomization balances in expectation, not deterministically. |
| 2.6 | Treatment-dependent response may break complete-case comparability. |
| 2.7 | Twenty independent schools require attention to few-cluster inference. |
| 2.8 | Population-share aggregation gives 2. |
| 2.9 | Sharp individual null, unlike average-zero null, imputes missing outcomes. |
| 2.10 | Baseline adjustment can improve precision, without guaranteed realized gains. |
| 3.1 | Exchangeability, consistency and overlap identify standardized ATE; options repaired. |
| 3.2 | Target standardization gives 3.2 under explicit identification assumptions. |
| 3.3 | Exchangeability cannot replace untreated support at X=1. |
| 3.4 | Unnormalized Horvitz–Thompson contribution has weight 4 before division by n. |
| 3.5 | Mediator adjustment changes total-effect target and can induce bias. |
| 3.6 | Conditioning on D→A←U opens the stated spurious path. |
| 3.7 | Averaging matched contrasts over treated distribution targets ATT. |
| 3.8 | Double robustness stated for consistency under either propensity or both outcome models. |
| 3.9 | Cross-fitting cannot establish exchangeability; rate conditions remain necessary. |
| 3.10 | Trimming changes target support without identifying excluded-stratum effects. |
| 4.1 | Wald 2/0.4=5; binary randomized encouragement assumptions explicit. |
| 4.2 | Complier is a pair of potential receipts, not observed receipt alone. |
| 4.3 | Voucher’s direct earnings route threatens exclusion specifically. |
| 4.4 | Monotonicity constrains receipt rather than outcome-effect signs. |
| 4.5 | Randomization plus monotonicity makes first stage the complier share 0.4. |
| 4.6 | Heterogeneous compliance-type effects prevent LATE-to-ATE equivalence. |
| 4.7 | Weak first stage threatens conventional inference, not proof of invalidity. |
| 4.8 | Different instruments can shift different complier populations. |
| 4.9 | Z=1,D=1 mixes always-takers and compliers. |
| 4.10 | Defiers enter with negative signs; ratio 22/3 is nonconvex. |
| 5.1 | DiD 3; no anticipation, no interference, composition and trends assumptions explicit. |
| 5.2 | Parallel trends concerns untreated changes, not equal levels or homogeneous effects. |
| 5.3 | Behavioral response before implementation contaminates the chosen baseline. |
| 5.4 | Imprecise pretrend nonrejection does not establish counterfactual posttrends. |
| 5.5 | Firm-year confounder survives firm and common year effects. |
| 5.6 | Heterogeneous staggered TWFE may use contaminated controls/nonconvex weights; not universal. |
| 5.7 | Cohort and calendar time fixed in target; treated path explicitly defined for cohort. |
| 5.8 | Not-yet-treated controls additionally need no anticipation; other assumptions acknowledged. |
| 5.9 | Explicit nonnegative target shares give aggregate 3.5. |
| 5.10 | State clustering matches within-state serial dependence with sufficiently many states. |
| 6.1 | Continuity-based sharp RD is local to threshold; no unsupported global effect. |
| 6.2 | Treatment direction fixes positive right-minus-left effect 4. |
| 6.3 | Fuzzy RD local compliance conditions stated; ratio 6. |
| 6.4 | Sorting threatens counterfactual continuity but does not mechanically invalidate every RD. |
| 6.5 | Smaller bandwidth typically trades approximation bias against variance. |
| 6.6 | Density diagnostic neither proves continuity nor excludes all manipulation. |
| 6.7 | Bias convention effect+bias fixes interval [3,7]; not a confidence interval. |
| 6.8 | Target ATE 3.5 requires effect transport and population support beyond randomization. |
| 6.9 | Older target stratum lacks trial support; larger younger sample does not repair it. |
| 6.10 | National equilibrium intervention differs from pilot; pilot internal validity preserved. |

## Remaining gate

These files remain drafts for parent integration and substantive review. No browser rendering or runtime activation was performed because this subtask was restricted to draft content. Advanced extensions are bounded conceptual exercises, not complete treatments of nuisance-rate theory, weak-IV inference, modern DiD estimation, or transport identification.
