---
title: 'Economic questions, useful predictions, and interventions'
order: 1
part: 'Objects and foundations'
description: 'Six possible days explain how a good forecast can leave the effect of an intervention unresolved. Complete finite proofs and independent Python, Julia, and R calculations.'
question: 'An alert predicts higher electricity demand. Would sending an alert change that demand?'
prerequisites: 'Addition, multiplication, and fractions. Every additional symbol is defined here.'
updated: 2026-10-09
codeStem: alert-worlds
verificationFile: verification.json
anchors:
  orientation: forecast-meeting
  core: finite-averages
  theory: identification-proof
  workshop: workshop
---

<span id="forecast-meeting"></span>
## ○ Orientation: The forecast meeting

A utility sends an alert when it expects a hot day. The alert asks customers to reduce electricity use. Its records show higher peak demand on days with alerts. One analyst wants to use the alert to predict tomorrow's demand. Another wants to know whether sending more alerts would reduce demand. A manager needs to decide whether the reduction would cover the program's cost.

All three questions concern the same two columns. Each requires a different argument. An alert may carry useful information about heat and still reduce the demand that heat would otherwise produce. The demand observed after an alert does not reveal the demand that the same day would have had without it.

We will build a small economy in which every possibility can be written down. It is a controlled example, with invented numbers and known mechanisms. The [observed Texas electricity case](/time-series/projects/#a-complete-public-case-texas-residential-electricity-sales) uses actual provider data for forecasting; this chapter does not estimate an alert effect from those data.

Our example has six possible kinds of day. Working with six makes the reasoning inspectable. The central difficulty will survive when the number of recorded days grows.

<span id="question-contract"></span>
## ○ Orientation: What would count as an answer?

An **observation** is a recorded value, such as a day's peak demand. A **population** is the collection of days or units the question concerns. A **target** is the quantity we want to learn about that population. A target stated mathematically is often called an **estimand**. An **estimator** is a calculation that uses recorded observations to estimate it. An **estimate** is the number produced by that calculation.

Suppose tomorrow's alert is known before the demand forecast is made. A forecasting question asks for average demand among days with that alert status. An intervention question asks how demand would change if we assigned the alert status, keeping the day and the specified background conditions comparable. A decision question adds costs, benefits, constraints, and whose interests count.

Before calculating, write a short question contract:

| Item | Forecast | Intervention |
|:--|:--|:--|
| Population | Days served by this utility under the current alert rule | Those same days under an assigned alert rule |
| Outcome | Daily peak load, measured in megawatts (MW) | The same peak-load measure |
| Target | Average load given the available alert status | Average load if an alert is assigned, compared with no alert |
| Information | The issued alert; load has not yet occurred | An explicit model or design for assigning the alert |
| Horizon | Tomorrow's daily peak | The daily peak following the assigned alert |
| Error or value | Squared forecast error, in MW² | A specified value of avoided peak load, less program cost |
| Permissible claim | A prediction under the stated information and population | A response under the stated intervention and assumptions |

The outcome definition needs care. **Power**, measured in MW, is a rate of energy use. **Energy**, measured in megawatt-hours, accumulates over time. The same distinction appears between water flowing through a tap and water accumulated in a tank: the flow rate and the accumulated quantity answer different questions. A day's peak power does not give its total energy use. We will keep MW throughout the load calculations. The [unit check](#three-languages) deliberately converts MW to kilowatts and shows why squared error scales by a million.

The contract also records when information becomes available. An alert known after the peak cannot serve as an input to tomorrow's forecast. The time-series chapter's [reference-time and release-time distinction](/time-series/01-information/#a-series-has-more-than-one-date) explains this timing issue in detail. Here the alert is available beforehand by construction.

<span id="six-days"></span>
## ○ Orientation: Six possible days

Let $U$ indicate an unrecorded heat condition: $U=0$ for an ordinary day and $U=1$ for a hot day. Each has probability one half. Let $V$ be a demand shock, in MW, taking values $-1$, $0$, and $1$ with equal probability. We assume the heat condition and shock are **independent**: knowing one does not change the probabilities of the other. Every pair in the table therefore has probability $(1/2)(1/3)=1/6$.

Let $A$ indicate the alert: zero means no alert and one means an alert. The current rule is $A=U$. In this example the utility's internal heat condition is absent from the analyst's records. The analyst sees only $A$ and peak load $Y$.

| Day type | Heat condition $U$ | Shock $V$, MW | Alert $A$ | Observed load $Y$, MW | Probability |
|:--|--:|--:|--:|--:|:--|
| 1 | 0 | −1 | 0 | 9 | 1/6 |
| 2 | 0 | 0 | 0 | 10 | 1/6 |
| 3 | 0 | 1 | 0 | 11 | 1/6 |
| 4 | 1 | −1 | 1 | 11 | 1/6 |
| 5 | 1 | 0 | 1 | 12 | 1/6 |
| 6 | 1 | 1 | 1 | 13 | 1/6 |

These rows list possibilities and their probabilities. They are not six sampled observations. A randomly recorded sequence of days could contain one type repeatedly and omit another. Enumeration gives exact population calculations for this declared model; it does not eliminate sampling uncertainty in an empirical study.

<picture><source media="(max-width: 800px)" srcset="/handbook/figures/alert-worlds-stacked.svg" /><img src="/handbook/figures/alert-worlds.svg" alt="Six possible observed days. Without an alert, load is 9, 10, or 11 MW; with an alert, it is 11, 12, or 13 MW. A second panel shows that the average load under an assigned alert can fall, stay level, or rise while those observations remain identical." /></picture>

**Figure 1.** The first panel is common to every mechanism below. The second panel compares population averages under assigned alert status; each line uses the same distribution of heat conditions and shocks. The line labels give the intervention effect in MW. The [intervention calculation](#intervention) explains each endpoint.

<span id="finite-averages"></span>
## ◇ Core: Averages with stated information

Write $p_i$ for the probability of day type $i$ and $y_i$ for its load. The symbol $\sum$ means “add the following terms over the listed day types.” The **expectation** of load is the probability-weighted average:

$$
E[Y]=\sum_{i=1}^{6}p_i y_i
=\frac{9+10+11+11+12+13}{6}=11\text{ MW}.
$$

The square brackets identify the quantity being averaged. They do not mean that a sampled average must equal eleven.

To **condition** on an alert, retain the three alert-day possibilities and give them probabilities that add to one. Their original probabilities add to $3/6=1/2$. Each retained probability becomes $(1/6)/(1/2)=1/3$. Thus

$$
E[Y\mid A=0]=\frac{9+10+11}{3}=10,
\qquad
E[Y\mid A=1]=\frac{11+12+13}{3}=12.
$$

The vertical bar means “given.” The difference of these conditional averages is $12-10=2$ MW. It describes two groups of days selected by the existing alert rule. We have not yet calculated what changing that rule would do.

The rule $m(A)=10+2A$ gives the correct conditional average for either alert status. The letter $m$ names a function: insert zero to obtain ten, or one to obtain twelve. Its error is $Y-m(A)=V$, so the error takes values $-1$, $0$, and $1$ equally often in each group. The **mean squared error**, or MSE, is the average squared error:

$$
E[(Y-m(A))^2]=\frac{(-1)^2+0^2+1^2}{3}=\frac23\text{ MW}^2.
$$

The model contains unpredictable variation even when its conditional average is known exactly. Prediction accuracy concerns the declared information and loss; it does not establish an intervention effect.

<span id="forecast-proof"></span>
## ◇ Core: Why the conditional average minimizes squared error

**Result 1.** Within this six-day model, among all forecasts that use only $A$, the function $m(A)=E[Y\mid A]$ uniquely minimizes population mean squared error. Both alert groups have positive probability, so uniqueness applies to each of the two forecast values.

The proof has five steps and uses no calculus.

1. **Fix the information.** Choose an alert value $a$, either zero or one, and let $q$ be a proposed forecast for that group. Write $m_a$ for its conditional average: $m_0=10$ and $m_1=12$, as established in [the finite-average calculation](#finite-averages). Add and subtract $m_a$:

   $$
   Y-q=(Y-m_a)+(m_a-q).
   $$

2. **Expand the squared error.** Multiplying $(r+s)(r+s)$ gives $(r+s)^2=r^2+2rs+s^2$. Apply that identity to the two terms above, then average within the group:

   $$
   \begin{aligned}
   E[(Y-q)^2\mid A=a]
   &=E[(Y-m_a)^2\mid A=a]\\
   &\quad+2(m_a-q)E[Y-m_a\mid A=a]+(m_a-q)^2.
   \end{aligned}
   $$

   Constants can be taken outside a finite weighted sum because each term contains the same factor.

3. **Remove the cross term.** By the definition of $m_a$, the average deviation from it is zero:

   $$
   E[Y-m_a\mid A=a]=E[Y\mid A=a]-m_a=0.
   $$

   The middle term in step 2 therefore vanishes. Using the residual average square calculated in [Averages with stated information](#finite-averages) leaves

   $$
   E[(Y-q)^2\mid A=a]=\frac23+(m_a-q)^2.
   $$

4. **Locate the minimum within the group.** The first term is the irreducible error. The second is a square, which is nonnegative and equals zero exactly when $q=m_a$. This proves the claim within either alert group.

5. **Average across groups.** For an arbitrary two-value forecast $g$, weight the two group errors by their probabilities of one half:

   $$
   E[(Y-g(A))^2]
   =\frac23+\frac12(10-g(0))^2+\frac12(12-g(1))^2.
   $$

   Both extra terms must vanish to attain $2/3$. A constant eleven-MW forecast pays an extra $(1/2)(1)^2+(1/2)(-1)^2=1$ MW², giving MSE $5/3$.

The alert is useful for this prediction. The proof has said nothing about the consequence of assigning one.

Every average here is finite and has positive conditioning probability. For an unrestricted random outcome, the corresponding squared-error argument requires a finite second moment. The existing course's [conditional-forecast proof](/time-series/01-information/#why-conditional-expectation-solves-this-loss) gives the general version; the calculation above supplies its finite foundation.

<span id="same-observations"></span>
## ◇ Core: Several mechanisms, identical observations

We now specify how load responds to an alert and a heat condition. A **structural equation** describes that response together with the rule generating the alert. Consider the following family:

$$
A=U,\qquad
Y=10+bA+(2-b)U+V,\qquad -2\leq b\leq2.
$$

The parameter $b$ measures the load response, in MW, to changing $A$ from zero to one while keeping $U$ and $V$ fixed. The coefficient $2-b$ measures the heat contribution in this family. The parameter range is part of the example's model class; it is not a confidence interval inferred from observations. It keeps all of the assigned-alert loads positive in our six day types.

The family keeps the following assumptions explicit:

- The current operating rule is $A=U$.
- The six background states and their probabilities are the ones in [Six possible days](#six-days), including independence of heat and the shock.
- The load equation applies across both assigned alert values. Assignment does not change the background distribution or add another causal pathway.
- The model class permits $-2\leq b\leq2$. The data do not supply that restriction.

Substitute $A=U$ into the load equation:

$$
Y=10+bU+(2-b)U+V
=10+\{b+(2-b)\}U+V
=10+2U+V.
$$

The first equality uses the alert rule. The second collects terms multiplying the same heat indicator. The third uses $b+2-b=2$. The resulting observed equation contains no $b$.

This cancellation holds separately for every row, not merely for an average or correlation. Changing $b$ leaves every observed pair $(A,Y)$ unchanged. Since each row also retains probability $1/6$, the entire observable probability distribution is unchanged. Such mechanisms are **observationally equivalent** for these records.

In a world with $b=-2$, the alert reduces load by two MW while the heat contribution is four MW. With $b=0$, the alert has no effect and heat contributes two MW. With $b=2$, the alert increases load by two MW and the direct heat contribution in this simple equation is zero. All three worlds produce the table in [Six possible days](#six-days).

The example establishes a logical possibility. It does not claim that the third mechanism describes any particular utility or that real demand has this simple form. Restrictions excluding a mechanism must have a substantive or design justification. An observed alert–load association alone cannot provide it.

<span id="intervention"></span>
## ◇ Core: Assigning the alert

An intervention replaces the rule generating the variable being assigned. For $\operatorname{do}(A=a)$, replace $A=U$ by $A=a$. Keep the load equation, the six heat–shock possibilities, and their probabilities fixed. This definition specifies what remains comparable across the two assignments. It assumes that the assignment itself has no additional effect outside the stated equation.

Under that intervention the load of a day with condition $u$ and shock $v$ is

$$
Y(a;u,v)=10+ba+(2-b)u+v.
$$

The notation before the semicolon gives the assigned alert; the notation after it identifies the same background day. For each day,

$$
Y(1;u,v)-Y(0;u,v)
=[10+b+(2-b)u+v]-[10+(2-b)u+v]=b.
$$

All shared terms cancel. The difference is the same across the six types because this model assumes a constant alert response. Averaging a constant leaves it unchanged, so the population intervention effect is also $b$.

To calculate the two intervention levels, use $E[U]=1/2$ and $E[V]=(-1+0+1)/3=0$. Linearity follows by distributing and regrouping their finite weighted sums:

$$
E[Y\mid\operatorname{do}(A=a)]
=10+ba+(2-b)\frac12+0
=11+b\left(a-\frac12\right).
$$

| Mechanism | Assigned no alert, MW | Assigned alert, MW | Intervention difference, MW | Observed group difference, MW |
|:--|--:|--:|--:|--:|
| $b=-2$ | 12 | 10 | −2 | 2 |
| $b=0$ | 11 | 11 | 0 | 2 |
| $b=2$ | 10 | 12 | 2 | 2 |

Conditioning on $A=1$ selects only hot days under the old rule. Assigning $A=1$ retains both ordinary and hot days in the population. That change in which backgrounds are being compared explains the different answers. The [finite-average calculation](#finite-averages) and the intervention definition together identify exactly where the two operations diverge.

The intervention convention is established causal-inference machinery. Pearl, Glymour, and Jewell's [*Causal Inference in Statistics: A Primer*, §3.1, printed pp. 53–55](https://bayes.cs.ucla.edu/PRIMER/primer-ch3.pdf#page=1) explains equation replacement and conditioning; our finite utility example and calculations are authored here. The chapter links to their text and does not redistribute it.

The [assignment experiment](/handbook/01-questions/#alert-experiment) lets you choose a mechanism, predict the direction of the comparison, and then inspect the two means and all six day types. Change the mechanism and explain why the observed comparison stays fixed. The table above and [worked exercise 1](#workshop) give the same investigation in print.

<span id="sensors"></span>
## ○ Orientation: A warning as information and an action

A sensor warning offers a useful connection outside economics. Suppose a machine has a high-heat state $U$ and a display records it as $A=U$. If the display is isolated from the machine's thermal process and nobody changes the machine in response to it, changing only the display has no effect on the machine's temperature. That claim depends on the stated isolation and absence of feedback. It does not follow from an association between the display and temperature.

The sensor and utility examples share the assignment relation $A=U$. In both, observing the warning selects a background state. The utility alert also asks people to act, so the load equation allows a response to $A$. Replacing the display in the isolated sensor example and sending a demand-response alert therefore require different substantive restrictions, even though their observational calculations have the same form. The equation-replacement definition in [Assigning the alert](#intervention) identifies the common mathematical operation and the mechanism that must be specified separately.

A second connection concerns dynamics. Consider a specified physical relaxation model in which a fixed fraction $\phi$, with $0<\phi<1$, of a deviation from a fixed reference temperature remains after each equal sampling interval. Its gap satisfies $x_{k+1}=\phi x_k$. Repeated substitution gives $x_k=\phi^k x_0$: each interval multiplies the previous gap by the same fraction. These assumptions exclude changing reference temperatures and multiple interacting relaxation modes. The course's [difference-equation derivation](/time-series/02-dynamics/#solve-the-difference-equation) applies the same multiplication rule to an economic deviation and then accounts for additional disturbances. Economic persistence needs its own interval, disturbance model, and interpretation; the shared recursion alone does not establish a thermal explanation for an economic series.

<span id="identification-proof"></span>
## ◆ Theory: What the records cannot identify

**Definition.** A target is **identified** in a model class if every mechanism in that class yielding the same observable distribution gives the same target value. The phrase “in a model class” matters: observations and restrictions jointly determine identification.

**Result 2.** In the family $-2\leq b\leq2$ specified in [Several mechanisms](#same-observations), the alert's population intervention effect is not identified from $(A,Y)$. Its identified set is the entire interval $[-2,2]$.

**Proof.** The row-by-row substitution in [Several mechanisms](#same-observations) proves that every allowed $b$ gives the same observable distribution. The paired intervention calculation in [Assigning the alert](#intervention) proves that the target equals $b$. Every value in the allowed interval is therefore compatible with the records, and no value outside it is admitted by this model class. Those two facts establish the identified set. In particular, the effects $-2$ and $2$ disagree despite identical observations. This violates the definition of point identification.

**Result 3.** Under independent sampling of days from this same observational distribution, no estimator using only those records can consistently estimate $b$ for every mechanism in this family.

“Independent sampling” means each draw has the six probabilities and learning one day's type does not change another's probabilities. “Consistently” means that, as the number $n$ of recorded days grows, the probability of an estimation error larger than any specified positive tolerance approaches zero. Let $T_n$ denote the estimator, including any internal randomness independent of the data and having the same distribution in every mechanism.

**Proof.** Consider the worlds $b=-2$ and $b=2$. They give identical distributions for one observed day. Under the stated sampling rule they give identical distributions for every $n$-day dataset, because the probability of a particular sequence is the product of the same per-day probabilities. Applying the same estimator with the same independent randomization preserves equality of output distributions. Call that shared distribution $Q_n$.

Take the tolerance to be one MW. Consistency in the first world would require

$$
Q_n\{|T_n+2|<1\}\longrightarrow1.
$$

Consistency in the second would require

$$
Q_n\{|T_n-2|<1\}\longrightarrow1.
$$

The braces specify events, or sets of possible estimator outputs. The first requires $-3<T_n<-1$; the second requires $1<T_n<3$. These intervals are disjoint. For every $n$, the probabilities of disjoint events add, and their sum is at most one. They cannot both approach one, since their sum would then approach two. This contradiction proves the result.

The proof concerns a declared sampling and model class. A new experiment, additional defensible restrictions, or new observations of relevant mechanisms can change the class or the available information. More records drawn from the unchanged observational process improve knowledge of that process; they do not distinguish the two worlds used in the proof.

Merely recording $U$ also fails to supply the missing comparison here. Within $U=0$, the old rule always gives $A=0$; within $U=1$, it always gives $A=1$. The other alert status has probability zero in each stratum. A conditional average for that absent status is not available from this design. This is a failure of **overlap**, the availability of both comparison conditions in the relevant population strata.

<span id="new-design"></span>
## ◇ Core: A design that supplies the missing comparison

Consider a controlled experiment in which a fair, independent coin assigns $A$. Keep the heat and shock probabilities and the load equation fixed. Each of the twelve triples $(A,U,V)$ now has probability $1/12$.

For either assigned alert status, the two heat conditions remain equally likely and the three shocks retain their original probabilities. Thus

$$
E[Y\mid A=a]
=10+ba+(2-b)E[U\mid A=a]+E[V\mid A=a]
=11+b\left(a-\frac12\right).
$$

The first equality averages the specified load equation. The second uses independence of the randomized alert from both background variables, giving conditional averages $1/2$ and zero. Subtracting the average at $a=0$ from the one at $a=1$ leaves $b$. Both groups have positive probability. The experimental comparison therefore identifies the effect in this model.

Random assignment supplies comparable background distributions; maintaining the same load equation supplies the link to the intervention target. Real experiments must also define the treatment, handle noncompliance and missing outcomes, and consider interference between units. An alert sent to one region may affect neighboring demand. Those questions need an expanded model and are not resolved by this twelve-state demonstration.

Hernán and Robins's [*Causal Inference: What If*, chapters 1–3](https://miguelhernan.org/whatifbook) develops causal effects, randomized experiments, and observational studies through potential outcomes. Its framework gives another precise way to state the comparisons used here. The [chapter source register](/handbook/source-register.json) records the particular sections, use, and reading scope of both references.

<span id="decision"></span>
## ◇ Core: A prediction and a recommendation

Suppose a planner values an expected one-MW reduction in the daily peak at $v$ dollars and pays $c$ dollars to issue an alert. Under a deliberately simple linear valuation, the incremental net benefit is

$$
N(b)=v\{E[Y(0)]-E[Y(1)]\}-c=-vb-c.
$$

The braces contain a reduction, so its sign is the negative of the load effect $b$. Let $v=1{,}000$ dollars per MW of daily peak reduction and $c=500$ dollars per day. Then $N(-2)=1{,}500$, $N(0)=-500$, and $N(2)=-2{,}500$ dollars per day. The same observed distribution is compatible with a profitable alert program and an unprofitable one under this valuation.

This calculation is a stated decision rule, not a complete welfare analysis. A utility's avoided capacity cost, customer inconvenience, distributional effects, and system reliability need their own quantities. Even a causal peak-load estimate would not by itself settle those choices.

For the current forecasting task, the conditional-average forecast remains valid in all three worlds. For the intervention decision, the records leave the sign unresolved. A professional memo should preserve both conclusions. It can recommend the forecast for the defined information set while explaining what evidence the alert decision still needs.

<span id="three-languages"></span>
## ◇ Core: One declared calculation in three languages

The [six-state input file](/handbook/code/data/alert-days.csv) contains heat, shock, and an integer probability weight. The six weights add to six; dividing each by that sum produces the probabilities used above. It contains no empirical utility observations. Its [input manifest](/handbook/code/data/manifest.json) records the schema, units, generator, and file hash.

Independent [Python](/handbook/code/alert-worlds.py), [Julia](/handbook/code/alert-worlds.jl), and [R](/handbook/code/alert-worlds.R) programs enumerate the same states. Each calculates the observed row values, conditional means, squared-error decomposition, assigned-alert means, randomized-design means, and decision value. The implementation also evaluates $b=-1$ and $b=1$ between the three plotted mechanisms. Those five values are numerical checks within the continuous family; the algebraic proof covers the full interval.

For example, the Python operation for an assigned alert is `10 + b*a + (2-b)*u + v`. The Julia and R versions implement their own enumeration and weighting. None reads another language's output as its answer. The [verification program](/handbook/code/verify.py) runs the three programs, compares their results, and checks independent analytic targets and row invariants. The [checked results](/handbook/code/results/verification.json) identify the actual native runtimes. This is computational verification of specified finite calculations. The mathematical proof is the separate argument in [Results 2 and 3](#identification-proof).

Converting load from MW to kW multiplies each load and forecast error by $1{,}000$. Squaring gives $1{,}000^2=1{,}000{,}000$, so forecast MSE becomes $(2/3)\times1{,}000{,}000$ kW². The intervention difference becomes $1{,}000b$ kW. A reported MSE that rises only a thousandfold has mixed up the unit of an error with the unit of its square. Each program checks this conversion explicitly.

The [execution guide](/handbook/code/README.md) gives commands and the scope of the checks. These are native programs; the page does not execute Python, Julia, or R in the browser.

<span id="workshop"></span>
## ✦ Workshop: Diagnose and repair a claim

The following are worked exercises for this chapter's controlled model. They are not claims of new research results. Write your argument before reading the solutions.

1. **A mechanism between the plotted cases.** Set $b=-1$. Calculate the observed group difference and the two assigned-alert means. Does a positive observed difference rule out a load-reducing alert?

   **Solution.** The observed equation is still $Y=10+2U+V$, so the group difference remains two MW. The formula in [Assigning the alert](#intervention) gives $11+(-1)(0-1/2)=11.5$ MW without the assigned alert and $11+(-1)(1-1/2)=10.5$ MW with it. The effect is $-1$ MW. Thus the observed two-MW difference coexists with a one-MW reduction under intervention.

2. **A less useful forecast.** A forecast reports nine MW when $A=0$ and thirteen MW when $A=1$. Calculate its MSE without listing all six squared errors.

   **Solution.** Use the decomposition proved in [Result 1](#forecast-proof). Its extra error is $(1/2)(10-9)^2+(1/2)(12-13)^2=1$ MW². Adding the unavoidable $2/3$ gives $5/3$ MW². This equals the error of the constant eleven-MW forecast despite using the alert. Using an informative variable does not guarantee that a particular forecasting rule uses it well.

3. **A proposed statistical repair.** An analyst obtains the previously unrecorded heat indicator and proposes comparing alert and non-alert days within each heat category. Which needed cells are absent?

   **Solution.** Under $A=U$, the pair $(U=0,A=1)$ never occurs and the pair $(U=1,A=0)$ never occurs. The proposed comparisons require averages in these zero-probability cells. [The overlap discussion](#identification-proof) explains why measuring a variable and having variation conditional on it are separate requirements. The independent assignment in [A new design](#new-design) supplies all four heat–alert combinations.

4. **A decision threshold.** Under the linear valuation $v=1{,}000$ and $c=500$, which values of $b$ give positive net benefit? Is that condition identified from the old records?

   **Solution.** Solve $-1{,}000b-500>0$: add five hundred to both sides to obtain $-1{,}000b>500$, then divide by a negative number, reversing the inequality, to get $b<-0.5$. The identified set $[-2,2]$ contains values on both sides of this threshold. The sign of net benefit therefore remains unresolved under the stated model class and valuation.

5. **A stronger statement than the evidence allows.** Rewrite “alerts increase demand by two MW, so cancel them.” Include the useful finding and the unanswered question.

   **Solution.** “Under the existing alert rule, alert days have two MW higher mean peak load. The alert improves a conditional-average forecast in the six-state model. These records do not identify the load response to assigning an alert; the defined model class admits effects from −2 to 2 MW. An alert recommendation requires an assignment design or justified restrictions, together with the cost and benefit model.”


<span id="handoff"></span>
## ○ Orientation: The professional handoff

A short memo can state the question, the result, its scope, and the next evidence needed without burying the distinction in technical language:

> The alert is useful for predicting daily peak demand under the current operating rule. In the controlled model, mean peak load is ten MW without an alert and twelve MW with an alert, and the conditional-average forecast has mean squared error of two thirds MW². The same records are compatible with alerts reducing, preserving, or increasing demand. They therefore do not support a recommendation to expand or cancel the alert program. A comparable assignment design would address the intervention question. Program costs and the value of avoided load must be assessed separately.

Attach the [question contract](#question-contract), the [input manifest](/handbook/code/data/manifest.json), and the [calculation checks](/handbook/code/results/verification.json). Link the claim about forecast accuracy to [Result 1](#forecast-proof), the identification limit to [Results 2 and 3](#identification-proof), and the proposed assignment design to [its explicit conditions](#new-design). This makes the memo traceable for both a manager and another analyst.

The same discipline will recur when an area-level quantity is used to make a claim about a person, a noisy score is used to measure a skill, or a forecast is used to choose a policy. First name the economic object and the comparison. Then establish what the observations and assumptions allow us to learn.
