---
title: Measurement as a constrained identification problem
description: Proofs, counterexamples, and a finite research proposal connecting representation, compatible models, and decisions under disputed values.
order: 3
---

The hypothetical support service in the [opening essay](/econometrics/measurement/story/) offers two designs: A improves access while constraining participant control; B reverses that trade-off. The [field guide](/econometrics/measurement/field-guide/) derives a compatible score-gap interval. Here we establish exactly what licenses that calculation, connect it to identification and experiment comparison, and delimit a research problem it does not solve.

The numbers are synthetic. The propositions are elementary consequences of established representation theory and optimization, presented with proofs for scrutiny rather than as new theorems. Neither correct arithmetic nor sharp bounds establish construct validity.

## Representation precedes identification

Let an empirical structure specify relations among observations and let a numerical representation preserve those relations. Its admissible transformations express which features of the representation remain undetermined. Narens and Luce (1986) place these structures, representation results, and uniqueness questions at the center of measurement theory. Invariance is an essential check here, although their treatment does not equate it with a complete account of scientific meaningfulness.

For one common ordinal scale, all strictly increasing recodings preserve the stipulated empirical ordering. Consider profiles $A=(1,4)$ and $B=(2,3)$. Define, on $[1,4]$,

$$
f_q(s)=\frac{s^q-1}{4^q-1}\quad(q\ne0),
\qquad f_0(s)=\frac{\log s}{\log4}.
$$

**Anchored-recoding proposition.** Every real $q$ gives a strictly increasing transformation with $f_q(1)=0$ and $f_q(4)=1$. Nevertheless the mean gap

$$
D(q)=\frac{f_q(1)+f_q(4)-f_q(2)-f_q(3)}2
$$

is negative for $q<1$, zero for $q=1$, and positive for $q>1$.

**Proof.** For nonzero $q$, the derivative is $q s^{q-1}/(4^q-1)>0$. Its second derivative has the sign of $q-1$. The logarithmic continuation is increasing and strictly concave. Finally,

$$
2D(q)=\{f_q(4)-f_q(3)\}-\{f_q(2)-f_q(1)\}.
$$

These are increments over equal-length intervals. An increasing derivative makes the first increment larger; a decreasing derivative makes it smaller. At $q=1$, linearity gives equality. This proves every case, including the continuation at zero.

Preserving endpoints therefore supplies insufficient cardinal structure. Marichal and Mathonet (2001) study comparison meaningfulness under common ordinal transformations; this example illustrates the issue without reproducing their characterization theorem or changing its hypotheses. Independent transformations for different dimensions would pose a different problem. Specifying a utility function or defending interval-scale structure would also change the admissible transformations.

Construct validity asks an additional question: what do these categories represent? Adcock and Collier (2001) distinguish the background concept, systematized concept, indicators, and scores across qualitative and quantitative research. Cronbach and Meehl (1955) locate interpretations within a network of theoretical and observable relations. Borsboom and colleagues (2004) propose a distinct causal-realist criterion involving an existing attribute that affects measurement outcomes. These positions should remain visible. A policy-defined composite need not be a reflective latent attribute, and a well-fitting observation model cannot settle that distinction by itself.

## Sharp bounds under declared geometry

Provisionally grant meaningful differences on the two 0–100 scenario rubrics. Suppose the joint profile domain is the full Cartesian product

$$
M=[75,85]\times[25,45]\times[45,65]\times[65,85],
$$

with coordinates $(A_1,A_2,B_1,B_2)$. Allow access weights $w\in[\ell,h]\subseteq[0,1]$, independently of profile compatibility. The scalar decision gap is

$$
G(m,w)=w(A_1-B_1)+(1-w)(A_2-B_2).
$$

This is an additive, compensatory value model. Rectangular compatibility means all listed combinations are allowed; it does not assert stochastic independence or assign probabilities.

**Box-bound proposition.** For arbitrary coordinate intervals, write $d_i^L=a_i^L-b_i^U$ and $d_i^U=a_i^U-b_i^L$. Then the attainable gap set is the entire interval $[L,U]$, where

