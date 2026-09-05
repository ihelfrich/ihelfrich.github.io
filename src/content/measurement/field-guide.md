---
title: A field guide to defensible measurement
description: Work through a service-design decision, distinguish evidence from trade-offs, and test which numerical conclusions survive your assumptions.
order: 2
---

The [opening essay](/econometrics/measurement/story/) follows a hypothetical university choosing between two support-service designs. A offers faster access with more constrained choices. B gives participants more control but takes longer to arrange. This guide turns that problem into a calculation you can inspect and challenge.

You need averages, inequalities, and ordinary algebra. The [technical companion](/econometrics/measurement/technical/) develops the identification and decision-theoretic details.

## Begin with a claim you could defend

Write the proposed conclusion before opening a spreadsheet: **Under what evidence and priorities would A be preferable to B?**

Then separate three questions. What features of each service have been observed? How do those features support a judgment about access or participant control? How should the two dimensions enter a decision?

A log of completed appointments could help answer the first question. It might miss abandoned attempts. A rubric connecting log entries and service features to access addresses the second question. A weighting rule addresses the third. None of these steps automatically validates the next.

For a real investigation, each dimension needs a construct definition, anchors, a target population, an observation procedure, and a record of exclusions. Check whether repeated assessments agree, but also whether agreement concerns the intended object. Two reviewers can consistently apply an inadequate rubric.

Here we assume comparable 0–100 scenario rubrics with meaningful score differences and a preference for higher values. They are invented teaching scales. They do not measure actual students' autonomy, trust, dignity, or worth.

## Work the decision in full

The information supplied by the exercise is:

| Design | Access | Participant control |
|---|---:|---:|
| A | 75 to 85 | 25 to 45 |
| B | 45 to 65 | 65 to 85 |

Each interval lists compatible values. No probabilities have been assigned. These are neither sampling confidence intervals nor observed distributions. For this exercise, allow every combination within the four intervals. Dependence restrictions would require a different feasible set.

Let $w$ denote the weight on access, with $0\leq w\leq1$. Assume the additive decision rule

$$
V=w\times\text{access}+(1-w)\times\text{control}.
$$

This rule permits compensation between dimensions and uses constant weights. It is an assumption to inspect. A requirement that a service permit refusal, for example, might belong in an eligibility constraint instead.

Using interval centers, A's profile is $(80,35)$ and B's is $(55,75)$. At $w=0.5$,

$$
V_A=0.5(80)+0.5(35)=57.5,
\qquad V_B=0.5(55)+0.5(75)=65.
$$

The center-based gap is $57.5-65=-7.5$. It favors B. Without a distribution or another justification, the centers have no special evidential status.

Now retain every compatible profile. The smallest possible access gap is $75-65=10$; the largest is $85-45=40$. The control gap runs from $25-85=-60$ to $45-65=-20$.

Because both weights are nonnegative, the score gap $\Delta=V_A-V_B$ lies in

$$
\Delta(w)\in
\left[w(10)+(1-w)(-60),\ w(40)+(1-w)(-20)\right]
=\left[70w-60,\ 60w-20\right].
$$

The allowed endpoint combinations attain these bounds. They are exact for the stipulated rectangular set of profiles. At equal weights,

$$
\Delta(0.5)\in[-25,10].
$$

B is better in some compatible cases; A is better in others. The midpoint calculation concealed this unresolved comparison.

Try changing the priorities. At $w=0.9$, the interval is $[3,34]$: A is strictly better throughout. At $w=0.1$, it is $[-53,-14]$: B is strictly better throughout. Measurement uncertainty persists in both cases, yet the decision is robust to it.

If the weight itself ranges from $\ell$ to $h$, both endpoint formulas increase with $w$, so the full gap range is

$$
\Delta\in[70\ell-60,\ 60h-20].
$$

Allow all weights from 0 to 1 and the result is $[-60,40]$. This is a report about the evidence and permitted priorities together. It is not a probability that either design wins.

## Check whether arithmetic belongs on your scale

A separate rubric exercise assigns ordered categories: A has observations $[1,4]$ and B has $[2,3]$. Both arithmetic means are 2.5. Suppose the categories support order only, with no claim of equal gaps.

Consider strictly increasing recodings

$$
f_q(s)=\frac{s^q-1}{4^q-1},\qquad q>0.
$$

They preserve every ranking, give category 1 the value 0, and give category 4 the value 1. They do not preserve the spacing of the middle categories.

| Recoding | A's mean | B's mean | Larger mean |
|---|---:|---:|---|
| $q=0.5$ | 0.5000 | 0.5731 | B |
| $q=1$ | 0.5000 | 0.5000 | Tie |
| $q=2$ | 0.5000 | 0.3667 | A |

