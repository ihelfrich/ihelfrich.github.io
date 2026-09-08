---
title: 'Make a decision the evidence can support'
order: 12
part: 'Generalize'
description: 'Translate effects into a constrained decision, distinguish sensitivity from sampling uncertainty, and assemble an auditable empirical argument.'
question: 'How strong must the evidence be before the firm should pay for training?'
prerequisites: 'Treatment effects, identification, uncertainty, heterogeneity, and target populations.'
minutes: 30
---

## A coefficient does not sign the purchase order

Training may raise output and still cost more than it produces. It may benefit one group while harming another. It may work in a small voluntary pilot and fail when every office adopts it.

A decision therefore needs an action set, a target population, a consequence model, and an objective. These inputs are partly empirical and partly substantive. Writing them down prevents a significance threshold from making choices it was never designed to make.

## Start with one transparent decision

Suppose the firm can train or not train an employee. Continuing the synthetic example from chapter 8 and the design experiment, training costs \$300 and each additional output unit contributes \$100 after variable production costs. Let $\tau$ be the average output effect in the target population. Expected incremental net benefit is

$$
B(\tau)=100\tau-300.
$$

For a risk-neutral firm maximizing this stated monetary objective, training is preferable when $\tau>3$. The threshold is an economic quantity. It need not coincide with zero, and statistical significance against zero does not answer the decision question.

This small model assumes costs and margins are known, output effects convert into contribution at the stated rate, and the action creates no omitted consequences. Those are simplifying assumptions, not facts about an actual company.

## Point estimates, sets, and distributions

An estimate $\hat\tau=6$ implies an estimated net benefit of \$300. Suppose, however, that the observable population contrast is 6 and allowed failures of parallel trends are bounded by $M=4$. The population identification region is then $\mathcal T=[2,10]$. The corresponding net-benefit region is $[-100,700]$ dollars.

Three objects must stay separate:

- A **population identification region** contains effects consistent with the observable distribution and maintained restrictions.
- A **confidence set** accounts for sampling variation and has a specified repeated-sampling guarantee under its assumptions.
- A **posterior distribution** represents uncertainty conditional on an explicit probability model and prior.

None automatically supplies the others. A simple bound computed around a sample estimate is a sensitivity display until its sampling properties are justified. Calling the lowest displayed endpoint a “95% worst case” would mix different constructions.

## Derive two robust decision rules

For a finite action set, a maximin decision maximizes the lowest utility over the maintained parameter set. With utilities $U(\text{train},\tau)=100\tau-300$ and $U(\text{skip},\tau)=0$,

$$
\min_{\tau\in[2,10]}U(\text{train},\tau)=-100,
\qquad \min_{\tau\in[2,10]}U(\text{skip},\tau)=0.
$$

Maximin therefore chooses to skip. This is a decision rule reflecting extreme caution over the permitted set, not a theorem that skipping is optimal under every preference.

Regret measures the loss relative to the action that would be best if $\tau$ were known:

$$
R(a,\tau)=\max_{a'}U(a',\tau)-U(a,\tau).
$$

For training, maximum regret over $[2,10]$ is \$100, attained at $\tau=2$. For skipping, maximum regret is \$700, attained at $\tau=10$. Among these two deterministic actions, **minimax regret** chooses training. Both calculations use the same evidence. They differ in the criterion applied to uncertain consequences. Allowing randomized actions would change the optimization problem again.

```python
# Two deterministic actions, a synthetic effect interval, known costs.
lower, upper, margin, cost = 2, 10, 100, 300
low_net, high_net = margin * lower - cost, margin * upper - cost
worst_utility = {"train": low_net, "skip": 0}
worst_regret = {"train": max(0, -low_net), "skip": max(0, high_net)}
print(max(worst_utility, key=worst_utility.get))  # skip
print(min(worst_regret, key=worst_regret.get))   # train
```

## Partial identification can still settle an action

An imprecisely identified parameter need not prevent a robust choice. If stronger evidence yields $\mathcal T=[4,10]$, every allowed effect exceeds the three-unit threshold. Conversely, $\mathcal T=[1,2]$ puts every allowed effect below it. The question “which action survives all permitted values?” may have a clear answer when “what is the exact effect?” does not.

