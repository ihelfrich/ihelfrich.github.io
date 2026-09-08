# The Econometric Argument: first web edition

Public route: /econometrics/. Built as part of Ian Helfrich's existing portfolio, not a separate product. Preserve all existing site content and unrelated work.

## Editorial contract

The unit of learning is an empirical argument: target, observations, identification, estimation, uncertainty, decision. A repeated original example is a firm considering an optional training program; hours, output, self-selection, implementation costs, and changing populations force different questions. Explicitly synthetic examples, never implied real company results. Other examples may broaden economics beyond firms.

Write precise, original, human prose. Concrete opening, varied paragraph length, no marketing adjectives or repeated template rhetoric. No em dashes; no 'not X but Y'/'rather than' constructions in Astro files. Never copy textbook prose or figures. Link primary sources. Established results are attributed; teaching design is not claimed to be a new econometric method.

12 compact chapters, each self-contained and substantive (~800-1200 words if possible), with intuition, full equation definitions, a worked numerical example, an explicit formal result with assumptions/derivation, a failure case, two exercises with expandable solutions, and primary-source reading links. At least one runnable computation per chapter where useful. Avoid claiming a compact chapter replaces a graduate sequence.

## Content files and frontmatter

Use src/content/econometrics/01-argument.md through 12-decisions.md. Ordinary Markdown rendered by Astro, inline $math$ and display $$math$$ through remark-math/rehype-katex. For inline display examples use conventional delimiters. HTML <details><summary>...</summary> with blank lines around Markdown inside allowed. KaTeX errors will fail build. No MDX, imports, scripts or framework code in content.

Frontmatter:
---
title: 'A specific chapter title'
order: 1
part: 'Frame'  # Frame, Estimate, Identify, Generalize
description: 'One sentence describing what the reader can do.'
question: 'A concrete opening question?'
prerequisites: 'Words, fractions, and an interest in evidence.'
minutes: 25
lab: 'worlds' # optional worlds, sampling, design
---

Use ## headings, no top-level # (template renders title). Use linked source titles to exact public pages. Cite no invented publications. Exercises use <details class="solution"><summary>Work through the solution</summary> ... </details>. The reader template provides navigation, math/reading styles, completion saved locally, printable edition, on-page headings, accessible mobile layout.

## Chapter allocation

1 01-argument: estimand, association, intervention, observational equivalence. DGP U,V iid standard normal, X=U, Y=bX+(1-b)U+V, hence observed Y=X+V for every b. Intervention do(X=x) replaces X equation only; E[Y|do X=x]=bx. Range b [-1,2] is a teaching restriction, not an identified set. Causal worlds observationally indistinguishable; positivity of observed X does not solve latent confounding. Randomization would distinguish them. Link /econometrics/lab/#worlds.
2 02-probability: probability/conditioning/expectation, iterated expectations, variance decomposition, sampling vs population; binary worked table/selection.
3 03-projection: OLS projection, normal equations, residual orthogonality, FWL, finite-sample vs causal assertions. Geometry and omitted variables numerical example.
4 04-uncertainty: finite vs asymptotic inference, LLN/CLT assumptions, sandwich, clustering, coverage vs probability parameter; lab uses known-sigma Gaussian CI deliberately. Include why n cannot cure bias.
5 05-design: experiments, potential outcomes, SUTVA, randomization, covariate adjustment, attrition, power/design choices. One randomization inference miniature example.
6 06-measurement: missingness, measurement error, selection, DAGs and bad controls, attenuation derivation and limits, audit schema.
7 07-instruments: IV, Wald, LATE assumptions and derivation; weak IV and AR intuition; moments/GMM bridge, invalid instrument sensitivity.
8 08-panels: FE vs DiD, two-by-two derivation, parallel trends, timing heterogeneity, group-time ATT, honest sensitivity; lab delta confounding bound M and effect interval dd +/- M excludes sampling uncertainty.
9 09-local-designs: RDD, continuity vs local randomization, bandwidth/bias, synthetic control convex weights/fit and limits, falsification.
10 10-learning: prediction vs inference, bias variance, honest split, DML PLR score orthogonality derivation, cross-fitting not confounding cure; nuisance assumptions/product rates, inference.
11 11-dependence: likelihood/GLM, forecasting time split, serial correlation/stationarity, prediction intervals, conformal exchangeability/limitations, transport/spatial dependence. Distinguish predictive vs causal targets. May focus on forecasting/transport with GLM bridge to keep rigorous.
12 12-decisions: decision loss, policy learning, partial identification, interference/general equilibrium, structured capstone and research frontier. Cost/benefit robust decision under interval effect; no economic claim from toy model.

## Release honesty

Development edition September 2026. 12 compact chapters and three linked experiments. Graduate and frontier topics are introductions and reading paths, not a complete graduate textbook. Mathematics and browser implementations tested; pedagogy not empirically evaluated. No student data or copyrighted PDFs published. Reproducible lab data synthetic, downloadable. No accounts, AI chat, tracking, or remote computation. Local reading/notes are optional and clearable.
