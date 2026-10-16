# Behavioral Economics draft review

Status: draft only. Sixty original multiple-choice families, six units of ten; no runtime activation or registry changes. All scenarios and numerical inputs are constructed teaching examples, identified by `scenarioType: constructed`, not reported empirical estimates. Each item has a correct answer, three distinct distractors, explanation, hint, skill, topic and verified source URLs.

## Curriculum sources

Verified by opening both official university sources on October 12, 2026:

- MIT, 14.13 Psychology and Economics, Spring 2020, [syllabus and calendar](https://ocw.mit.edu/courses/14-13-psychology-and-economics-spring-2020/pages/syllabus/). Scope informed time preferences, risk/reference dependence, social preferences, beliefs, attention and policy.
- UC Berkeley, Econ 219B Applications of Psychology and Economics, Spring 2012, [syllabus](https://eml.berkeley.edu/~webfac/dellavigna/e219b_s12/219BSyllabusSpring2012_Jan12-2.pdf). Scope informed experimental identification, commitment designs, nonstandard beliefs, field applications and welfare.

These are curriculum provenance, not claims that the universities wrote, approved or empirically validated these questions. Questions and scenarios were composed afresh; no exam or problem-set wording was copied. Behavioral games receive a distinct unit to complement these curricula.

## Self-review

All 60 prompts, answer sets, hints and explanations were checked for a single defensible answer under the stated assumptions. Review distinguished loss aversion from curvature; known independent randomness from parameter learning; beliefs from conditional optimization; assignment effects from mechanism identification; and descriptive effects from welfare criteria. Empirical implications are conditional rather than universal.

Corrections made during drafting:

- U1-04 initially used a sure loss of 25, accidentally creating exact indifference with the specified gamble. Changed it to 50 and recomputed both utility values, yielding a strict comparison.
- U4-05 now explicitly says both players maximize own money, in addition to specifying acceptance at indifference. This removes an implicit assumption behind the zero-offer answer.
- Guessing-game items specify negligible own influence or a continuum to avoid a finite-player best-response ambiguity.
- The internality item specifies the normative benefit measure, full tax perception, absence of other distortions and lump-sum rebate.

## Verification

Executed structural checks: 60 unique IDs; 10 items in each of six units; three distinct wrong answers per item; no correct answer duplicated among distractors; nonempty prompt, explanation, hint, skill and sources. Outline has six matching units and sixty matching topic labels.

Executed 26 independent numerical assertions covering mixed-gamble valuation, square-root losses, probability weighting, discounting, preference reversal, commitment, Bayesian probabilities and odds, fee inattention, altruism, both inequality terms, public goods, displacement, level reasoning, logit response, best response, learning, ITT, Wald scaling, false rejections and welfare totals. All passed at absolute tolerance 1e-10. Representative results: mixed-gamble value −5; sure-loss value −7.0711 versus gamble −5; commitment willingness to pay 2; posterior 4/13; logit probability 0.8; Wald effect 50; policy net welfare 220.

Remaining gate: independent editorial/pedagogical approval before activation. This is a self-reviewed draft bank, not an independently reviewed or piloted assessment.