This familiar measurement-theory counterexample shows that order alone does not justify a conclusion based on mean differences. The unchanged pairwise rankings remain usable. Establishing a cardinal scale could license further comparisons, but that would require additional grounds.

Our earlier weighted calculation explicitly assumed meaningful score gaps. These two examples ask different questions: whether arithmetic is justified, and what follows after its justification is provisionally granted.

## Three exercises

Try each exercise before opening its solution. Use the [browser experiments](/econometrics/measurement/) to test your calculations afterward.

### 1. Keep the order; change the verdict

Calculate the recoded B mean for $q=2$ and $q=0.5$. Why can A's mean stay fixed? Then compare each A observation with each B observation. How many of the four comparisons favor A? Can that count change under the stated recodings?

<details class="solution">
<summary>Solution</summary>

For $q=2$, categories 2 and 3 become $3/15$ and $8/15$, so B's mean is $11/30\approx0.3667$. For $q=0.5$, they become $\sqrt{2}-1$ and $\sqrt{3}-1$, since the denominator is 1. Their mean is approximately 0.5731.

A always contains both anchors, 0 and 1, with mean 0.5. Of the four pairwise comparisons, A's category 1 loses twice and its category 4 wins twice. Exactly two favor A. Strictly increasing transformations preserve those four judgments. A two-out-of-four count does not establish equal value under every possible decision rule.

</details>

### 2. Find the robust decision regions

Using $[70w-60,60w-20]$, determine when A is strictly better for every compatible profile and when B is strictly better throughout. What happens at the boundaries? Explain why an interval crossing zero is different from an exact tie.

<details class="solution">
<summary>Solution</summary>

A is strictly better throughout when its worst gap is positive: $70w-60>0$, or $w>6/7$. B is strictly better throughout when A's best gap is negative: $60w-20<0$, or $w<1/3$.

At $w=6/7$, A's worst gap is zero. A is never worse under the allowed profiles, but equality is possible. At $w=1/3$, B is never worse and equality is possible. Between these boundaries, the gap takes both positive and negative values. The information does not establish an ordering. An exact tie would specify equality under the relevant rule; it would not contain possible strict advantages in opposite directions.

</details>

### 3. Decide what new evidence would change

An audit narrows A's control interval to $[30,40]$ and B's to $[70,80]$. Access intervals remain unchanged. Find the revised gap range at equal weights. Does it settle the choice? Then suppose accounts of abandoned bookings reveal that the current definition of access excludes an important barrier. Should this discovery simply narrow the existing interval?

<details class="solution">
<summary>Solution</summary>

The revised control gap is $[-50,-30]$. Therefore

$$
\Delta(w)\in[10w-50(1-w),\ 40w-30(1-w)]
=[60w-50,\ 70w-30].
$$

At equal weights this gives $[-20,5]$, contained within the original $[-25,10]$. The audit removes possibilities but leaves both signs, so the choice remains unresolved.

Under a fixed decision rule, restricting the candidate profile set cannot enlarge the range of possible score gaps. A discovery that undermines the definition of access is different: it may require replacing the observation model, revising the rubric, or expanding the target population. Document that revision. New understanding need not produce a smaller interval in the old model.

An account can expose an omitted mechanism without establishing how common it is. Follow it with a suitable sampling and observation plan. Reducing the account to positive or negative sentiment would not address the omitted barrier.

</details>

## A classroom investigation

For a 75-minute session, give students the service descriptions before revealing the profiles. Spend 10 minutes listing what a booking database would miss. Use the next 15 minutes on the ordinal recoding exercise, asking students to predict whether the mean ranking can change.

Devote 20 minutes to deriving the gap interval in pairs. Have one student seek the most favorable allowed case for A and the other seek the least favorable. Reserve 15 minutes for the audit and an account that challenges the definition of access. Students must state whether they are changing evidence, the model, or priorities. Use the final 15 minutes to write and compare decision memos.

The memo should recommend an action, state the assumptions supporting it, name an unresolved comparison, and propose one observation that could alter the recommendation. Accept a justified refusal to rank. Grade the reasoning and the handling of uncertainty, not the design selected.

For doctoral extension, ask which dependencies would make the rectangular bounds unattainable, how a sampling model would add inferential uncertainty, and how the value of another observation depends on the permitted priorities. Those are additional research questions. The interval arithmetic here supplies no theorem that answers them automatically.

The complete analysis record should let someone reconstruct the construct, observations, scale assumptions, permitted trade-offs, compatible conclusions, and remaining decision. A score without that record is difficult to challenge precisely when a challenge matters most.
