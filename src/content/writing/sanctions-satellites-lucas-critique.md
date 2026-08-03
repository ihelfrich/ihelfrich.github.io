---
title: "Sanctions, satellites, and the Lucas critique"
summary: "Why the satellite-economics literature has been quietly committing a Lucas-critique violation for a decade, and what to do about it. The intellectual setup for the Penumbra paper."
date: 2026-04-10
draft: true
tags: ["sanctions", "satellite-economics", "penumbra", "research-notes"]
---

Somewhere south of the Strait of Hormuz, a Suezmax tanker is sitting in international waters with its Automatic Identification System turned off. A smaller vessel is alongside, hoses out, transferring crude. The transfer takes ten to fourteen hours. When the smaller vessel leaves, AIS comes back on. The Suezmax goes home, low on oil, with a port call that doesn't match what any customs office could reconcile.

This is not espionage fiction. It happens hundreds of times a month. The Russian shadow fleet alone has done it on the order of two thousand vessel-pair events since 2022. Iranian crude has worked the same way since 2018. Officially, the oil isn't there. Practically, it shows up at refineries in third-party jurisdictions that don't reconcile against the original shipper's declarations. The Western sanctions regime, the Russian counter-strategy, and the third-party arbitrage profits add up to something like $100 billion a year of trade that doesn't exist in the data.

This corner of the world economy is large, growing, and (for an applied trade researcher) operationally invisible. It's also where the Penumbra program starts.

## What the satellite-economics literature was trying to do

For the past fifteen years, applied development economists have been using satellite imagery to estimate economic activity when official statistics are unreliable. The canonical paper is Vernon Henderson, Adam Storeygard, and David Weil's 2012 piece in the <em>American Economic Review</em>, "Measuring Economic Growth from Outer Space." They showed that nighttime lights, as measured by the DMSP satellite constellation, correlate strongly with measured GDP across countries and across years. A 1 percent change in luminosity corresponds, on average, to roughly a 0.3 percent change in GDP. The elasticity is stable enough that you can use it.

The paper spawned a literature. Donaldson and Storeygard's 2016 review piece in the <em>JEP</em>, "The View from Above," catalogued dozens of follow-on applications. Neal Jean and coauthors' 2016 <em>Science</em> paper used CNN-extracted features from daytime satellite imagery to predict poverty at sub-village resolution. The basic move was: when official statistics are sparse or politically unreliable, use the satellite signal as a proxy for the underlying economic activity, calibrated against a sample of locations where you have ground truth.

That basic move underlies almost every "measure shadow economy with satellites" paper I've seen written in the past decade. It also underlies a substantial portion of the policy work on sanctions evasion. SwissAid's 2024 report on Sahelian gold smuggling estimated a ~$30 billion annual gap between African export declarations and UAE import declarations, partly using satellite data on artisanal mining sites. The intuition is the same. The data are different.

The problem is that the intuition is doing more work than the data can support.

## The Lucas critique, gently

The Lucas critique, dating to Robert Lucas's 1976 paper "Econometric Policy Evaluation: A Critique," made one point: the reduced-form parameters you estimate from historical data are not structural. They are functions of the policy environment that generated the data. If the policy environment changes, the parameters can change. Treating reduced-form parameters as structural and using them to predict the effect of new policies is, in the limit, an unforced error.

The standard place this comes up is the consumption function in macro models. The propensity to consume in any given year is a function of the policy stance (tax regime, expected returns, expected fiscal trajectory). If you estimate it in one regime and use it to predict consumption under a new regime, you're committing the violation.

A version of this critique applies to the satellite-economics literature, and it's the version most of the literature has not addressed.

## The Frechet derivative no one is computing

Here is the move that worries me. The 0.3 elasticity of GDP to luminosity in Henderson-Storeygard-Weil is a cross-sectional reduced-form coefficient. It is estimated along the equilibrium manifold that produced the data. In a world where the equilibrium is stable, where the relationship between economic activity and the satellite signal is structurally invariant, where shocks to one side propagate predictably to the other, this is fine.

In a world where the equilibrium itself depends on the satellite signal, that elasticity is not the right object. Consider: a sanctioned trader chooses to deploy shadow-fleet tactics partly because those tactics evade AIS-based surveillance. The decision to evade is a function of the surveillance technology. The volume of "official" activity that shows up in the data is a function of the evasion decision. The luminosity (or AIS density, or wherever the satellite signal lives) is therefore a function of the strategic interaction between observer and observed.