$$
L=\min_{w\in\{\ell,h\}}\{wd_1^L+(1-w)d_2^L\},
\qquad
U=\max_{w\in\{\ell,h\}}\{wd_1^U+(1-w)d_2^U\}.
$$

**Proof.** For fixed $w$, nonnegative weights let the lower and upper profile corners attain the respective extrema simultaneously. Each resulting expression is affine in $w$, hence attains its extrema at weight endpoints. The domain is nonempty, compact, and connected. Its continuous real-valued image is consequently a closed interval containing both attained extrema. Thus there are no missing interior values.

For this case, $d^L=(10,-60)$ and $d^U=(40,-20)$. Both weight slopes are positive, giving

$$
[L,U]=[70\ell-60,\ 60h-20].
$$

The endpoint shortcut depends on those signs. At equal weights the range is $[-25,10]$; at $w=0.9$ it is $[3,34]$; at $w=0.1$ it is $[-53,-14]$. Strict robust preference for A requires $L>0$, and for B requires $U<0$. Equality at an endpoint admits an indifferent profile. A sign-spanning interval establishes neither equality nor a robust ordering.

For $k$ dimensions and a nonempty bounded weight simplex

$$
W=\left\{w:\sum_iw_i=1,\ 0\le\ell_i\le w_i\le u_i\right\},
$$

the corresponding extrema are linear programs: minimize $w^\top d^L$ and maximize $w^\top d^U$. Starting at the lower weight bounds, allocate remaining mass to the smallest lower coefficients for minimization and the largest upper coefficients for maximization, respecting capacities. An exchange of mass from a larger coefficient to an unfilled smaller one weakly lowers the minimizing objective, proving the greedy rule. Feasibility requires $\sum_i\ell_i\le1\le\sum_i u_i$.

Sharpness belongs to the specified joint set. If $A=(t,1-t)$ for $t\in[0,1]$, $B=(1/2,1/2)$, and $w=1/2$, the true gap is identically zero. Its marginal box instead produces $[-1/2,1/2]$. These are outer bounds after discarding dependence, not sharp bounds for the original model. Dependence between values and compatible profiles requires the same attention.

## Refinement, revision, and feasibility

**Fixed-domain refinement proposition.** Fix a real-valued gap function $g$ and nonempty sets $M'\subseteq M$, $W'\subseteq W$, with finite bounds. Then

$$
\inf g(M\times W)\le\inf g(M'\times W')
\le\sup g(M'\times W')\le\sup g(M\times W).
$$

**Proof.** Every admissible argument in the restricted product was already admissible in the original product. An infimum over fewer arguments cannot decrease; a supremum cannot increase. No probability model is needed. Without connectedness, these endpoints describe an interval hull, not necessarily the full attainable image.

An audit narrowing A's control to $[30,40]$ and B's to $[70,80]$ yields $[60w-50,70w-30]$. At equal weights this contracts $[-25,10]$ to $[-20,5]$. A strict robust ranking survives any genuine nonempty restriction with the same gap function.

The qualification carries substantive weight. Broadening values while narrowing profiles need not contract bounds. Discovering abandoned bookings may require a new population, construct definition, or observation channel, replacing the compatible domain. Such revision need not preserve an old conclusion. Empty compatibility means evidence and assumptions conflict, not that every preference is proven. Ordinary sequential confidence intervals need not be nested; set inclusion supplies no sampling coverage guarantee.

Now impose participant control $C\ge50$ as a feasibility requirement. A always fails, because its upper bound is 45. B always passes, because its lower bound is 65. B is the only admissible design even though the compensatory rule at $w=0.9$ robustly favors A.

**Noncompensation proposition.** On continuous bounded rubrics, no fixed positive access weight in the raw linear score universally ensures that a feasible design outranks every infeasible design at an interior control threshold $T$.

**Proof.** For $0<w<1$, compare feasible $F=(0,T)$ with infeasible $I=(100,T-\varepsilon)$. Choose positive $\varepsilon$ small enough to remain within the rubric and satisfy

