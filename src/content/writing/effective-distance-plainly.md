---
title: "Effective distance, plainly"
summary: "Why Portugal and Brazil are 'closer' than Portugal and Morocco, even though Morocco is right across the strait. A non-technical note on the metric Liz and I are building for the Effective Distance panel, and the chokepoint shocks that make it matter."
date: 2026-04-28
tags: ["trade", "networks", "effective-distance", "research-notes"]
---

Pull up a globe. Portugal and Morocco are nine miles apart at the closest point. Portugal and Brazil are forty-three hundred miles apart, by great-circle distance. Geographically, Morocco is fifty times closer.

Now look at the trade data. Portuguese trade with Brazil in 2024 was about $1.7 billion. Portuguese trade with Morocco was about $1.1 billion. On a per-mile basis Brazil is roughly fifty times the trade volume per unit distance, which is the kind of factor that the standard gravity equation in international trade ought to predict and doesn't.

The reason is that geography is the wrong distance to use. The actual distance between Portugal and Brazil, in the sense that matters for trade, runs through five hundred years of Lusophone colonial institutions, a shared language, mutual diaspora networks, the CPLP institutional architecture, and a port-pair (Lisbon to Santos) that has been built up over centuries to carry Portuguese-Brazilian traffic. The actual distance between Portugal and Morocco runs through the Strait of Gibraltar, a busy maritime corridor that is also a major migration route, customs frictions between an EU member state and a non-EU partner, and a much smaller bilateral institutional history. The economic distance is not the geographic distance.

This is the basic problem that the effective-distance literature, since Dirk Brockmann and Dirk Helbing's 2013 paper in Science, is trying to fix.

## The construction in plain English

Brockmann and Helbing were studying disease spread, not trade. Their motivating example was SARS in 2003 and H1N1 in 2009. The pattern they noticed was that the spread of these outbreaks across global air-travel networks was very predictable, but only if you stopped treating geographic distance as the distance variable. What predicted spread was the probability of someone flying from city A to city B in any given day. That probability is roughly proportional to the volume of travel between them, normalized by the total outgoing traffic from A.

Their construction is simple. Let $P_{ij}$ be the probability that travel from $i$ ends up at $j$. Define the effective distance from $i$ to $j$ as $1 - \log P_{ij}$. Locations with high direct flow probability are "close" (the negative log is small). Locations with no direct flow but reachable through a chain of intermediaries get the shortest-path effective distance through the network: you sum the per-step effective distances along the cheapest path.

The metric has the property that locations directly connected by lots of flow are close even if they're geographically far. Locations geographically close but with no flow connection are far. London and Sydney are network-close even though they're nearly antipodal; the Strait of Hormuz and a town in central Iran might be geographically adjacent but network-far if the town has no oil refinery and the flow corridor doesn't pass through it.

You can do the same construction for trade. Treat bilateral trade flows like Brockmann and Helbing treated air-travel passenger counts. Build a flow graph where the nodes are countries (or regions, or ports) and the edge weights are normalized bilateral trade volumes. Compute shortest-path effective distances. You get a 200-country by 200-country matrix of bilateral economic distances that respects the actual trade-network topology rather than the underlying geography.

That's what the Effective Distance panel does. Liz and I have been building it for about a year.

## Why static distance is a hidden bug in most gravity papers

The standard reference for bilateral distances in trade is CEPII's `distw` measure. It computes population-weighted distance between countries: take each pair's major cities, weight by population shares, compute great-circle distances between the city pairs, aggregate. It's a careful piece of work and the field has used it for two decades.

It has one quiet problem: the population weights are from 2004. CEPII's `distw` is what every gravity paper uses for the distance variable, and the population weights in that distance are frozen at a snapshot that's now twenty-plus years old. Trade volumes have shifted, population centers have shifted, port traffic has shifted, but the distance variable is treated as if 2004 were a representative average year for the entire post-WTO period.

That's a small problem in most years. It's a much bigger problem in years where the underlying network topology genuinely changes. Three recent shocks:

- **The Ever Given grounding in March 2021.** Six days of Suez Canal closure. Roughly 12% of global maritime trade was rerouted around the Cape of Good Hope. For Asia-Europe trade lanes the rerouting changed the effective distance dramatically, in some cases doubling shipping time. The shock is invisible in `distw`.

- **The Panama Canal drought of 2023.** Restricted transit capacity through Panama; container ships rerouted, oil tankers paid premium for the slots that remained, the Asia-East Coast US lane re-priced. Again invisible in `distw`.

- **The Houthi Red Sea attacks of 2024.** Persistent rerouting of Asia-Europe traffic around Africa for most of the year. Maersk, MSC, CMA CGM all changed their route algorithms. Invisible in `distw`.

In each case the effective-distance metric we're building moves substantially. The gravity-equation residuals in those years are well behaved with our distance and badly behaved with `distw`. The paper makes this point with three counterfactual exercises, one per shock.

## What it doesn't do

I want to be careful about not overselling. The effective-distance idea is small. It's a refinement of the distance variable in a gravity equation. It doesn't change the structural framework, it doesn't displace the Yotov-Larch-Anderson-Bergstrand school, and it doesn't claim to be a general theory of anything. It claims that the distance variable matters, that the static version of it is wrong in some years in a way that matters for inference, and that a time-varying multi-modal least-cost-path construction is a defensible replacement.

Where the construction matters most is in the welfare counterfactuals. The ACR (Arkolakis-Costinot-Rodríguez-Clare) welfare formula says that the gains from trade for a country are a function of its bilateral trade shares and the trade elasticity. If your distance variable is wrong, your trade shares predicted by gravity are wrong, and your welfare numbers are wrong. The 2021-2024 chokepoint shocks are exactly the cases where the misspecification has the biggest welfare implications, and they're the cases the paper uses to motivate the construction.

## Why this exists at all

The seed of the construction is in a paper Liz and I put on SSRN in April 2025, <a href="/research/gonchar-helfrich-2025-spotlight">Trade in the Spotlight</a>, which introduced the OVDL measure (Origin-VIIRS to Destination-LandScan). That paper used annual VIIRS nightlights and gridded population to time-varying the bilateral distance. It was a first cut. The Effective Distance paper adds the transport-network layer (road, maritime, air) with endogenous mode choice on top of OpenStreetMap's planet file, the structural-gravity validation with Weidner-Zylkin bias correction, and the three welfare counterfactuals.

The companion dataset (EffDist V2026) is going on Zenodo under CC-BY-4.0. Two hundred countries, twenty-five years, eight distance variants per country pair per year. Roughly 40,000 rows per variant-year. It's not a small dataset. It's intended as public infrastructure: gravity-equation papers and trade-shock analyses should be able to use it directly without rebuilding the construction.

That's the whole pitch. A small idea that should change a few welfare numbers, used as a building block for a research program that's about closed-loop measurement in trade more broadly.

If you'd like to use the panel when it's released, write me.
