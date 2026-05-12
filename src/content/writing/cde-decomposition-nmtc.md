---
title: "The CDE decomposition that wasn't supposed to work"
summary: "How the apparent rural-urban leverage gap in the U.S. New Markets Tax Credit collapsed once I added intermediary fixed effects. A note on the moment that reframed the paper, what it means for the CDFI Fund, and what I still don't know."
date: 2026-05-12
draft: true
tags: ["nmtc", "blended-finance", "rural", "research-notes"]
---

The first time I ran the regression with Community Development Entity fixed effects, I assumed I'd typed the model wrong.

The raw rural-urban gap in private-leverage ratio for NMTC projects between FY2001 and FY2022 is enormous. Negative 0.262, three stars, no ambiguity. Rural projects, on average, leverage less private capital per dollar of public Qualified Equity Investment. Every advocacy brief from the CDFI coalition for the last decade leans on a version of this number. It's also the kind of result that feels intuitively obvious. Rural communities have shallower capital markets, fewer institutional investors, less deal-syndication infrastructure, longer drives between potential capital partners. Of course rural leverages worse.

Then I added CDE fixed effects to the regression. The coefficient on the rural dummy moved to negative 0.047. p-value 0.64. Statistically indistinguishable from zero. The standard error went up a bit (the FE absorbed a lot of variance) but not enough to explain the collapse. The point estimate had moved by 0.215, almost 90 percent of the way to zero, on a single model spec change.

I reran the model. I rebuilt the dataset from scratch. I added project-level controls (sector, project size, year, census-tract demographics). The result held. The "rural penalty" was almost entirely between-CDE selection.

## What the decomposition is doing

Strip out the algebra. The point of adding CDE fixed effects is to ask: when a given CDE deploys capital, does it leverage less when the project is rural? Or do some CDEs (the ones that happen to do a lot of rural deals) just leverage less in general, including on their urban deals?

The first version is a market-structure story. Rural projects are inherently harder to finance, so the same intermediary produces a worse leverage outcome when working with a rural deal. The fix would be on the demand side: make rural projects more attractive, subsidize them more, lower their hurdles.

The second version is an intermediary-allocation story. The public capital is flowing into a population of intermediaries that includes high-leverage urban-experienced shops and lower-leverage rural-specialized shops, and the rural-specialized shops are the ones that disproportionately receive the rural-targeted capital. They produce lower leverage on everything they touch, urban or rural, because of who they are as institutions. The aggregate rural penalty is mostly the allocation step, not the deployment step.

The data are unambiguous about which version is closer to the truth. About 80 percent of the aggregate penalty is between-CDE; the within-CDE coefficient is small, statistically indistinguishable from zero, and not robust to including controls. Same Euro, different intermediary, very different outcome.

## What this changes about the policy

The market-structure framing leads to one policy: subsidize rural projects more. Make the credit pricing cheaper for them, increase the public-private match ratio, lower the eligibility hurdles. That is, broadly, what the CDFI Fund's rural-allocation increases have done over the past decade.

The intermediary-allocation framing leads to a different policy. If you want more rural capital deployed at higher leverage, the cheaper fix is to route more of the rural-targeted dollars through high-leverage urban-experienced CDEs that can be required to deploy a share rurally. Or: invest in capacity-building at the rural-specialized CDEs so they can leverage more aggressively on their own deals. Either move is much cheaper than subsidizing the underlying rural projects more.

This is not a "the CDFI Fund has been doing it wrong" claim. The Fund has been operating with the information available, and the information available has been the aggregated rural-vs-urban leverage gap. What I'm saying is that the gap is mostly an artifact of who gets to intermediate, and once you see that, the allocation lever opens up. The decomposition gives the Fund a different policy menu.

## The analytical move that surprised me

I expected the within-CDE coefficient to be smaller than the raw coefficient. Most decompositions move that way: any time you add intermediary or unit fixed effects, you absorb some of the cross-sectional variation. The standard prior is "the FE absorbs maybe 30 to 50 percent." A 90 percent absorption is unusual. It means the variation you thought was about the rural/urban dimension was almost entirely about the CDE dimension instead.

Two things are doing that work. First, NMTC allocation rounds aren't random. The Fund's allocation process selects CDEs based partly on their track record and partly on their geographic focus. Rural-specialized CDEs are a coherent population that the Fund knowingly funds for the rural mandate. So when you look at rural projects, you're disproportionately looking at projects deployed by rural-specialized CDEs.

Second, CDEs vary enormously in their leverage practices. A CDE based in (let's say) the Pacific Northwest that does mostly urban real-estate deals has access to a different syndication network than a CDE based in the Appalachian region that does mostly community facilities. The first one produces 8x leverage on a typical deal. The second produces 3x. That's not because the projects are different, although they are; it's because the institutional networks are different, and the leverage outcome is partly an institutional-network outcome.

Once you condition on the institutional network (the CDE FE), the rural-vs-urban dimension stops doing much explanatory work.

## What I don't know

The reason this paper isn't already on SSRN with the headline declaration "the rural credit problem is an intermediary-selection problem" is that I'm still not sure how far the result transfers.

The first question is whether the same decomposition replicates in LIHTC (Low-Income Housing Tax Credit). The institutional structure is different: LIHTC syndicators have a different incentive structure than CDEs, the pass-through is to housing rather than business, and the geographic-mandate rules are weaker. If the decomposition does NOT collapse the rural gap in LIHTC the same way, that's interesting and informative: it tells me the NMTC result is partly about how the CDFI Fund picks CDEs, not just about pass-through intermediation generally.

The second question is whether the result transfers to Opportunity Zones, which have a much looser intermediary structure. The third question is whether it transfers to the EU Cohesion Funds, where the intermediary equivalents are mutual guarantee societies (Portugal), commercial-bank on-lenders (Ireland), and the various national-promotional-bank structures. That third question is why <a href="/people/">Katia Antunes</a> is going to Lisbon and Dublin in three weeks. The European replication is the next thing.

The honest version of the paper, with all the appropriate hedges, says: in the NMTC setting, the apparent rural mobilization gap is overwhelmingly between-CDE selection. I think the same logic transfers to other pass-through programs but I don't yet have the evidence. The forthcoming European replication is the test.

## The thing I keep going back to

The result feels both surprising and obvious. Surprising because it inverts a decade of policy framing in one model spec. Obvious because of course intermediation matters; of course who actually deploys the capital shapes the outcome. The framing of "rural credit problem" has been doing analytical heavy lifting it shouldn't have been doing, and the moment you stop treating the rural-urban dimension as the primary axis of variation, the data tell you exactly where the variation actually lives.

Most of the empirical results I've cared about in my career have had this shape. Some plausible aggregated story turns out to be an artifact of how the data are aggregated, and the disaggregation reveals a different mechanism. The lesson is not to distrust aggregated data, which would be impossible to live with. The lesson is to know which aggregation is doing the work, and to be willing to reaggregate when the data look like they're trying to tell you something.

In this case the data were trying to tell me the rural penalty was a mirage. I'm grateful that I listened.