That makes the observation-to-equilibrium map closed-loop. The cost of trade depends on the equilibrium, because the equilibrium produces the surveillance environment that determines the cost. The cost determines the equilibrium. You have a fixed-point on Wasserstein space (formally, in the construction in <a href="/research/helfrich-2026-aroe">the AROE theorem</a>) and the right object to estimate is not the cross-sectional elasticity. It is the Frechet derivative of the observation operator on the Wasserstein tangent cone at the current equilibrium measure.

That's a mouthful. Translating: instead of asking "how does luminosity respond to GDP on average," ask "if you perturb the underlying economic activity by epsilon, how does the satellite signal respond to that perturbation, accounting for the equilibrium adjustment that the perturbation triggers." The cross-sectional elasticity is the answer to the first question. The Frechet derivative is the answer to the second. In a closed-loop setting they are different objects.

## Why this matters operationally

In the most charitable interpretation, the satellite-economics literature has been using a cross-sectional elasticity as a stand-in for the Frechet derivative, on the assumption that the closed-loop dynamics are weak enough not to matter. That's a working assumption. It's not crazy. In stable, non-sanctioned, non-strategic-evasion settings (say, agricultural output in West Africa during a normal year), the cross-sectional elasticity probably is a good enough approximation to the structural object.

In settings where strategic adversarial behavior dominates the observation environment (Russian crude under sanctions, Iranian oil since 2018, Sahelian gold), the working assumption breaks. The cross-sectional elasticity from Henderson-Storeygard-Weil, calibrated on a sample dominated by non-sanctioned countries in normal years, is not the right number for predicting what the satellite signal will show in a sanctioned-evasion equilibrium. The closed-loop dynamics dominate.

The Penumbra paper is the formalization of that point. It says: when you have endogenous observability, the operator linking observation to equilibrium needs to be a first-class object in the model, not an additive measurement-error term. The empirical companion, <a href="/research/helfrich-2026-russian-crude">Paper 2</a>, is the test. If you can directly estimate the Frechet derivative in the Russian-crude corridor using AIS-track behavior, port-arrival reconciliations, and the Hilgenstock-Babina-Itskhoki monitoring data, you have the first empirical instance of the closed-loop coefficient in a real setting. That's the bet.

## The strong-claim hedge

I'm making a strong claim. I want to flag it honestly. The claim is that a significant fraction of the satellite-economics applied literature, particularly applied to sanctions and shadow trade, is at risk of a Lucas-critique violation. The risk is bigger when the strategic-evasion margin is bigger. The risk is smaller in benign settings.

The hedge is that the formalization in <a href="/research/helfrich-2026-aroe">the AROE theorem</a> assumes a feedback-contractivity hypothesis (H4 in the paper). If H4 fails, the framework doesn't give you unique equilibrium predictions, just existence. The Russian-crude empirical paper is what tests whether H4 holds in the most extreme adversarial setting we have available. If H4 holds there, it probably holds in less-adversarial settings (Sahelian gold smuggling, illicit fishing) where the strategic interaction is weaker. If H4 doesn't hold there, the framework needs a richer treatment of multiple equilibria and we have a different paper to write.

I have a strong prior that H4 holds in the Russian-crude corridor. The strategic equilibrium is stable, sanctions enforcement is incremental (no discontinuous regime changes), the shadow-fleet evasion technology has been more or less the same for two and a half years. If the framework breaks anywhere, it breaks in settings with discontinuous regime changes (a sudden lift of sanctions, a new enforcement technology). The corridor is the cleanest place to make the case.

## The bigger picture

The reason I care about this is operational. Right now, every sanctions policy decision that uses satellite-economics estimates of evasion is implicitly betting that the cross-sectional elasticity is a good enough approximation to the structural object. The bet is being made without acknowledging it. If the bet is wrong, the sanctions-enforcement calculus is miscalibrated. The Penumbra program is the analytical apparatus to do better.

The empirical demonstration in Paper 2 is what makes the analytical apparatus worth using. Theory papers in trade rarely get cited by policy people. Theory papers that come with a clean empirical demonstration of the headline claim, in a corridor everyone cares about, sometimes do. The Russian crude paper is therefore not optional. It's load-bearing for whether anyone outside trade theory pays attention.

The next post in this thread will be on the empirical strategy itself. How to back out the Frechet derivative from AIS and port-arrival data. That one is harder to write because the methodological details matter and the right level of plain language isn't obvious yet. Coming.

If you've read this far and you'd like to talk through any of it, <a href="/contact">the contact page</a> is the easiest path. Welcome.
