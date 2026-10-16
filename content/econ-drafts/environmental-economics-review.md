# Environmental and Resource Economics draft review

Status: draft; 60 original families, six units of ten. No runtime, registry, release status, or tests were changed. Every item includes a hint for later extraction. These are finished draft stems, not parameterized variant generators.

## Curriculum sources verified with web tools

- [MIT 14.42 Environmental Policy and Economics, Spring 2011 syllabus](https://ocw.mit.edu/courses/14-42-environmental-policy-and-economics-spring-2011/pages/syllabus/): undergraduate environmental regulation, costs and benefits, climate, energy efficiency, resources, and emissions markets. Anchors units 1–4 and 6.
- [University of Chicago PPHA 44320 Energy and Environmental Economics I, Fall 2025 syllabus](https://harris.uchicago.edu/sites/default/files/2025-08/PPHA44320_Energy%20and%20Enviornmental%20Economics_Kellogg_2025.pdf): externalities, resource production, common property, Hotelling allocation, pollution instruments, uncertainty, intensity standards, and leakage. Used for topic coverage; these drafts do not claim to reproduce the graduate course’s difficulty.
- [University of Colorado Boulder ECON 4535 Natural Resource Economics, Spring 2007 outline](https://www.colorado.edu/economics/sites/default/files/attached-files/spring07-4535-001.pdf): intertemporal allocation, exhaustible resources, groundwater, benefit-cost analysis, and renewable resources. Anchors unit 5.

All three are official R1 university course materials, successfully opened during this task. A Berkeley search result returned 404 and is not cited. Sources establish curriculum provenance; they do not supply these questions, values, or answers. All scenarios and numerical inputs are constructed. No empirical effect sizes or claims about current policy outcomes are asserted.

## Review performed

Read each of the 60 complete stems, all 240 answer options, explanations, and hints for a single defensible answer under stated assumptions. Checked each numerical solution and conceptual distinction. IDs, topics, exactly three distractors, option uniqueness, nonempty hints, source URLs, draft status, and ten items per unit passed structural assertions. Numerical arithmetic was executed in Python with 33 assertion checks and a tolerance of 1e-8. No external dependencies were installed.

Unit 1 review covered private versus social margins; public-good aggregation; bargaining gains and entitlement transfers; triangular welfare loss; price-mediated effects; source-specific harm; and efficient residual pollution. Unit 2 covered constrained cost minimization, tax response, opportunity cost of free permits, instrument equivalence assumptions, the standard local uncertainty model, hybrid caps, expected enforcement, intensity accounting, and spatial trades. Unit 3 covered demand integration, time costs, confounding, nonuse values, credible payment tradeoffs, household aggregation, double counting, risk denominators, transferability, and the option to wait. Unit 4 covered stock-flow accounting, deliberately simplified decay, welfare scope, discounting, free riding, leakage denominators, counterfactual offsets, adaptation, and rebound. Unit 5 covered net-price rather than gross-price growth, stock constraints, discounted margins, backstops, biological growth, stock accounting, entry, rents, groundwater effects, and a bounded forest decision. Unit 6 covered timing, compensation, welfare weights, rebate incidence, group exposure, transfers, parallel trends, anticipation, cost-effectiveness, and a break-even threshold.

## Corrections and deliberate scope restrictions

- Corrected an initial efficient-output arithmetic/key mismatch in 1.1: the answer is 60, not 30. Replaced the conflicting distractor and explanation; the final saved item is internally consistent.
- Confined the prices-versus-quantities claims to the standard local uncertainty comparison; they are not universal rankings across all stochastic models.
- Distinguished permit transfers from physical emissions, and tax transfers from real costs; free allocation never becomes a zero opportunity cost.
- Stated the one-box carbon-decay model explicitly and explained that its positive steady-state emissions result is not a factual carbon-cycle claim.
- Restricted the forest comparison to a one-time choice without replanting or non-timber services, avoiding a false general forest-rotation rule.
- Stated identifying assumptions in the difference-in-differences item and the expected-NPV rule in the uncertain-benefit item.
- Limited household incidence to the supplied monetary changes, avoiding an unsupported full-welfare interpretation.

## Executed numerical results

The checks covered: efficient output 60; abatement 20; marginal damage 30; public cleanup 5; welfare loss 200; least-cost allocation 8/4; tax abatement 6; expected fine 20; intensity emissions 100; recreation surplus 16; aggregate benefits 36,000; statistical-life value 3,000,000; next stock 110; steady emissions 10; global damage 40; discounted benefit 100; net emissions reduction 70; leakage 30%; realized energy saving 30; rebound 25%; next resource price 31; symmetric extraction 5/5; logistic maximum growth 5 at stock 50; ending fish stock 74; rents 60 versus 10; delayed forest sale value 981.82; cleanup NPV 4.13; weighted benefit 20; household gain 50; policy effect −20; cost per case 3,000; and break-even future benefit 94.50.

Remaining gate: parent review and any requested independent content/release review. These drafts are not activated.
