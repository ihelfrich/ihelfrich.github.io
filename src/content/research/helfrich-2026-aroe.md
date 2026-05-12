---
title: "Adaptive-regularization observation equilibria"
authors: ["Ian Helfrich"]
year: 2026
status: "working paper"
abstract: "A fixed-point problem on the 2-Wasserstein space over a compact domain. Given a base transport cost, a smooth congestion-response function, a stochastic observation operator, and a feedback weight, the paper seeks measures that are optimal-transport plans for a measure-dependent cost. The cost-as-functional-of-equilibrium structure places the problem outside the standard optimal-transport machinery used in economics (where the cost is fixed). Existence is established under three regularity hypotheses; a fourth feedback-contractivity hypothesis delivers uniqueness with a quantitative half-order Wasserstein stability estimate. The economic motivation is quantitative spatial equilibrium with endogenous observation: settings where a remote-sensing observation operator enters the equilibrium trade cost. The result sits inside the Allen et al. (2024) umbrella uniqueness theorem and adds a measure-dependent cost channel and a pre-period conditional-moment restriction."
tags: ["optimal-transport", "fixed-point", "spatial-equilibrium", "satellite-economics"]
---

Theory paper; companion to **Paper 2 (Russian seaborne crude, 2021-2024)**, which provides the empirical test of Hypothesis (H4). Co-authored draft references with Haldorsen, Tavares, and Oyelaran also exist; coauthorship configuration is being worked out.

The technical contribution is the half-order rate. Standard Wasserstein gradient flows give first-order contraction on free-energy functionals (JKO). Here the cost is itself a functional of the measure, so the contraction argument runs through $c$-convex stability on the best-response map rather than displacement convexity, and the rate is $\sqrt{W_2}$ not $W_2$. This is what the empirical companion has to be powered to detect.