Partial identification also arises without a chosen sensitivity bound. Suppose an outcome is binary, half the target population is treated, treated outcomes average 0.8, and untreated outcomes average 0.4. Without treatment exchangeability, the unobserved mean untreated outcome for treated people can range from 0 to 1, as can the unobserved treated outcome for untreated people. Therefore

$$
E[Y(1)]\in[0.4,0.9],\qquad E[Y(0)]\in[0.2,0.7],
$$

yielding the no-assumptions ATE bounds $[-0.3,0.7]$ under consistency and the stated outcome support. The observed mean difference of 0.4 is only one compatible effect. New restrictions can narrow the set; name what supplies each restriction.

## Learning whom to train

With measured heterogeneity, let $\pi(X)\in\{0,1\}$ be a training rule and $\tau(X)$ a conditional average effect. If net value is separable across employees, a simple welfare target is

$$
V(\pi)=E[\pi(X)\{v(X)\tau(X)-c(X)\}],
$$

possibly subject to a budget such as $E[\pi(X)c(X)]\leq B$. Here $v(X)$ is contribution per output unit, $c(X)$ cost, and $B$ the per-person budget.

Uncertain effects, constrained rules, and unequal costs make ranking employees by estimated effects alone unreliable. A rule selected for high estimated value on the same data can capitalize on estimation noise. Policy evaluation requires an identified value, an appropriate evaluation design, and control of the complexity of the candidate rules. [Athey and Wager](https://arxiv.org/abs/1702.02896) develop policy learning with semiparametric scores under explicit assumptions.

## Scaling can change the model

Training employees may affect coworkers, wages, customer allocation, and managers' time. With interference, potential outcomes can depend on a whole assignment vector: $Y_i(\mathbf D)$. The pilot's individual effect need not identify the effect of company-wide adoption. Define exposure mappings or assignment-level interventions and design the study accordingly.

At larger scales, prices or equilibrium behavior may change. A structural model can express those responses, but its counterfactual predictions inherit assumptions about preferences, constraints, information, and policy invariance. Calibration or close fit to historical outcomes does not by itself identify a new-policy counterfactual.

## Build the capstone as an argument

Produce a two-page decision memo and an executable appendix. Include the target action and population; a data dictionary and provenance record; the estimand; a rival explanation; the design and its weakest assumption; an estimate with the right uncertainty calculation; sensitivity and a decision-reversal threshold; and an account of who might be harmed or omitted. The appendix should regenerate every reported number and label synthetic inputs clearly.

An employer can inspect analytical judgment in that package. A student can see exactly where an objection changes the conclusion. Neither audience needs unsupported claims that the analysis is definitive.

## Try the argument

**1.** Costs rise to \$700 while margin remains \$100. What happens to the threshold and the decision at a known effect of 7?

<details class="solution"><summary>Work through the solution</summary>

The threshold becomes $700/100=7$. At exactly 7, incremental monetary benefit is zero, so the stated objective is indifferent. A positive sampling estimate or a p-value against zero does not alter this arithmetic.

</details>

**2.** Derive the binary-outcome ATE bounds above directly from the missing potential outcomes.

<details class="solution"><summary>Work through the solution</summary>

Let $a=E[Y(1)\mid D=0]$ and $b=E[Y(0)\mid D=1]$, each in $[0,1]$. Then $ATE=0.5(0.8+a)-0.5(b+0.4)=0.2+0.5(a-b)$. Its extrema are $-0.3$ and $0.7$.

</details>

## A current research question

[Kolesár, Montiel Olea, and Roth's March 2026 working paper](https://www.jonathandroth.com/assets/files/EvaluatingCounterfactualsWithIV.pdf) studies bounds for counterfactual assignment policies using instruments. Its lesson for this course is a question worth retaining: does the policy require the same target as the familiar IV coefficient? This is current research, not a substitute for the conditions developed in the preceding chapters. The web edition is a compact starting course and a reading path into that work, not a complete graduate sequence.