$$
100w-(1-w)\varepsilon>0.
$$

Then the linear score favors I. For $w=1$, the violation is immediate. The excluded case $w=0$ orders only control and ignores access. An explicit feasible set implements the threshold. On bounded score domains, a sufficiently large discontinuous indicator penalty can also encode it, but that explicitly installs the veto.

Under uncertainty, distinguish definitely feasible ($\inf C\ge T$), definitely infeasible ($\sup C<T$), and unresolved. Equality passes the stated weak threshold. Filtering unresolved options through a precautionary rule is an additional decision commitment, not an empirical finding.

## From observation operators to experiments

The inverse-problem analogy becomes exact only after specifying an observation operator. In a conditional moment model $Tg=m$, injectivity of $T$ on the admitted function class makes $g$ unique. Newey and Powell (2003) connect nonparametric instrumental-variable identification to completeness. Regularization can stabilize inversion without establishing that the identifying restriction holds. Their result does not identify arbitrary latent constructs merely because an analyst writes an operator equation.

Rosenthal's *Prior-free Blackwell* (2026) supplies a particularly close finite comparison. Let $E$ be a known column-stochastic experiment and let the entire population message distribution $\gamma$ be observed. Compatible state distributions satisfy

$$
P(E,\gamma)=\{\nu\in\Delta(\Theta):E\nu=\gamma\}.
$$

For this setting, the paper characterizes robust informativeness by $\operatorname{null}(E)\subseteq\operatorname{null}(E')$, equivalently a linear factorization $E'=\Gamma E$, alongside compatible-set inclusion for every underlying distribution. The factorization need not be a stochastic garbling; the resulting order is weaker than classical Blackwell informativeness. Unknown channels and finite observations are outside that theorem's stated observation setup.

Brooks, Frankel, and Kamenica (2024) instead examine comparison regardless of preferences and access to other signals, with a reveal-or-refine characterization. The usefulness of a proposed interview or coding exercise can depend on accompanying administrative evidence. These results motivate careful experiment specification; they do not establish that combining proxies validates their interpretation. Manski (2025) likewise makes identification relevant to attainable decision performance, including potential gains from sample-based randomization under partial identification.

## A finite active-measurement proposal

The following is a proposed research specification. Fix finite state, action, measurement, and response sets $\Theta$, $\mathcal A$, $\mathcal E$, and $\mathcal Y_e$. A state describes both designs' relevant features. Include a safe fallback action feasible in every state. For each measurement $e$, let $\mathcal K_e$ be a nonempty finite family of candidate response channels $K_e(y\mid\theta)$. Let $\mathcal V$ be a nonempty finite collection of stakeholder criteria with utilities $u_v(a,\theta)$ expressed in agreed comparable decision units. Without that normalization, worst-case regret across criteria changes with arbitrary utility rescaling.

Timing is explicit. The decision maker commits to a measurement and contingent randomized action rule. Nature selects an unknown state, criterion, and candidate channel before the response is drawn. A response is observed through that channel and the committed rule selects an action. Nature cannot change the channel after seeing the response. No prior over these uncertainties is supplied.

Let $\delta_y\in\Delta(\mathcal A)$ be the response-contingent lottery. Permit positive probability on an action only if it is feasible in every state that can produce $y$ under at least one candidate channel. At responses impossible under all candidates, prescribe the fallback. Let $\mathcal D_e$ collect these rules, and define the feasible oracle value $u_v^*(\theta)=\max_{a\in\mathcal A_F(\theta)}u_v(a,\theta)$. A finite objective is

$$
J^*=\min_{e\in\mathcal E}\min_{\delta\in\mathcal D_e}
\max_{\theta,v,K_e\in\mathcal K_e}
\left\{c(e)+\sum_{y\in\mathcal Y_e}K_e(y\mid\theta)
\left[u_v^*(\theta)-\sum_a\delta_y(a)u_v(a,\theta)\right]\right\}.
$$

The maximum ranges over $\theta\in\Theta$ and $v\in\mathcal V$. Cost $c(e)$ is measured in the same units; alternatively impose a resource budget and omit additive cost. Include a zero-cost null measurement. Monetary, privacy, and participation burdens require explicit valuation or separate constraints. Their conversion is not identified by the observed response.

For each fixed experiment this is a finite linear program after introducing an epigraph variable for worst-case loss. Compactness and the fallback guarantee an optimizer. Enumerating the finite experiment menu therefore gives an exact baseline computation. These existence and computation observations establish no statistical or substantive novelty. Precommitment avoids quietly substituting a dynamically inconsistent posterior maxmin rule after observation.

Open obligations include calibrating channel uncertainty with defensible error guarantees, handling misspecification, comparing this specification with robust experimental design, and determining when measurement reduces regret despite persistent value disagreement. Full-support channels make support-based compatibility uninformative after one response; expected regret still distinguishes experiments, but useful exclusion requires further assumptions. If incentives change behavior, as in Holmstrom and Milgrom's multitask analysis, a fixed-state channel may fail. A sequential extension must model that response explicitly. Qualitative findings can also invalidate the finite ontology rather than select one of its states. That event requires model revision and renewed analysis.

## Three doctoral exercises

### 1. Separate invariance from dominance

For the two ordinal profiles, calculate $D(2)$ and $D(1/2)$. Verify invariant empirical pairwise superiority and determine whether either empirical distribution first-order stochastically dominates the other.

<details class="solution">
<summary>Full solution</summary>

Squaring gives B's mean $11/30$ and A's mean $1/2$, so $D(2)=2/15$. Square-root recoding gives

$$
D(1/2)=\frac{3-\sqrt2-\sqrt3}{2}\approx-0.073132.
$$

The sign is negative because $\sqrt2+\sqrt3>3$. A's category 1 loses both comparisons with B, and its category 4 wins both. Empirical pairwise superiority is therefore $2/4=1/2$ under every common strictly increasing transformation. Between 1 and 2, A's empirical cumulative distribution is $1/2$ and B's is zero; between 3 and 4, A's is $1/2$ and B's is one. The crossing excludes dominance in either direction. Invariant pairwise superiority does not imply equality under every increasing utility or aggregation rule.

</details>

### 2. Audit a bound and a refinement claim

Suppose $d_1\in[-8,-2]$, $d_2\in[3,7]$, with rectangular compatibility and $w\in[1/5,4/5]$. Obtain sharp bounds. Then evaluate the assertion that the support-service audit must contract its original equal-weight interval even if all weights become admissible.

<details class="solution">
<summary>Full solution</summary>

The lower corner is $3-11w$, minimized at $4/5$, giving $-29/5$. The upper corner is $7-9w$, maximized at $1/5$, giving $26/5$. Continuity and connectedness give the entire interval $[-29/5,26/5]$. Using the left weight for the lower bound and the right weight for the upper would incorrectly return $[4/5,-1/5]$.

For the service audit, the gap bounds are $60w-50$ and $70w-30$. Allowing $w\in[0,1]$ produces $[-50,40]$, which does not fit inside the original equal-weight interval $[-25,10]$. The profiles contracted but the value set expanded. The product sets are not nested, so the refinement proposition does not apply. This is not a counterexample to that proposition.

</details>

### 3. When perfect measurement cannot settle values

Consider a single known state, two feasible actions, and two criteria. Criterion 1 assigns utilities $(1,0)$ to $(A,B)$; criterion 2 assigns $(0,1)$. Calculate minimax regret with and without randomization. Can an additional costless observation of the state improve it?

<details class="solution">
<summary>Full solution</summary>

Both criterion-specific oracle values are one. Choosing A deterministically has regrets $(0,1)$; choosing B has $(1,0)$. Either worst-case regret is one. Let $p$ be the probability of A. Expected regrets are $1-p$ and $p$, so

$$
\min_{p\in[0,1]}\max\{p,1-p\}=\frac12,
\qquad p^*=\frac12.
$$

There is no factual state uncertainty to remove. A response can only induce another lottery, whose unconditional probability of A still obeys the same lower bound. Since direct randomization is already allowed, another costless state observation cannot improve the value; positive measurement cost worsens it. Learning which stakeholder criterion governs would be a different information problem. Adopting one criterion would be a normative restriction of the value set. Neither operation is implied by more precise measurement of the designs.

</details>

## A falsifiable teaching hypothesis

The pedagogical proposal is that preserving one counterexample across narrative, graph, equation, and executable calculation improves transfer in distinguishing evidence refinement, model revision, and value change. Compare that treatment with a conventional curriculum matched for content, instructional time, examples, and feedback. Randomize learners within preparation strata, or classes with cluster-aware analysis if contamination makes individual assignment unsuitable.

Preregister a primary outcome: blinded rubric scores on delayed, held-out problems from unfamiliar domains, including dependence, ordinal recoding, vetoes, and construct revision. Record baseline performance, attrition, treatment fidelity, and assessment reliability; specify the estimand and a practically meaningful effect before collecting outcomes. Report uncertainty and subgroup limits rather than selecting favorable tasks afterward. Immediate satisfaction is a secondary outcome. A precise null or harmful transfer would count against the proposed benefit. This page establishes neither learning effectiveness nor transport to professional measurement practice.

## Sources

Narens, L., and R. D. Luce. 1986. “Measurement: The Theory of Numerical Assignments.” *Psychological Bulletin* 99(2): 166–180. [Primary author copy](https://sites.socsci.uci.edu/~lnarens/1986/NarensLuce_PsychBull_1986.pdf).

Marichal, J.-L., and P. Mathonet. 2001. “On Comparison Meaningfulness of Aggregation Functions.” *Journal of Mathematical Psychology* 45(2): 213–223. [Author manuscript](https://orbi.uliege.be/bitstream/2268/90579/1/ComparisonMeaningful.pdf).

Cronbach, L. J., and P. E. Meehl. 1955. “Construct Validity in Psychological Tests.” *Psychological Bulletin* 52(4): 281–302. [Institutional primary copy](https://meehl.umn.edu/sites/meehl.umn.edu/files/files/036constructvalidityidx.pdf).

Adcock, R., and D. Collier. 2001. “Measurement Validity: A Shared Standard for Qualitative and Quantitative Research.” *American Political Science Review* 95(3): 529–546. [Institutional repository](https://escholarship.org/uc/item/945280s6).

Borsboom, D., G. J. Mellenbergh, and J. van Heerden. 2004. “The Concept of Validity.” *Psychological Review* 111(4): 1061–1071. [Institutional record](https://dare.uva.nl/id/45c23710-9842-4ec9-a7ac-eee24bce2a20).

Newey, W. K., and J. L. Powell. 2003. “Instrumental Variable Estimation of Nonparametric Models.” *Econometrica* 71(5): 1565–1578. [Primary author manuscript](https://eml.berkeley.edu/~powell/npiv.pdf).

Manski, C. F. 2025. “Identification and Statistical Decision Theory.” *Econometric Theory* 41: 977–993. [Primary manuscript and publication metadata](https://arxiv.org/abs/2204.11318).

Brooks, B., A. Frankel, and E. Kamenica. 2024. “Comparisons of Signals.” *American Economic Review* 114(9): 2981–3006. [Primary author manuscript](https://benjaminbrooks.net/downloads/bfk_comparisons.pdf).

Rosenthal, M. 2026. “Prior-free Blackwell.” *Economic Theory Bulletin* 14, article 4. [Published primary paper](https://link.springer.com/content/pdf/10.1007/s40505-026-00307-6.pdf).

Holmstrom, B., and P. Milgrom. 1991. “Multitask Principal-Agent Analyses: Incentive Contracts, Asset Ownership, and Job Design.” *Journal of Law, Economics, and Organization* 7, special issue: 24–52. [Primary author copy](https://web.stanford.edu/~milgrom/publishedarticles/Multitask%20Principal%20Agent.pdf).
